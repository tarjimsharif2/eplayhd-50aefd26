import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function fetchWithRetry(url: string, maxRetries = 2): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
  throw lastError || new Error('Fetch failed');
}

const normalizeTeamName = (name: string) =>
  name?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';

// Generic delegator for ESPN/Sofascore auto-sync
async function handleDelegatedAutoSync(
  supabase: any,
  corsHeaders: Record<string, string>,
  source: 'espn' | 'sofascore'
): Promise<Response> {
  const now = new Date();

  const { data: upcomingMatches, error: matchesError } = await supabase
    .from('matches')
    .select(`
      id, match_date, match_time, match_start_time, status, espn_event_id,
      team_a_id, team_b_id, sport_id,
      team_a:teams!matches_team_a_id_fkey(id, name, short_name),
      team_b:teams!matches_team_b_id_fkey(id, name, short_name),
      sport:sports!matches_sport_id_fkey(name),
      tournament:tournaments(sport)
    `)
    .in('status', ['upcoming', 'live'])
    .eq('is_active', true);

  if (matchesError || !upcomingMatches?.length) {
    return new Response(
      JSON.stringify({ success: true, message: `No matches to sync via ${source}`, synced: 0 }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const eligibleMatches: any[] = [];
  for (const match of upcomingMatches) {
    const sportName = (match.sport as any)?.name?.toLowerCase() || '';
    const tournamentSport = (match.tournament as any)?.sport?.toLowerCase() || '';
    const isCricket = sportName.includes('cricket') || tournamentSport.includes('cricket');
    if (!isCricket) continue;

    let matchStartTime: Date | null = null;
    if (match.match_start_time) {
      matchStartTime = new Date(match.match_start_time);
    } else if (match.match_date && match.match_time) {
      const timeParts = match.match_time.match(/(\d{1,2}):(\d{2})/);
      if (timeParts) matchStartTime = new Date(`${match.match_date}T${timeParts[0]}:00Z`);
    }
    if (!matchStartTime) continue;

    const minutesUntilStart = (matchStartTime.getTime() - now.getTime()) / (1000 * 60);
    if (match.status === 'live' || (match.status === 'upcoming' && minutesUntilStart <= 20 && minutesUntilStart >= -30)) {
      const { count } = await supabase
        .from('match_playing_xi')
        .select('id', { count: 'exact', head: true })
        .eq('match_id', match.id)
        .eq('is_bench', false);

      if ((count || 0) >= 11) continue;
      eligibleMatches.push(match);
    }
  }

  if (eligibleMatches.length === 0) {
    return new Response(
      JSON.stringify({ success: true, message: `No ${source} matches need lineup sync`, synced: 0 }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let synced = 0;
  const results: any[] = [];

  for (const match of eligibleMatches) {
    try {
      const teamAName = (match.team_a as any)?.name || '';
      const teamBName = (match.team_b as any)?.name || '';
      const teamAShortName = (match.team_a as any)?.short_name || '';
      const teamBShortName = (match.team_b as any)?.short_name || '';

      console.log(`[auto-sync-lineups-${source}] Syncing: ${teamAName} vs ${teamBName}`);

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

      const fnName = source === 'espn' ? 'sync-espn-playing-xi' : 'sync-sofascore-playing-xi';
      const payload = source === 'espn'
        ? {
            matchId: match.id,
            teamAId: match.team_a_id,
            teamBId: match.team_b_id,
            teamAName,
            teamAShortName,
            teamBName,
            teamBShortName,
          }
        : {
            matchId: match.id,
            teamAId: match.team_a_id,
            teamBId: match.team_b_id,
            teamAName,
            teamBName,
          };

      const resp = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (resp.ok) {
        const result = await resp.json();
        if (result.success && result.playersAdded > 0) {
          synced++;
          results.push({ matchId: match.id, status: 'synced', players: result.playersAdded, confirmedXI: result.confirmedXI });
          // Enrich images from Sofascore (skips already-tagged players)
          try {
            await fetch(`${supabaseUrl}/functions/v1/enrich-player-images-sofascore`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({ matchId: match.id }),
            });
          } catch (e) {
            console.warn(`[auto-sync-lineups-${source}] image enrich failed:`, e);
          }
        } else {
          results.push({ matchId: match.id, status: result.error || 'no_data' });
        }
      } else {
        results.push({ matchId: match.id, status: `${source}_error` });
      }
    } catch (err) {
      results.push({ matchId: match.id, status: 'error', error: String(err) });
    }
  }

  return new Response(
    JSON.stringify({ success: true, synced, total: eligibleMatches.length, source, results }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[auto-sync-lineups] Starting API Cricket lineup auto-sync...');

    // Get settings
    const { data: settings } = await supabase
      .from('site_settings')
      .select('api_cricket_key, api_cricket_enabled, playing_xi_auto_sync_source')
      .limit(1)
      .maybeSingle();

    const syncSource = (settings as any)?.playing_xi_auto_sync_source || 'api_cricket';
    console.log(`[auto-sync-lineups] Source: ${syncSource}`);

    // If source is ESPN or Sofascore, delegate
    if (syncSource === 'espn' || syncSource === 'sofascore') {
      return await handleDelegatedAutoSync(supabase, corsHeaders, syncSource);
    }

    if (!settings?.api_cricket_enabled || !settings?.api_cricket_key) {
      console.log('[auto-sync-lineups] API Cricket disabled or no key configured');
      return new Response(
        JSON.stringify({ success: true, message: 'API Cricket not configured', synced: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = settings.api_cricket_key;
    const now = new Date();

    // Find upcoming matches starting within 20 minutes that don't have playing XI yet
    const { data: upcomingMatches, error: matchesError } = await supabase
      .from('matches')
      .select(`
        id, match_date, match_time, match_start_time, status,
        team_a_id, team_b_id, sport_id,
        team_a:teams!matches_team_a_id_fkey(id, name, short_name),
        team_b:teams!matches_team_b_id_fkey(id, name, short_name),
        sport:sports!matches_sport_id_fkey(name),
        tournament:tournaments(sport)
      `)
      .in('status', ['upcoming', 'live'])
      .eq('is_active', true);

    if (matchesError) {
      console.error('[auto-sync-lineups] Error fetching matches:', matchesError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch matches' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!upcomingMatches?.length) {
      console.log('[auto-sync-lineups] No upcoming/live matches found');
      return new Response(
        JSON.stringify({ success: true, message: 'No matches to sync', synced: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter: only cricket matches starting within 20 minutes OR live matches without XI
    const eligibleMatches: any[] = [];

    for (const match of upcomingMatches) {
      // Check if cricket
      const sportName = (match.sport as any)?.name?.toLowerCase() || '';
      const tournamentSport = (match.tournament as any)?.sport?.toLowerCase() || '';
      const isCricket = sportName.includes('cricket') || tournamentSport.includes('cricket') || tournamentSport === 'cricket';
      if (!isCricket) continue;

      // Parse match start time
      let matchStartTime: Date | null = null;
      if (match.match_start_time) {
        matchStartTime = new Date(match.match_start_time);
      } else if (match.match_date && match.match_time) {
        const timeParts = match.match_time.match(/(\d{1,2}):(\d{2})/);
        if (timeParts) {
          matchStartTime = new Date(`${match.match_date}T${timeParts[0]}:00Z`);
        }
      }

      if (!matchStartTime) continue;

      const minutesUntilStart = (matchStartTime.getTime() - now.getTime()) / (1000 * 60);

      // Eligible if: starting within 20 minutes, or already live
      if (match.status === 'live' || (match.status === 'upcoming' && minutesUntilStart <= 20 && minutesUntilStart >= -30)) {
        // Check if this match already has playing XI
        const { count } = await supabase
          .from('match_playing_xi')
          .select('id', { count: 'exact', head: true })
          .eq('match_id', match.id)
          .eq('is_bench', false);

        if ((count || 0) >= 11) {
          console.log(`[auto-sync-lineups] Match ${match.id} already has XI (${count} players), skipping`);
          continue;
        }

        eligibleMatches.push(match);
      }
    }

    if (eligibleMatches.length === 0) {
      console.log('[auto-sync-lineups] No eligible matches need lineup sync');
      return new Response(
        JSON.stringify({ success: true, message: 'No matches need lineup sync', synced: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[auto-sync-lineups] ${eligibleMatches.length} matches need lineup sync`);

    let synced = 0;
    const results: any[] = [];

    for (const match of eligibleMatches) {
      try {
        const teamAName = (match.team_a as any)?.name || '';
        const teamBName = (match.team_b as any)?.name || '';
        const teamAId = match.team_a_id;
        const teamBId = match.team_b_id;
        const teamANorm = normalizeTeamName(teamAName);
        const teamBNorm = normalizeTeamName(teamBName);

        console.log(`[auto-sync-lineups] Syncing: ${teamAName} vs ${teamBName} (${match.id})`);

        // Search for matching event in API Cricket
        const today = new Date().toISOString().split('T')[0];
        const pastDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const url = `https://apiv2.api-cricket.com/cricket/?method=get_events&APIkey=${apiKey}&date_start=${pastDate}&date_stop=${today}`;
        const response = await fetchWithRetry(url);
        
        if (!response.ok) {
          console.error(`[auto-sync-lineups] API error ${response.status} for match ${match.id}`);
          results.push({ matchId: match.id, status: 'api_error' });
          continue;
        }

        const data = await response.json();
        if (data.success !== 1 || !data.result?.length) {
          console.log(`[auto-sync-lineups] No events from API for match ${match.id}`);
          results.push({ matchId: match.id, status: 'no_events' });
          continue;
        }

        // Find matching event
        const matchingEvent = data.result.find((event: any) => {
          const homeNorm = normalizeTeamName(event.event_home_team);
          const awayNorm = normalizeTeamName(event.event_away_team);
          return (
            (homeNorm.includes(teamANorm) || teamANorm.includes(homeNorm) ||
             homeNorm.includes(teamBNorm) || teamBNorm.includes(homeNorm)) &&
            (awayNorm.includes(teamANorm) || teamANorm.includes(awayNorm) ||
             awayNorm.includes(teamBNorm) || teamBNorm.includes(awayNorm))
          );
        });

        if (!matchingEvent) {
          console.log(`[auto-sync-lineups] No matching event for ${teamAName} vs ${teamBName}`);
          results.push({ matchId: match.id, status: 'no_match' });
          continue;
        }

        // Fetch detailed event if lineups missing
        let eventData = matchingEvent;
        if (!eventData.lineups && eventData.event_key) {
          const detailUrl = `https://apiv2.api-cricket.com/cricket/?method=get_events&APIkey=${apiKey}&event_key=${eventData.event_key}&date_start=${pastDate}&date_stop=${today}`;
          try {
            const detailRes = await fetchWithRetry(detailUrl);
            if (detailRes.ok) {
              const detailData = await detailRes.json();
              if (detailData.success === 1 && detailData.result?.length > 0) {
                eventData = detailData.result[0];
              }
            }
          } catch (e) {
            console.warn(`[auto-sync-lineups] Detail fetch failed for ${match.id}:`, e);
          }
        }

        if (!eventData.lineups) {
          console.log(`[auto-sync-lineups] No lineups available yet for ${teamAName} vs ${teamBName}`);
          results.push({ matchId: match.id, status: 'no_lineups' });
          continue;
        }

        const lineups = eventData.lineups;
        const homeLineup = lineups.home_team?.starting_lineups || [];
        const awayLineup = lineups.away_team?.starting_lineups || [];

        if (homeLineup.length === 0 && awayLineup.length === 0) {
          console.log(`[auto-sync-lineups] Lineups empty for ${match.id}`);
          results.push({ matchId: match.id, status: 'empty_lineups' });
          continue;
        }

        // Map API teams to our teams
        const apiHomeNorm = normalizeTeamName(eventData.event_home_team || '');
        const teamAMatchesAway = teamANorm && (
          normalizeTeamName(eventData.event_away_team || '').includes(teamANorm) ||
          teamANorm.includes(normalizeTeamName(eventData.event_away_team || ''))
        );
        const teamAMatchesHome = teamANorm && (
          apiHomeNorm.includes(teamANorm) || teamANorm.includes(apiHomeNorm)
        );

        let lineupForA = homeLineup;
        let lineupForB = awayLineup;
        if (teamAMatchesAway && !teamAMatchesHome) {
          lineupForA = awayLineup;
          lineupForB = homeLineup;
        }

        const getPlayerName = (player: any) => player.player || player.player_name || 'Unknown';
        const normalizePlayerName = (player: any) => normalizeTeamName(getPlayerName(player));
        const uniquePlayers = (players: any[]) => {
          const seen = new Set<string>();
          return players.filter((player) => {
            const key = normalizePlayerName(player);
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        };

        const homeSubs = lineups.home_team?.substitutes || [];
        const awaySubs = lineups.away_team?.substitutes || [];
        const subsForA = (teamAMatchesAway && !teamAMatchesHome) ? awaySubs : homeSubs;
        const subsForB = (teamAMatchesAway && !teamAMatchesHome) ? homeSubs : awaySubs;

        const normalizedLineupForA = uniquePlayers(lineupForA);
        const normalizedLineupForB = uniquePlayers(lineupForB);
        const confirmedXIAvailable = normalizedLineupForA.length === 11 && normalizedLineupForB.length === 11;

        // Delete existing players
        await supabase.from('match_playing_xi').delete().eq('match_id', match.id);

        const playersToInsert: any[] = [];

        const addTeamPlayers = (lineup: any[], subs: any[], teamId: string) => {
          const uniqueLineup = uniquePlayers(lineup);
          const lineupNames = new Set(uniqueLineup.map(normalizePlayerName));
          const uniqueBench = uniquePlayers(subs).filter((player) => !lineupNames.has(normalizePlayerName(player)));

          if (confirmedXIAvailable) {
            uniqueLineup.forEach((p: any, idx: number) => {
              playersToInsert.push({
                match_id: match.id,
                team_id: teamId,
                player_name: getPlayerName(p),
                player_role: p.player_type || null,
                is_captain: p.player_captain === '1' || false,
                is_bench: false,
                batting_order: idx + 1,
                is_vice_captain: false,
                is_wicket_keeper: (p.player_type || '').toLowerCase().includes('keeper') || false,
              });
            });

            uniqueBench.forEach((p: any, idx: number) => {
              playersToInsert.push({
                match_id: match.id,
                team_id: teamId,
                player_name: getPlayerName(p),
                player_role: p.player_type || null,
                is_captain: false,
                is_bench: true,
                batting_order: idx + 1,
                is_vice_captain: false,
                is_wicket_keeper: (p.player_type || '').toLowerCase().includes('keeper') || false,
              });
            });
            return;
          }

          [...uniqueLineup, ...uniqueBench].forEach((p: any, idx: number) => {
            playersToInsert.push({
              match_id: match.id,
              team_id: teamId,
              player_name: getPlayerName(p),
              player_role: p.player_type || null,
              is_captain: false,
              is_bench: true,
              batting_order: idx + 1,
              is_vice_captain: false,
              is_wicket_keeper: (p.player_type || '').toLowerCase().includes('keeper') || false,
            });
          });
        };

        addTeamPlayers(normalizedLineupForA, subsForA, teamAId);
        addTeamPlayers(normalizedLineupForB, subsForB, teamBId);

        if (playersToInsert.length > 0) {
          const { error: insertError } = await supabase
            .from('match_playing_xi')
            .insert(playersToInsert);

          if (insertError) {
            console.error(`[auto-sync-lineups] Insert error for ${match.id}:`, insertError);
            results.push({ matchId: match.id, status: 'insert_error' });
            continue;
          }

          // Enrich player images from Sofascore (name-based match)
          try {
            await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/enrich-player-images-sofascore`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({ matchId: match.id }),
            });
          } catch (e) {
            console.warn('[auto-sync-lineups] image enrich failed:', e);
          }
        }

        if (confirmedXIAvailable) {
          synced++;
          console.log(`[auto-sync-lineups] ✅ Confirmed XI synced for ${teamAName} vs ${teamBName}`);
          results.push({ matchId: match.id, status: 'synced', playerCount: playersToInsert.length });
        } else {
          console.log(`[auto-sync-lineups] Squad only for ${teamAName} vs ${teamBName}; saved to bench and will retry`);
          results.push({
            matchId: match.id,
            status: 'waiting_for_confirmed_xi',
            playerCount: playersToInsert.length,
            teamALineupCount: normalizedLineupForA.length,
            teamBLineupCount: normalizedLineupForB.length,
          });
        }

      } catch (matchError) {
        console.error(`[auto-sync-lineups] Error processing match ${match.id}:`, matchError);
        results.push({ matchId: match.id, status: 'error', error: String(matchError) });
      }
    }

    console.log(`[auto-sync-lineups] Done. Synced ${synced}/${eligibleMatches.length} matches`);

    return new Response(
      JSON.stringify({ success: true, synced, total: eligibleMatches.length, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[auto-sync-lineups] Fatal error:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
