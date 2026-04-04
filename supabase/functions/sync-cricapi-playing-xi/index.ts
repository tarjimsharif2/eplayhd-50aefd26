import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CricApiPlayer {
  id: string;
  name: string;
  role: string;
  battingStyle?: string;
  bowlingStyle?: string;
  country?: string;
  playerImg?: string;
}

interface CricApiTeam {
  teamName: string;
  shortname: string;
  img?: string;
  players: CricApiPlayer[];
}

interface CricApiResponse {
  apikey: string;
  data: CricApiTeam[];
  status: string;
  info?: {
    hitsToday: number;
    hitsUsed: number;
    hitsLimit: number;
  };
}

interface CricApiMatch {
  id: string;
  name: string;
  matchType: string;
  status: string;
  venue: string;
  date: string;
  dateTimeGMT: string;
  teams: string[];
  teamInfo?: Array<{
    name: string;
    shortname: string;
    img?: string;
  }>;
  score?: Array<{
    r: number;
    w: number;
    o: number;
    inning: string;
  }>;
  series_id?: string;
  fantasyEnabled?: boolean;
  bbbEnabled?: boolean;
  hasSquad?: boolean;
  matchStarted?: boolean;
  matchEnded?: boolean;
}

interface CricApiMatchesResponse {
  apikey: string;
  data: CricApiMatch[];
  status: string;
  info?: {
    hitsToday: number;
    hitsUsed: number;
    hitsLimit: number;
  };
}

// Normalize team name for matching
function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*(women|men|u19|u-19|under-19|under 19)\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Map CricAPI role to our role format
function mapRole(role: string): string | null {
  if (!role || role === '--') return null;
  
  const roleMap: Record<string, string> = {
    'batsman': 'Batsman',
    'bowler': 'Bowler',
    'batting allrounder': 'All-rounder',
    'bowling allrounder': 'All-rounder',
    'allrounder': 'All-rounder',
    'wk-batsman': 'Wicket-keeper',
    'wicketkeeper': 'Wicket-keeper',
  };
  
  const lower = role.toLowerCase().trim();
  return roleMap[lower] || role;
}

// Check if role indicates wicket keeper
function isWicketKeeper(role: string): boolean {
  const lower = (role || '').toLowerCase();
  return lower.includes('wk') || lower.includes('wicket') || lower.includes('keeper');
}

// Match API team to our team using name comparison
function matchTeam(
  apiTeam: CricApiTeam,
  teamAName: string,
  teamAShortName: string,
  teamBName: string,
  teamBShortName: string,
  teamAId: string,
  teamBId: string
): string | null {
  const apiName = normalizeTeamName(apiTeam.teamName);
  const apiShort = apiTeam.shortname?.toLowerCase().trim() || '';
  
  const nameA = normalizeTeamName(teamAName);
  const shortA = teamAShortName?.toLowerCase().trim() || '';
  const nameB = normalizeTeamName(teamBName);
  const shortB = teamBShortName?.toLowerCase().trim() || '';
  
  // Exact matches
  if (apiName === nameA || apiShort === shortA) return teamAId;
  if (apiName === nameB || apiShort === shortB) return teamBId;
  
  // Partial matches
  if (apiName.includes(nameA) || nameA.includes(apiName)) return teamAId;
  if (apiName.includes(nameB) || nameB.includes(apiName)) return teamBId;
  
  // Short name in full name
  if (apiName.includes(shortA) || shortA.includes(apiShort)) return teamAId;
  if (apiName.includes(shortB) || shortB.includes(apiShort)) return teamBId;
  
  return null;
}

