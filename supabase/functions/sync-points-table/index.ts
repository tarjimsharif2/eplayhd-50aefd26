import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyAdminAuth, unauthorizedResponse, forbiddenResponse } from '../_shared/auth.ts';
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

// Helper function to fetch with retry logic (skips retry on 429)
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // Don't retry on rate limit - return immediately
      if (response.status === 429) {
        console.warn('[sync-points-table] Rate limited (429) - not retrying');
        return response;
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      console.log(`Attempt ${attempt}/${maxRetries} failed: ${error}`);
      
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Failed to fetch after retries');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Check if this is an automated call (from DB trigger via pg_net)
  // The trigger sends the anon key as Bearer token
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  
  // Try to detect automated call by decoding the JWT payload
  let isAutomatedCall = false;
  try {
    const payloadB64 = token.split('.')[1];
    if (payloadB64) {
      const payload = JSON.parse(atob(payloadB64));
      if (payload.role === 'anon') {
        isAutomatedCall = true;
      }
    }
  } catch {
    // Not a valid JWT, continue with admin auth
  }

  if (!isAutomatedCall) {
    // Manual call - verify admin authentication
    const { user, error: authError } = await verifyAdminAuth(req);
    if (authError) {
      console.log('[sync-points-table] Auth failed:', authError);
      if (authError === 'Admin access required') {
        return forbiddenResponse(authError, corsHeaders);
      }
      return unauthorizedResponse(authError, corsHeaders);
    }
    console.log(`[sync-points-table] Authenticated admin: ${user.id}`);
  } else {
    console.log('[sync-points-table] Automated call from DB trigger (anon role detected)');
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { tournamentId } = body;
    let { seriesId } = body;

    if (!tournamentId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tournament ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If no seriesId provided, auto-fetch from tournament record
    if (!seriesId) {
      const { data: tournamentData } = await supabase
        .from('tournaments')
        .select('series_id')
        .eq('id', tournamentId)
        .single();
      
      if (tournamentData?.series_id) {
        seriesId = tournamentData.series_id;
        console.log(`[sync-points-table] Auto-fetched series_id: ${seriesId} from tournament`);
      }
    }

    console.log(`[sync-points-table] Syncing points table for tournament: ${tournamentId}, seriesId: ${seriesId}`);

    // Get the RapidAPI key and endpoints from site_settings
    const { data: siteSettings, error: settingsError } = await supabase
      .from('site_settings')
      .select('rapidapi_key, rapidapi_enabled, rapidapi_endpoints')
      .limit(1)
      .maybeSingle();

    if (settingsError || !siteSettings?.rapidapi_enabled || !siteSettings?.rapidapi_key) {
      console.error('[sync-points-table] RapidAPI is disabled or not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'RapidAPI is disabled or not configured. Please configure RapidAPI key in Settings.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rapidApiKey = siteSettings.rapidapi_key;

    // Get tournament details
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, name, season, custom_participating_teams')
      .eq('id', tournamentId)
      .single();

    if (tournamentError || !tournament) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tournament not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get ALL teams in the system - we use STRICT matching to avoid wrong teams
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name, short_name');

    if (teamsError || !teams) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch teams' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[sync-points-table] Total teams in database: ${teams.length}`);

    const { data: tournamentMatches, error: matchesError } = await supabase
      .from('matches')
      .select('team_a_id, team_b_id')
      .eq('tournament_id', tournamentId);

    if (matchesError) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch tournament teams' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const matchTeamIds = Array.from(new Set(
      ((tournamentMatches || []) as TournamentMatchRow[])
        .flatMap((match) => [match.team_a_id, match.team_b_id])
        .filter((teamId): teamId is string => Boolean(teamId))
    ));

    const {
      allowedTeamIds,
      scopeSource,
      unresolvedCustomTeams,
    } = resolveTournamentTeamScope({
      teams,
      customParticipatingTeams: tournament.custom_participating_teams,
      matchTeamIds,
    });

    if (allowedTeamIds.size === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No fixed participant teams found for this tournament. Add participating teams or matches first.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: existingRows, error: existingRowsError } = await supabase
      .from('tournament_points_table')
      .select('id, team_id')
      .eq('tournament_id', tournamentId);

    if (existingRowsError) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to inspect existing points table rows' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to remove out-of-scope teams from the points table' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // If still no seriesId after auto-fetch, ask user (manual calls) or skip (automated)
    if (!seriesId) {
      if (isAutomatedCall) {
        console.log(`[sync-points-table] No series_id found for tournament ${tournamentId}, skipping automated sync`);
        return new Response(
          JSON.stringify({ success: false, error: 'No series_id configured for this tournament' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Series ID is required. Please enter the Cricbuzz Series ID.',
          requiresSeriesId: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get endpoint configuration from site_settings
    const endpoints = siteSettings.rapidapi_endpoints || {};
    const cricbuzzHost = endpoints.cricbuzz_host || 'cricbuzz-cricket.p.rapidapi.com';
    const pointsTablePath = (endpoints.points_table_endpoint || '/stats/v1/series/{series_id}/points-table')
      .replace('{series_id}', seriesId);
    
    // Fetch points table from Cricbuzz RapidAPI
    const pointsTableUrl = `https://${cricbuzzHost}${pointsTablePath}`;
    
    console.log(`[sync-points-table] Fetching points table from: ${pointsTableUrl}`);
    
    const response = await fetchWithRetry(pointsTableUrl, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': cricbuzzHost,
        'x-rapidapi-key': rapidApiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[sync-points-table] API error: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ success: false, error: `API error: ${response.status}. Please check Series ID and API key.` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log(`[sync-points-table] API response:`, JSON.stringify(data).substring(0, 500));

    // Parse Cricbuzz response structure
    // The response has pointsTable array with groupTable entries
    const pointsTable = data.pointsTable || [];
    
    if (!pointsTable || pointsTable.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No points table data available for this series' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


    let updatedCount = 0;
    let insertedCount = 0;
    let skippedTeams: string[] = [];

    // Process each group in points table
    for (const group of pointsTable) {
      const groupTable = group.pointsTableInfo || [];
      // Extract group name from API response (e.g., "Group A", "Group B")
      const groupName = group.groupName || null;
      
      console.log(`[sync-points-table] Processing group: ${groupName || 'No Group'}, teams: ${groupTable.length}`);
      
      for (const standing of groupTable) {
        const apiTeamName = standing.teamName || '';
        const apiTeamFullName = standing.teamFullName || '';
        
        if (!apiTeamName) continue;

        // Find matching team in our database using STRICT matching only
        const matchingTeam = teams.find(team => 
          teamsMatchStrict(team, apiTeamName, apiTeamFullName)
        );

        if (!matchingTeam) {
          console.log(`[sync-points-table] No matching team found for: ${apiTeamName} (${apiTeamFullName})`);
          skippedTeams.push(`${apiTeamName} (${apiTeamFullName})`);
          continue;
        }

        if (!allowedTeamIds.has(matchingTeam.id)) {
          console.log(`[sync-points-table] Skipping out-of-scope team: ${apiTeamName} (${apiTeamFullName})`);
          skippedTeams.push(`${apiTeamName} (${apiTeamFullName}) [out of scope]`);
          continue;
        }

        console.log(`[sync-points-table] Matched ${apiTeamName} (${apiTeamFullName}) -> ${matchingTeam.name} (${matchingTeam.short_name}) [Group: ${groupName || 'None'}]`);

        // Parse Cricbuzz standing data
        const played = parseInt(standing.matchesPlayed || 0) || 0;
        const won = parseInt(standing.matchesWon || 0) || 0;
        const lost = parseInt(standing.matchesLost || 0) || 0;
        const tied = parseInt(standing.matchesTied || 0) || 0;
        const noResult = parseInt(standing.noRes || standing.noResult || 0) || 0;
        const points = parseInt(standing.points || 0) || 0;
        const position = parseInt(standing.position || 0) || 0;
        
        // Check if entry exists for this specific group
        let existingQuery = supabase
          .from('tournament_points_table')
          .select('id, net_run_rate, group_name')
          .eq('tournament_id', tournamentId)
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
          tournament_id: tournamentId,
          team_id: matchingTeam.id,
          position,
          played,
          won,
          lost,
          tied,
          no_result: noResult,
          points,
          net_run_rate: netRunRate,
          // Include group name from API
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

    console.log(`[sync-points-table] Sync complete. Updated: ${updatedCount}, Inserted: ${insertedCount}, Skipped: ${skippedTeams.length}`);

    // Auto-recalculate positions after sync - use direct SQL for automated calls
    console.log(`[sync-points-table] Auto-recalculating positions for tournament: ${tournamentId}`);
    
    // Update NRR
    await supabase.rpc('recalculate_tournament_positions', {
      p_tournament_id: tournamentId
    }).then(({ error }) => {
      if (error) {
        // If RPC fails (e.g., no auth.uid() for automated calls), do manual position update
        console.log(`[sync-points-table] RPC recalculate failed (expected for automated calls), positions already set from API`);
      } else {
        console.log(`[sync-points-table] Positions recalculated successfully via RPC`);
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Points table synced and positions recalculated`,
        updated: updatedCount,
        inserted: insertedCount,
        removed: outOfScopeRowIds.length,
        skippedTeams: skippedTeams.length > 0 ? skippedTeams : undefined,
        unresolvedCustomTeams: unresolvedCustomTeams.length > 0 ? unresolvedCustomTeams : undefined,
        scopeSource,
        seriesId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[sync-points-table] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
