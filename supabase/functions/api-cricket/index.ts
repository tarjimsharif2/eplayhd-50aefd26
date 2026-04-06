import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyAdminAuth, unauthorizedResponse, forbiddenResponse } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to fetch with retry logic
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      lastError = error as Error;
      console.log(`Attempt ${attempt}/${maxRetries} failed: ${error}`);
      
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Failed to fetch after retries');
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify admin authentication
  const { user, error: authError } = await verifyAdminAuth(req);
  if (authError) {
    console.log('[api-cricket] Auth failed:', authError);
    if (authError === 'Admin access required') {
      return forbiddenResponse(authError, corsHeaders);
    }
    return unauthorizedResponse(authError, corsHeaders);
  }
  console.log(`[api-cricket] Authenticated admin: ${user.id}`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the API key from site_settings
    const { data: settings, error: settingsError } = await supabase
      .from('site_settings')
      .select('api_cricket_key, api_cricket_enabled')
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch settings' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!settings?.api_cricket_enabled) {
      return new Response(
        JSON.stringify({ success: false, error: 'API Cricket is disabled' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!settings?.api_cricket_key) {
      return new Response(
        JSON.stringify({ success: false, error: 'API Cricket key not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = settings.api_cricket_key;
    const body = await req.json();
    const { action, teamAName, teamBName, eventKey, matchId } = body;

    console.log(`API Cricket request - Action: ${action}, Teams: ${teamAName} vs ${teamBName}`);

    const normalizeTeamName = (name: string) => 
      name?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';

    const teamANormalized = normalizeTeamName(teamAName);
    const teamBNormalized = normalizeTeamName(teamBName);

    // Helper to find matching event from API response
    const findMatchInEvents = (events: any[]) => {
      return events.find((event: any) => {
        const homeNormalized = normalizeTeamName(event.event_home_team);
        const awayNormalized = normalizeTeamName(event.event_away_team);
        
        return (
          (homeNormalized.includes(teamANormalized) || teamANormalized.includes(homeNormalized) ||
           homeNormalized.includes(teamBNormalized) || teamBNormalized.includes(homeNormalized)) &&
          (awayNormalized.includes(teamANormalized) || teamANormalized.includes(awayNormalized) ||
           awayNormalized.includes(teamBNormalized) || teamBNormalized.includes(awayNormalized))
        );
      });
    };

    // Helper to fetch events for a date range
    const fetchEventsForDateRange = async (startDate: string, endDate: string, eventKey?: string) => {
      let url = `https://apiv2.api-cricket.com/cricket/?method=get_events&APIkey=${apiKey}&date_start=${startDate}&date_stop=${endDate}`;
      
      // If event_key is provided, add it to get full details for that specific event
      if (eventKey) {
        url += `&event_key=${eventKey}`;
        console.log(`Fetching event details for event_key: ${eventKey}`);
      } else {
        console.log(`Fetching events from api-cricket.com for ${startDate} to ${endDate}`);
      }
      
      const response = await fetchWithRetry(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error(`API Cricket error: ${response.status} ${response.statusText}`);
        return [];
      }

      const data = await response.json();

      if (!data.success || data.success !== 1) {
        console.error('API Cricket returned unsuccessful response:', data);
        return [];
      }

      return data.result || [];
    };

    // Helper to fetch event details by event_key for full scorecard data
    const fetchEventDetails = async (eventKey: string, eventDate: string) => {
      console.log(`Fetching detailed scorecard for event_key: ${eventKey}`);
      const events = await fetchEventsForDateRange(eventDate, eventDate, eventKey);
      return events.length > 0 ? events[0] : null;
    };

    // Helper to find matching event - searches today first, then past 7 days if not found
    const findMatchingEvent = async (includePastDays: boolean = false) => {
      const today = new Date().toISOString().split('T')[0];
      
      // First, try today's events
      let events = await fetchEventsForDateRange(today, today);
      let matchingEvent = findMatchInEvents(events);
      
      if (matchingEvent) {
        return matchingEvent;
      }
      
      // If not found and we should search past days (for completed matches)
      if (includePastDays) {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 7);
        const pastDateStr = pastDate.toISOString().split('T')[0];
        
        console.log(`Match not found today, searching past 7 days from ${pastDateStr}`);
        events = await fetchEventsForDateRange(pastDateStr, today);
        matchingEvent = findMatchInEvents(events);
      }
      
      return matchingEvent || null;
    };

    if (action === 'syncMatch' && matchId) {
      // Sync match scores from API to database - search past 7 days for completed matches
      const matchingEvent = await findMatchingEvent(true);
      
      if (!matchingEvent) {
        return new Response(
          JSON.stringify({ success: false, error: 'No matching event found' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Found matching event for sync: ${matchingEvent.event_home_team} vs ${matchingEvent.event_away_team}`);
      console.log(`Our teams: teamA="${teamAName}", teamB="${teamBName}"`);

      // NOTE: We do NOT update match status from API anymore.
      // Match status (upcoming/live/completed) is managed ONLY by update-match-status function
      // based on match_start_time, match_end_time, and match_duration_minutes.
      // This ensures matches complete according to scheduled time, not when API says "Finished".
      // We only sync scores here.

      // CRITICAL FIX: Map API home/away to our team_a/team_b correctly
      // API's home_team may not be our team_a!
      const apiHomeTeam = matchingEvent.event_home_team || '';
      const apiAwayTeam = matchingEvent.event_away_team || '';
      
      // Determine which API team maps to our team_a and team_b
      const teamAMatchesHome = teamANormalized && (
        normalizeTeamName(apiHomeTeam).includes(teamANormalized) || 
        teamANormalized.includes(normalizeTeamName(apiHomeTeam).split(' ')[0])
      );
      const teamAMatchesAway = teamANormalized && (
        normalizeTeamName(apiAwayTeam).includes(teamANormalized) || 
        teamANormalized.includes(normalizeTeamName(apiAwayTeam).split(' ')[0])
      );
      
      // Determine the mapping
      let apiTeamForA: 'home' | 'away' = 'home';
      let apiTeamForB: 'home' | 'away' = 'away';
      
      if (teamAMatchesAway && !teamAMatchesHome) {
        // Team A is the away team in API
        apiTeamForA = 'away';
        apiTeamForB = 'home';
        console.log(`[api-cricket] Team mapping: teamA="${teamAName}" -> API away, teamB="${teamBName}" -> API home`);
      } else {
        console.log(`[api-cricket] Team mapping: teamA="${teamAName}" -> API home, teamB="${teamBName}" -> API away`);
      }

      // Extract overs from the extra field
      let homeOvers: string | null = null;
      let awayOvers: string | null = null;
      
      if (matchingEvent.extra && typeof matchingEvent.extra === 'object') {
        const homeTeamLower = apiHomeTeam.toLowerCase();
        const awayTeamLower = apiAwayTeam.toLowerCase();
        
        Object.entries(matchingEvent.extra).forEach(([inningsKey, inningsData]: [string, any]) => {
          if (Array.isArray(inningsData) && inningsData.length > 0) {
            const firstEntry = inningsData[0];
            const inningsTeam = inningsKey.replace(/ \d+ INN$/i, '').toLowerCase().trim();
            
            if (inningsTeam.includes(homeTeamLower.split(' ')[0]) || homeTeamLower.includes(inningsTeam.split(' ')[0])) {
              if (!homeOvers && firstEntry.total_overs) {
                homeOvers = firstEntry.total_overs;
              }
            } else if (inningsTeam.includes(awayTeamLower.split(' ')[0]) || awayTeamLower.includes(inningsTeam.split(' ')[0])) {
              if (!awayOvers && firstEntry.total_overs) {
                awayOvers = firstEntry.total_overs;
              }
            }
          }
        });
      }

      // Get raw scores from API
      const apiHomeScore = matchingEvent.event_home_final_result || null;
      const apiAwayScore = matchingEvent.event_away_final_result || null;
      
      // Format scores with overs
      let formattedHomeScore = apiHomeScore;
      let formattedAwayScore = apiAwayScore;
      
      if (formattedHomeScore && homeOvers) {
        formattedHomeScore = `${formattedHomeScore} (${homeOvers} ov)`;
      }
      if (formattedAwayScore && awayOvers) {
        formattedAwayScore = `${formattedAwayScore} (${awayOvers} ov)`;
      }
      
      // CRITICAL: Map to correct team based on our mapping
      let scoreA: string | null = null;
      let scoreB: string | null = null;
      
      if (apiTeamForA === 'home') {
        scoreA = formattedHomeScore;
        scoreB = formattedAwayScore;
      } else {
        scoreA = formattedAwayScore;
        scoreB = formattedHomeScore;
      }
      
      console.log(`[api-cricket] Final scores: score_a="${scoreA}" (${teamAName}), score_b="${scoreB}" (${teamBName})`);

      // Update match in database - ONLY update scores, NOT status
      // Status is managed by update-match-status function based on scheduled times
      const updateData: any = {
        score_a: scoreA,
        score_b: scoreB,
        last_api_sync: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Extract match result (winner) from API when match is finished
      if (matchingEvent.event_status === 'Finished' && matchingEvent.event_result) {
        const resultText = matchingEvent.event_result;
        console.log(`[api-cricket] Match finished, result: ${resultText}`);
        
        // Determine winner from result text
        // Patterns: "Team A won by X runs/wickets", "Match Tied", "Match Drawn", "No Result"
        if (resultText.toLowerCase().includes('tied') || resultText.toLowerCase().includes('tie')) {
          updateData.match_result = 'tied';
        } else if (resultText.toLowerCase().includes('draw') || resultText.toLowerCase().includes('drawn')) {
          updateData.match_result = 'draw';
        } else if (resultText.toLowerCase().includes('no result') || resultText.toLowerCase().includes('abandoned')) {
          updateData.match_result = 'no_result';
        } else {
          // Try to match winner team from result text
          // Pattern: "Team won by X runs/wickets"
          const winnerMatch = resultText.match(/^(.+?)\s+won\s+by\s+(.+)$/i);
          if (winnerMatch) {
            const winnerName = winnerMatch[1].trim();
            const margin = winnerMatch[2].trim(); // e.g., "7 wickets", "50 runs"
            const winnerNormalized = normalizeTeamName(winnerName);
            
            // Store the winning margin
            updateData.result_margin = `by ${margin}`;
            console.log(`[api-cricket] Winning margin: by ${margin}`);
            
            // Check which team won
            const teamAMatches = teamANormalized.includes(winnerNormalized) || 
                               winnerNormalized.includes(teamANormalized) ||
                               normalizeTeamName(teamAName).split('').filter((c, i) => winnerNormalized.includes(c)).length > teamANormalized.length * 0.5;
            const teamBMatches = teamBNormalized.includes(winnerNormalized) || 
                               winnerNormalized.includes(teamBNormalized) ||
                               normalizeTeamName(teamBName).split('').filter((c, i) => winnerNormalized.includes(c)).length > teamBNormalized.length * 0.5;
            
            if (teamAMatches && !teamBMatches) {
              updateData.match_result = 'team_a_won';
              console.log(`[api-cricket] Winner: Team A (${teamAName})`);
            } else if (teamBMatches && !teamAMatches) {
              updateData.match_result = 'team_b_won';
              console.log(`[api-cricket] Winner: Team B (${teamBName})`);
            } else {
              // Fallback: try more flexible matching
              const apiHomeNorm = normalizeTeamName(apiHomeTeam);
              const apiAwayNorm = normalizeTeamName(apiAwayTeam);
              
              if (apiHomeNorm.includes(winnerNormalized) || winnerNormalized.includes(apiHomeNorm)) {
                // API home team won
                updateData.match_result = apiTeamForA === 'home' ? 'team_a_won' : 'team_b_won';
                console.log(`[api-cricket] Winner: API home team -> ${apiTeamForA === 'home' ? 'Team A' : 'Team B'}`);
              } else if (apiAwayNorm.includes(winnerNormalized) || winnerNormalized.includes(apiAwayNorm)) {
                // API away team won
                updateData.match_result = apiTeamForA === 'away' ? 'team_a_won' : 'team_b_won';
                console.log(`[api-cricket] Winner: API away team -> ${apiTeamForA === 'away' ? 'Team A' : 'Team B'}`);
              }
            }
          }
        }
      }
      
      const { error: updateError } = await supabase
        .from('matches')
        .update(updateData)
        .eq('id', matchId);

      if (updateError) {
        console.error('Error updating match:', updateError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to update match in database' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          match: {
            eventKey: matchingEvent.event_key,
            homeTeam: matchingEvent.event_home_team,
            awayTeam: matchingEvent.event_away_team,
            homeScore: scoreA || '-',
            awayScore: scoreB || '-',
            homeOvers: homeOvers,
            awayOvers: awayOvers,
            status: matchingEvent.event_status,
            statusInfo: matchingEvent.event_status_info,
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'getLiveScore') {
      // Search past 7 days for completed matches too
      let matchingEvent = await findMatchingEvent(true);

      if (matchingEvent) {
        console.log(`Found matching event: ${matchingEvent.event_home_team} vs ${matchingEvent.event_away_team}`);
        console.log(`Event status: ${matchingEvent.event_status}, Event key: ${matchingEvent.event_key}`);
        console.log(`Scorecard available: ${!!matchingEvent.scorecard}, Type: ${typeof matchingEvent.scorecard}`);
        
        // If no scorecard data in the initial response, fetch detailed event data
        if (!matchingEvent.scorecard && matchingEvent.event_key && matchingEvent.event_date_start) {
          console.log('No scorecard in initial response, fetching detailed event data...');
          const detailedEvent = await fetchEventDetails(matchingEvent.event_key, matchingEvent.event_date_start);
          if (detailedEvent) {
            matchingEvent = detailedEvent;
            console.log(`Detailed fetch - Scorecard available: ${!!matchingEvent.scorecard}`);
          }
        }
        
        if (matchingEvent.scorecard) {
          console.log(`Scorecard keys: ${Object.keys(matchingEvent.scorecard).join(', ')}`);
        }
        
        // Parse scorecard for batting/bowling details
        let batsmen: any[] = [];
        let bowlers: any[] = [];
        let extras: any[] = [];
        
        // Scorecard can be an object with innings keys (e.g., "Team 1 INN") or an array
        if (matchingEvent.scorecard) {
          const scorecardData = matchingEvent.scorecard;
          
          // Handle scorecard as object with innings keys
          if (typeof scorecardData === 'object' && !Array.isArray(scorecardData)) {
            Object.entries(scorecardData).forEach(([inningsKey, players]: [string, any]) => {
              // Track extras for this innings
              let inningsExtras = {
                wides: 0,
                noballs: 0,
                byes: 0,
                legbyes: 0,
                total: 0,
                team: inningsKey.replace(/ \d+ INN$/, ''),
                innings: inningsKey,
              };
              
              if (Array.isArray(players)) {
                players.forEach((player: any) => {
                  if (player.type === 'Batsman') {
                    batsmen.push({
                      player: player.player,
                      runs: player.R || '0',
                      balls: player.B || '0',
                      fours: player['4s'] || '0',
                      sixes: player['6s'] || '0',
                      sr: player.SR || '0.00',
                      how_out: player.status || 'not out',
                      team: inningsKey.replace(/ \d+ INN$/, ''),
                      innings: inningsKey,
                    });
                  } else if (player.type === 'Bowler') {
                    bowlers.push({
                      player: player.player,
                      overs: player.O || '0',
                      maidens: player.M || '0',
                      runs: player.R || '0',
                      wickets: player.W || '0',
                      econ: player.ER || '0.00',
                      team: inningsKey.replace(/ \d+ INN$/, ''),
                      innings: inningsKey,
                    });
                  } else if (player.type === 'Extra' || player.player?.toLowerCase().includes('extra')) {
                    // Parse extras from the scorecard
                    const extraRuns = parseInt(player.R) || 0;
                    inningsExtras.total = extraRuns;
                    // Try to extract breakdown if available from player info or status
                    if (player.status) {
                      const status = player.status.toLowerCase();
                      const wdMatch = status.match(/wd[:\s]*(\d+)/i) || status.match(/wide[s]?[:\s]*(\d+)/i);
                      const nbMatch = status.match(/nb[:\s]*(\d+)/i) || status.match(/no.?ball[s]?[:\s]*(\d+)/i);
                      const bMatch = status.match(/\bb[:\s]*(\d+)/i) || status.match(/bye[s]?[:\s]*(\d+)/i);
                      const lbMatch = status.match(/lb[:\s]*(\d+)/i) || status.match(/leg.?bye[s]?[:\s]*(\d+)/i);
                      
                      if (wdMatch) inningsExtras.wides = parseInt(wdMatch[1]) || 0;
                      if (nbMatch) inningsExtras.noballs = parseInt(nbMatch[1]) || 0;
                      if (bMatch) inningsExtras.byes = parseInt(bMatch[1]) || 0;
                      if (lbMatch) inningsExtras.legbyes = parseInt(lbMatch[1]) || 0;
                    }
                  }
                });
              }
              
              // Add extras for this innings
              extras.push(inningsExtras);
            });
          }
          // Handle scorecard as array (legacy format)
          else if (Array.isArray(scorecardData)) {
            scorecardData.forEach((innings: any) => {
              if (innings.batting && Array.isArray(innings.batting)) {
                batsmen = [...batsmen, ...innings.batting.map((b: any) => ({
                  ...b,
                  team: innings.team,
                  innings: innings.innings,
                }))];
              }
              if (innings.bowling && Array.isArray(innings.bowling)) {
                bowlers = [...bowlers, ...innings.bowling.map((b: any) => ({
                  ...b,
                  team: innings.team,
                  innings: innings.innings,
                }))];
              }
              // Handle extras in array format
              if (innings.extras) {
                extras.push({
                  wides: innings.extras.wides || 0,
                  noballs: innings.extras.noballs || 0,
                  byes: innings.extras.byes || 0,
                  legbyes: innings.extras.legbyes || 0,
                  total: innings.extras.total || 0,
                  team: innings.team,
                  innings: innings.innings,
                });
              }
            });
          }
        }
        
        // Also try to get extras and overs from the 'extra' field in the event
        const extraFieldData: Record<string, any> = {};
        if (matchingEvent.extra && typeof matchingEvent.extra === 'object') {
          console.log('Extra field data:', JSON.stringify(matchingEvent.extra));
          
          // Parse the extra field to get total overs and extras per innings
          Object.entries(matchingEvent.extra).forEach(([inningsKey, inningsData]: [string, any]) => {
            if (Array.isArray(inningsData) && inningsData.length > 0) {
              const firstEntry = inningsData[0];
              extraFieldData[inningsKey] = {
                totalOvers: firstEntry.total_overs || null,
                total: firstEntry.total || null,
              };
              
              // Also update/add extras from the extra field since it's more reliable
              const teamName = inningsKey.replace(/ \d+ INN$/i, '').trim();
              const extrasTotal = parseInt(firstEntry.total) || 0;
              
              if (extrasTotal > 0) {
                // Find existing extras entry for this innings or add new one
                const existingExtrasIdx = extras.findIndex(e => e.innings === inningsKey);
                if (existingExtrasIdx >= 0) {
                  extras[existingExtrasIdx].total = extrasTotal;
                } else {
                  extras.push({
                    wides: 0,
                    noballs: 0,
                    byes: 0,
                    legbyes: 0,
                    total: extrasTotal,
                    team: teamName,
                    innings: inningsKey,
                  });
                }
              }
            }
          });
        }
        
        console.log(`Parsed ${batsmen.length} batsmen, ${bowlers.length} bowlers, ${extras.length} extras entries`);
        
        // Calculate overs - first try API fields, then extra field data
        let homeOvers = matchingEvent.event_home_overs || null;
        let awayOvers = matchingEvent.event_away_overs || null;
        
        // If overs not available from API, try to get from extra field data
        if (!homeOvers || !awayOvers) {
          const homeTeamLower = (matchingEvent.event_home_team || '').toLowerCase();
          const awayTeamLower = (matchingEvent.event_away_team || '').toLowerCase();
          
          // Look through extra field data to find overs for each team
          Object.entries(extraFieldData).forEach(([inningsKey, data]) => {
            const inningsTeam = inningsKey.replace(/ \d+ INN$/i, '').toLowerCase().trim();
            
            // Check if this innings belongs to home or away team
            if (inningsTeam.includes(homeTeamLower.split(' ')[0]) || homeTeamLower.includes(inningsTeam.split(' ')[0])) {
              // This innings is for the home team
              if (!homeOvers && data.totalOvers) {
                homeOvers = data.totalOvers;
              }
            } else if (inningsTeam.includes(awayTeamLower.split(' ')[0]) || awayTeamLower.includes(inningsTeam.split(' ')[0])) {
              // This innings is for the away team
              if (!awayOvers && data.totalOvers) {
                awayOvers = data.totalOvers;
              }
            }
          });
        }
        
        console.log(`Overs - Home: ${homeOvers}, Away: ${awayOvers}`);
        
        return new Response(
          JSON.stringify({
            success: true,
            match: {
              eventKey: matchingEvent.event_key,
              homeTeam: matchingEvent.event_home_team,
              awayTeam: matchingEvent.event_away_team,
              homeTeamLogo: matchingEvent.event_home_team_logo,
              awayTeamLogo: matchingEvent.event_away_team_logo,
              homeScore: matchingEvent.event_home_final_result || '-',
              awayScore: matchingEvent.event_away_final_result || '-',
              homeOvers: homeOvers,
              awayOvers: awayOvers,
              homeRunRate: matchingEvent.event_home_rr,
              awayRunRate: matchingEvent.event_away_rr,
              status: matchingEvent.event_status,
              statusInfo: matchingEvent.event_status_info,
              eventLive: matchingEvent.event_live === '1',
              eventType: matchingEvent.event_type,
              toss: matchingEvent.event_toss,
              venue: matchingEvent.event_stadium,
              leagueName: matchingEvent.league_name,
              extra: matchingEvent.extra,
              scorecard: matchingEvent.scorecard,
              batsmen,
              bowlers,
              extras,
            }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        console.log('No matching event found for teams:', teamAName, teamBName);
        return new Response(
          JSON.stringify({ success: true, match: null }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (action === 'syncLineups' && matchId) {
      // Sync playing XI / lineups from API Cricket
      const { teamAId, teamBId } = body;
      
      if (!teamAId || !teamBId) {
        return new Response(
          JSON.stringify({ success: false, error: 'teamAId and teamBId are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Search past 7 days for the match
      const matchingEvent = await findMatchingEvent(true);
      
      if (!matchingEvent) {
        return new Response(
          JSON.stringify({ success: false, error: 'No matching event found in API Cricket' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If no lineups in initial response, fetch detailed event
      let eventData = matchingEvent;
      if (!eventData.lineups && eventData.event_key && eventData.event_date_start) {
        const detailed = await fetchEventDetails(eventData.event_key, eventData.event_date_start);
        if (detailed) eventData = detailed;
      }

      if (!eventData.lineups) {
        return new Response(
          JSON.stringify({ success: false, error: 'No lineups data available for this match in API Cricket' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const lineups = eventData.lineups;
      const homeLineup = lineups.home_team?.starting_lineups || [];
      const awayLineup = lineups.away_team?.starting_lineups || [];

      if (homeLineup.length === 0 && awayLineup.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Lineups are empty for this match' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Map API home/away to our team_a/team_b
      const apiHomeTeam = eventData.event_home_team || '';
      const apiAwayTeam = eventData.event_away_team || '';
      
      const teamAMatchesAway = teamANormalized && (
        normalizeTeamName(apiAwayTeam).includes(teamANormalized) || 
        teamANormalized.includes(normalizeTeamName(apiAwayTeam))
      );
      const teamAMatchesHome = teamANormalized && (
        normalizeTeamName(apiHomeTeam).includes(teamANormalized) || 
        teamANormalized.includes(normalizeTeamName(apiHomeTeam))
      );
      
      let lineupForA = homeLineup;
      let lineupForB = awayLineup;
      
      if (teamAMatchesAway && !teamAMatchesHome) {
        lineupForA = awayLineup;
        lineupForB = homeLineup;
        console.log(`[syncLineups] Team A maps to API away team`);
      } else {
        console.log(`[syncLineups] Team A maps to API home team`);
      }

      // Delete existing players for this match
      const { error: deleteError } = await supabase
        .from('match_playing_xi')
        .delete()
        .eq('match_id', matchId);

      if (deleteError) {
        console.error('Error deleting existing players:', deleteError);
      }

      // Build player records - cap Playing XI at 11, rest go to bench
      const playersToInsert: any[] = [];

      // Also get substitutes
      const homeSubs = lineups.home_team?.substitutes || [];
      const awaySubs = lineups.away_team?.substitutes || [];
      const subsForA = (teamAMatchesAway && !teamAMatchesHome) ? awaySubs : homeSubs;
      const subsForB = (teamAMatchesAway && !teamAMatchesHome) ? homeSubs : awaySubs;

      // Helper: add players with 11-cap for Playing XI
      const addTeamPlayers = (lineup: any[], subs: any[], teamId: string) => {
        // First 11 from starting_lineups = Playing XI, rest = bench
        const xi = lineup.slice(0, 11);
        const overflowToBench = lineup.slice(11);
        
        xi.forEach((p: any, idx: number) => {
          playersToInsert.push({
            match_id: matchId,
            team_id: teamId,
            player_name: p.player || p.player_name || 'Unknown',
            player_role: p.player_type || null,
            is_captain: p.player_captain === '1' || false,
            is_bench: false,
            batting_order: idx + 1,
            is_vice_captain: false,
            is_wicket_keeper: (p.player_type || '').toLowerCase().includes('keeper') || false,
          });
        });
        
        // Combine overflow + subs as bench
        const allBench = [...overflowToBench, ...subs];
        allBench.forEach((p: any, idx: number) => {
          playersToInsert.push({
            match_id: matchId,
            team_id: teamId,
            player_name: p.player || p.player_name || 'Unknown',
            player_role: p.player_type || null,
            is_captain: false,
            is_bench: true,
            batting_order: idx + 1,
            is_vice_captain: false,
            is_wicket_keeper: (p.player_type || '').toLowerCase().includes('keeper') || false,
          });
        });
      };

      addTeamPlayers(lineupForA, subsForA, teamAId);
      addTeamPlayers(lineupForB, subsForB, teamBId);

      if (playersToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('match_playing_xi')
          .insert(playersToInsert);

        if (insertError) {
          console.error('Error inserting players:', insertError);
          return new Response(
            JSON.stringify({ success: false, error: 'Failed to save lineups to database' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      console.log(`[syncLineups] Saved ${playersToInsert.length} players (TeamA: ${lineupForA.length}+${subsForA.length} subs, TeamB: ${lineupForB.length}+${subsForB.length} subs)`);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Synced ${playersToInsert.length} players from API Cricket lineups`,
          teamACount: lineupForA.length,
          teamBCount: lineupForB.length,
          teamASubsCount: subsForA.length,
          teamBSubsCount: subsForB.length,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'getEventDetails' && eventKey) {
      // Fetch specific event details
      const today = new Date().toISOString().split('T')[0];
      const url = `https://apiv2.api-cricket.com/cricket/?method=get_events&APIkey=${apiKey}&event_key=${eventKey}&date_start=${today}&date_stop=${today}`;
      
      console.log(`Fetching event details for event_key: ${eventKey}`);
      
      const response = await fetchWithRetry(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return new Response(
          JSON.stringify({ success: false, error: `API request failed: ${response.status}` }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      
      if (data.success === 1 && data.result?.length > 0) {
        const event = data.result[0];
        return new Response(
          JSON.stringify({
            success: true,
            match: {
              eventKey: event.event_key,
              homeTeam: event.event_home_team,
              awayTeam: event.event_away_team,
              homeTeamLogo: event.event_home_team_logo,
              awayTeamLogo: event.event_away_team_logo,
              homeScore: event.event_home_final_result || '-',
              awayScore: event.event_away_final_result || '-',
              homeRunRate: event.event_home_rr,
              awayRunRate: event.event_away_rr,
              status: event.event_status,
              statusInfo: event.event_status_info,
              eventLive: event.event_live === '1',
              eventType: event.event_type,
              toss: event.event_toss,
              venue: event.event_stadium,
              leagueName: event.league_name,
              extra: event.extra,
              scorecard: event.scorecard,
              comments: event.comments,
              wickets: event.wickets,
            }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: true, match: null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('API Cricket edge function error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
