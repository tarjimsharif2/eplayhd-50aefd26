import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parseNetRunRate, resolveTournamentTeamScope, teamsMatchStrict } from '../_shared/points-table.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TournamentMatchRow {
  team_a_id: string | null;
  team_b_id: string | null;
}

interface ExistingPointsRow {
  id: string;
  team_id: string;
}

// Sync points table for a specific tournament from Cricbuzz API
async function syncTournamentPoints(
  supabase: any,
  tournament: any,
  teams: any[],
  rapidApiKey: string,
  cricbuzzHost: string,
  endpoints: any
): Promise<{ tournament: string; seriesId: string; updated: number; inserted: number; skipped: string[] }> {
  const seriesId = tournament.series_id;
  
  console.log(`[auto-sync-points-table] Syncing: ${tournament.name} (seriesId: ${seriesId})`);

  const pointsTablePath = (endpoints.points_table_endpoint || '/stats/v1/series/{series_id}/points-table')
    .replace('{series_id}', seriesId);
  
  const pointsTableUrl = `https://${cricbuzzHost}${pointsTablePath}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  
  let response: Response;
  try {
    response = await fetch(pointsTableUrl, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': cricbuzzHost,
        'x-rapidapi-key': rapidApiKey,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`[auto-sync-points-table] Network error for ${tournament.name}:`, error);
    return { tournament: tournament.name, seriesId, updated: 0, inserted: 0, skipped: [`Network error: ${error}`] };
  }

  if (response.status === 429) {
    console.warn(`[auto-sync-points-table] Rate limited (429) for ${tournament.name} - will cooldown`);
    return { tournament: tournament.name, seriesId, updated: 0, inserted: 0, skipped: ['Rate limited (429) - will retry later'] };
  }

  if (!response.ok) {
    console.error(`[auto-sync-points-table] API error for ${tournament.name}: ${response.status}`);
    return { tournament: tournament.name, seriesId, updated: 0, inserted: 0, skipped: [`API error: ${response.status}`] };
  }

  const data = await response.json();
  const pointsTable = data.pointsTable || [];
  
  if (!pointsTable || pointsTable.length === 0) {
    console.log(`[auto-sync-points-table] No points data for ${tournament.name}`);
    return { tournament: tournament.name, seriesId, updated: 0, inserted: 0, skipped: ['No data available'] };
  }

  let updatedCount = 0;
  let insertedCount = 0;
  let skippedTeams: string[] = [];

  const { data: tournamentMatches, error: matchesError } = await supabase
    .from('matches')
    .select('team_a_id, team_b_id')
    .eq('tournament_id', tournament.id);

  if (matchesError) {
    return { tournament: tournament.name, seriesId, updated: 0, inserted: 0, skipped: ['Failed to fetch tournament teams'] };
  }

  const matchTeamIds = Array.from(new Set(
    ((tournamentMatches || []) as TournamentMatchRow[])
      .flatMap((match) => [match.team_a_id, match.team_b_id])
      .filter((teamId): teamId is string => Boolean(teamId))
  ));

  const { allowedTeamIds } = resolveTournamentTeamScope({
    teams,
    customParticipatingTeams: tournament.custom_participating_teams,
    matchTeamIds,
  });

  if (allowedTeamIds.size === 0) {
    return { tournament: tournament.name, seriesId, updated: 0, inserted: 0, skipped: ['No fixed participant teams found'] };
  }

  const { data: existingRows, error: existingRowsError } = await supabase
    .from('tournament_points_table')
    .select('id, team_id')
    .eq('tournament_id', tournament.id);

  if (existingRowsError) {
    return { tournament: tournament.name, seriesId, updated: 0, inserted: 0, skipped: ['Failed to inspect existing points rows'] };
  }

  const outOfScopeRowIds = ((existingRows || []) as ExistingPointsRow[])
    .filter((row) => !allowedTeamIds.has(row.team_id))
    .map((row) => row.id);

  if (outOfScopeRowIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('tournament_points_table')
      .delete()
      .in('id', outOfScopeRowIds);

    if (deleteError) {
      return { tournament: tournament.name, seriesId, updated: 0, inserted: 0, skipped: ['Failed to remove out-of-scope teams'] };
    }
  }

  for (const group of pointsTable) {
    const groupTable = group.pointsTableInfo || [];
    const groupName = group.groupName || null;

    for (const standing of groupTable) {
      const apiTeamName = standing.teamName || '';
      const apiTeamFullName = standing.teamFullName || '';
      
      if (!apiTeamName) continue;

      const matchingTeam = teams.find(team => 
        teamsMatchStrict(team, apiTeamName, apiTeamFullName)
      );

      if (!matchingTeam) {
        skippedTeams.push(`${apiTeamName} (${apiTeamFullName})`);
        continue;
      }

      if (!allowedTeamIds.has(matchingTeam.id)) {
        skippedTeams.push(`${apiTeamName} (${apiTeamFullName}) [out of scope]`);
        continue;
      }

      const played = parseInt(standing.matchesPlayed || 0) || 0;
      const won = parseInt(standing.matchesWon || 0) || 0;
      const lost = parseInt(standing.matchesLost || 0) || 0;
      const tied = parseInt(standing.matchesTied || 0) || 0;
      const noResult = parseInt(standing.noRes || standing.noResult || 0) || 0;
      const points = parseInt(standing.points || 0) || 0;
      const position = parseInt(standing.position || 0) || 0;

      // Query by group_name to handle teams in multiple groups
      let existingQuery = supabase
        .from('tournament_points_table')
        .select('id, net_run_rate')
        .eq('tournament_id', tournament.id)
        .eq('team_id', matchingTeam.id);
      
      if (groupName) {
        existingQuery = existingQuery.eq('group_name', groupName);
      } else {
        existingQuery = existingQuery.is('group_name', null);
      }
      
      const { data: existing } = await existingQuery.maybeSingle();

      const apiNrr = parseNetRunRate(standing.nrr);
      const netRunRate = apiNrr ?? existing?.net_run_rate ?? 0;

      const entryData = {
        tournament_id: tournament.id,
        team_id: matchingTeam.id,
        position,
        played,
        won,
        lost,
        tied,
        no_result: noResult,
        points,
        net_run_rate: netRunRate,
        group_name: groupName,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const { error } = await supabase
          .from('tournament_points_table')
          .update(entryData)
          .eq('id', existing.id);
        if (!error) updatedCount++;
      } else {
        const { error } = await supabase
          .from('tournament_points_table')
          .insert(entryData);
        if (!error) insertedCount++;
      }
    }
  }

  console.log(`[auto-sync-points-table] ${tournament.name}: Updated ${updatedCount}, Inserted ${insertedCount}, Skipped ${skippedTeams.length}`);
  
  // Recalculate positions using database function
  try {
    await supabase.rpc('recalculate_tournament_positions', { p_tournament_id: tournament.id });
    console.log(`[auto-sync-points-table] Positions recalculated for ${tournament.name}`);
  } catch (err) {
    console.error(`[auto-sync-points-table] Position recalculation error:`, err);
  }
  
  return { tournament: tournament.name, seriesId, updated: updatedCount, inserted: insertedCount, skipped: skippedTeams };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[auto-sync-points-table] Starting auto sync check...');

    // Get RapidAPI settings
    const { data: siteSettings, error: settingsError } = await supabase
      .from('site_settings')
      .select('rapidapi_key, rapidapi_enabled, rapidapi_endpoints')
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      console.error('[auto-sync-points-table] Settings error:', settingsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch settings' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!siteSettings?.rapidapi_enabled || !siteSettings?.rapidapi_key) {
      console.error('[auto-sync-points-table] RapidAPI not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'RapidAPI is not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rapidApiKey = siteSettings.rapidapi_key;
    const endpoints = siteSettings.rapidapi_endpoints || {};
    const cricbuzzHost = endpoints.cricbuzz_host || 'cricbuzz-cricket.p.rapidapi.com';

    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();
    const currentTotalMinutes = currentHour * 60 + currentMinute;

    const tournamentsToSync: any[] = [];
    const syncReasons: Map<string, string> = new Map();

    // === CHECK 1: Daily sync tournaments (time-based) ===
    const { data: dailyTournaments } = await supabase
      .from('tournaments')
      .select('id, name, series_id, custom_participating_teams, points_table_sync_time, points_table_daily_sync_enabled, points_table_on_complete_sync_enabled')
      .eq('is_active', true)
      .eq('is_completed', false)
      .eq('points_table_daily_sync_enabled', true)
      .not('series_id', 'is', null);

    if (dailyTournaments) {
      for (const t of dailyTournaments) {
        const syncTimeRaw = t.points_table_sync_time;
        if (!syncTimeRaw) continue;

        // Support multiple comma-separated sync times
        const syncTimes = syncTimeRaw.split(',').map((s: string) => s.trim()).filter(Boolean);
        
        for (const singleTime of syncTimes) {
          const timePart = singleTime.split(/[+-]/)[0];
          const [syncHourStr, syncMinuteStr] = timePart.split(':');
          let syncHour = parseInt(syncHourStr) || 0;
          let syncMinute = parseInt(syncMinuteStr) || 0;

          const offsetMatch = singleTime.match(/([+-])(\d{2}):(\d{2})$/);
          if (offsetMatch) {
            const sign = offsetMatch[1] === '+' ? -1 : 1;
            const offsetHours = parseInt(offsetMatch[2]) || 0;
            const offsetMinutes = parseInt(offsetMatch[3]) || 0;
            let totalMinutes = (syncHour * 60 + syncMinute) + sign * (offsetHours * 60 + offsetMinutes);
            totalMinutes = ((totalMinutes % 1440) + 1440) % 1440;
            syncHour = Math.floor(totalMinutes / 60);
            syncMinute = totalMinutes % 60;
          }

          // Exact minute match only (fires once per scheduled time, no retries)
          if (currentHour === syncHour && currentMinute === syncMinute) {
            if (!tournamentsToSync.find(existing => existing.id === t.id)) {
              tournamentsToSync.push(t);
              syncReasons.set(t.id, `daily_sync@${timePart}`);
            }
            break; // No need to check other times for same tournament
          }
        }
      }
    }

    // === CHECK 2: On-complete sync (recently completed matches) ===
    const { data: onCompleteTournaments } = await supabase
      .from('tournaments')
      .select('id, name, series_id, custom_participating_teams, points_table_on_complete_sync_enabled')
      .eq('is_active', true)
      .eq('is_completed', false)
      .eq('points_table_on_complete_sync_enabled', true)
      .not('series_id', 'is', null);

    if (onCompleteTournaments && onCompleteTournaments.length > 0) {
      const tournamentIds = onCompleteTournaments.map(t => t.id);
      
      // Find matches completed in the last 10 minutes with a valid match_result
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
      const { data: recentlyCompleted } = await supabase
        .from('matches')
        .select('id, tournament_id, match_result, updated_at')
        .eq('status', 'completed')
        .not('match_result', 'is', null)
        .gte('updated_at', tenMinutesAgo.toISOString())
        .in('tournament_id', tournamentIds);

      if (recentlyCompleted && recentlyCompleted.length > 0) {
        const completedTournamentIds = [...new Set(recentlyCompleted.map(m => m.tournament_id))];
        console.log(`[auto-sync-points-table] Found ${recentlyCompleted.length} recently completed matches in ${completedTournamentIds.length} tournaments`);
        
        for (const tid of completedTournamentIds) {
          if (!tournamentsToSync.find(t => t.id === tid)) {
            const tournament = onCompleteTournaments.find(t => t.id === tid);
            if (tournament) {
              tournamentsToSync.push(tournament);
              syncReasons.set(tid, 'on_match_complete');
            }
          }
        }
      }
    }

    if (tournamentsToSync.length === 0) {
      const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
      console.log(`[auto-sync-points-table] No tournaments to sync at ${currentTime} UTC`);
      return new Response(
        JSON.stringify({ success: true, message: `No tournaments to sync at ${currentTime} UTC` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[auto-sync-points-table] ${tournamentsToSync.length} tournaments to sync (reasons: ${[...syncReasons.values()].join(', ')})`);

    // Get ALL teams
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name, short_name');

    if (teamsError || !teams) {
      console.error('[auto-sync-points-table] Failed to fetch teams');
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch teams' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: Array<{ tournament: string; seriesId: string; updated: number; inserted: number; skipped: string[]; reason: string }> = [];

    // Process each tournament with delay between calls
    for (const tournament of tournamentsToSync) {
      try {
        const result = await syncTournamentPoints(supabase, tournament, teams, rapidApiKey, cricbuzzHost, endpoints);
        results.push({ ...result, reason: syncReasons.get(tournament.id) || 'unknown' });

        // If we got rate limited, stop trying other tournaments too
        if (result.skipped.some(s => s.includes('429'))) {
          console.warn('[auto-sync-points-table] Rate limited - stopping further sync attempts this run');
          break;
        }

        // 3 second delay between tournaments
        if (tournamentsToSync.indexOf(tournament) < tournamentsToSync.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      } catch (err) {
        console.error(`[auto-sync-points-table] Error syncing ${tournament.name}:`, err);
        results.push({ tournament: tournament.name, seriesId: tournament.series_id, updated: 0, inserted: 0, skipped: [`Error: ${err}`], reason: syncReasons.get(tournament.id) || 'unknown' });
      }
    }

    console.log('[auto-sync-points-table] Auto sync complete:', JSON.stringify(results));

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[auto-sync-points-table] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