// Fetch with retry logic for transient network errors
async function fetchWithRetry(url: string, maxRetries = 3, timeoutMs = 15000): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });
      
      clearTimeout(timeoutId);
      return res;
    } catch (err: any) {
      console.warn(`[CricAPI] Fetch attempt ${attempt}/${maxRetries} failed: ${err.message}`);
      if (attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }
  throw new Error('All fetch retries exhausted');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { matchId, teamAId, teamBId, teamAName, teamAShortName, teamBName, teamBShortName, cricapiMatchId: providedCricapiId, clientSquadData, isMatchXI } = await req.json();

    if (!matchId) {
      return new Response(JSON.stringify({ success: false, error: 'matchId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[CricAPI ${isMatchXI ? 'Match XI' : 'Squad'}] Processing for match ${matchId}`);

    // Get the match to find cricapi_match_id
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('cricapi_match_id')
      .eq('id', matchId)
      .single();

    if (matchError || !match) {
      console.error('[CricAPI Squad] Match not found:', matchError);
      return new Response(JSON.stringify({ success: false, error: 'Match not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let cricapiMatchId = providedCricapiId || match.cricapi_match_id;
    let autoDetected = false;

    // Save the provided match ID if it's new
    if (providedCricapiId && providedCricapiId !== match.cricapi_match_id) {
      autoDetected = true;
      const { error: updateError } = await supabase
        .from('matches')
        .update({ cricapi_match_id: providedCricapiId })
        .eq('id', matchId);

      if (updateError) {
        console.warn('[CricAPI Squad] Failed to save match ID:', updateError);
      } else {
        console.log(`[CricAPI Squad] Saved new CricAPI match ID: ${cricapiMatchId}`);
      }
    }

    // Use client-provided squad data (browser fetches it since CricAPI blocks edge function IPs)
    let apiData: CricApiResponse;
    
    if (clientSquadData) {
      console.log('[CricAPI Squad] Using client-provided squad data');
      apiData = clientSquadData as CricApiResponse;
    } else {
      // Fallback: try fetching from edge function (may fail if IP is blocked)
      const { data: settings } = await supabase
        .from('site_settings')
        .select('cricket_api_key')
        .limit(1)
        .maybeSingle();

      if (!settings?.cricket_api_key || !cricapiMatchId) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'CricAPI key or match ID not available. Squad data must be provided from client.' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const apiEndpoint = isMatchXI ? 'match_xi' : 'match_squad';
      const apiUrl = `https://api.cricapi.com/v1/${apiEndpoint}?apikey=${settings.cricket_api_key}&id=${cricapiMatchId}`;
      console.log(`[CricAPI Squad] Fallback: fetching from API`);

      const response = await fetchWithRetry(apiUrl);
      if (!response.ok) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: `CricAPI returned status ${response.status}` 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      apiData = await response.json();
    }

    console.log(`[CricAPI Squad] Data status: ${apiData.status}, teams: ${apiData.data?.length || 0}`);

    if (apiData.status !== 'success' || !apiData.data || apiData.data.length < 2) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: `CricAPI returned: ${apiData.status}. Teams found: ${apiData.data?.length || 0}. Need at least 2 teams.`,
        info: apiData.info
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Match API teams to our teams
    const teamMapping: Record<string, string> = {};

    for (const apiTeam of apiData.data) {
      const matchedTeamId = matchTeam(
        apiTeam, teamAName, teamAShortName, teamBName, teamBShortName, teamAId, teamBId
      );
      
      if (matchedTeamId) {
        teamMapping[apiTeam.teamName] = matchedTeamId;
        console.log(`[CricAPI Squad] Matched "${apiTeam.teamName}" → ${matchedTeamId === teamAId ? teamAName : teamBName}`);
      } else {
        console.warn(`[CricAPI Squad] Could not match team: "${apiTeam.teamName}"`);
      }
    }

    // If we couldn't match both teams, try positional fallback
    if (Object.keys(teamMapping).length < 2 && apiData.data.length >= 2) {
      console.log('[CricAPI Squad] Using positional fallback for team matching');
      teamMapping[apiData.data[0].teamName] = teamAId;
      teamMapping[apiData.data[1].teamName] = teamBId;
    }

    // Delete existing players for this match
    const { error: deleteError } = await supabase
      .from('match_playing_xi')
      .delete()
      .eq('match_id', matchId);

    if (deleteError) {
      console.error('[CricAPI Squad] Failed to clear existing players:', deleteError);
      throw deleteError;
    }

    // Build a set of playing XI player names for matching bench
    const playingXINames = new Set<string>();

    // Insert players for each team
    const allPlayers: any[] = [];
    let teamACount = 0;
    let teamBCount = 0;

    for (const apiTeam of apiData.data) {
      const teamId = teamMapping[apiTeam.teamName];
      if (!teamId) continue;

      for (let i = 0; i < apiTeam.players.length; i++) {
        const player = apiTeam.players[i];
        
        if (isMatchXI) {
          playingXINames.add(player.name.toLowerCase().trim());
        }

        allPlayers.push({
          match_id: matchId,
          team_id: teamId,
          player_name: player.name,
          player_role: mapRole(player.role),
          is_captain: false,
          is_vice_captain: false,
          is_wicket_keeper: isWicketKeeper(player.role),
          batting_order: i + 1,
          is_bench: isMatchXI ? false : true,
          player_image: (player.playerImg && !player.playerImg.includes('icon512.png') && !player.playerImg.includes('/img/icon')) ? player.playerImg : null,
        });

        if (teamId === teamAId) teamACount++;
        else teamBCount++;
      }
    }

    // If isMatchXI and full squad data is available, add bench players
    const fullSquadData = (apiData as any)._fullSquadData as CricApiResponse | undefined;
    if (isMatchXI && fullSquadData && fullSquadData.data) {
      console.log(`[CricAPI] Adding bench players from full squad data`);
      
      // Build team mapping for full squad (reuse same logic)
      const fullTeamMapping: Record<string, string> = {};
      for (const apiTeam of fullSquadData.data) {
        const matchedTeamId = matchTeam(
          apiTeam, teamAName, teamAShortName, teamBName, teamBShortName, teamAId, teamBId
        );
        if (matchedTeamId) {
          fullTeamMapping[apiTeam.teamName] = matchedTeamId;
        }
      }
      if (Object.keys(fullTeamMapping).length < 2 && fullSquadData.data.length >= 2) {
        fullTeamMapping[fullSquadData.data[0].teamName] = teamAId;
        fullTeamMapping[fullSquadData.data[1].teamName] = teamBId;
      }

      let benchCount = 0;
      for (const apiTeam of fullSquadData.data) {
        const teamId = fullTeamMapping[apiTeam.teamName];
        if (!teamId) continue;

        for (const player of apiTeam.players) {
          const playerKey = player.name.toLowerCase().trim();
          if (!playingXINames.has(playerKey)) {
            allPlayers.push({
              match_id: matchId,
              team_id: teamId,
              player_name: player.name,
              player_role: mapRole(player.role),
              is_captain: false,
              is_vice_captain: false,
              is_wicket_keeper: isWicketKeeper(player.role),
              batting_order: null,
              is_bench: true,
              player_image: (player.playerImg && !player.playerImg.includes('icon512.png') && !player.playerImg.includes('/img/icon')) ? player.playerImg : null,
            });
            benchCount++;
            if (teamId === teamAId) teamACount++;
            else teamBCount++;
          }
        }
      }
      console.log(`[CricAPI] Added ${benchCount} bench players from full squad`);
    }

    if (allPlayers.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No players found in API response' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: insertError } = await supabase
      .from('match_playing_xi')
      .insert(allPlayers);

    if (insertError) {
      console.error('[CricAPI Squad] Failed to insert players:', insertError);
      throw insertError;
    }

    const autoMsg = autoDetected ? ` (Match ID auto-detected: ${cricapiMatchId})` : '';
    console.log(`[CricAPI Squad] Successfully added ${allPlayers.length} players (${teamACount} + ${teamBCount})${autoMsg}`);

    return new Response(JSON.stringify({
      success: true,
      totalPlayers: allPlayers.length,
      teamA: { count: teamACount },
      teamB: { count: teamBCount },
      info: apiData.info,
      autoDetected,
      cricapiMatchId,
      message: `${allPlayers.length} players added from CricAPI (${teamACount} + ${teamBCount})${autoMsg}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[CricAPI Squad] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
