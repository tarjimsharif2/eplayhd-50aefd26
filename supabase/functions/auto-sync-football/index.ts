import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GoalEvent {
  player: string;
  minute: string;
  assist?: string;
  type: 'goal' | 'penalty' | 'own_goal';
}

interface SubstitutionEvent {
  playerOut: string;
  playerIn: string;
  minute: string;
}

interface PlayerInfo {
  name: string;
  position: string;
  jerseyNumber?: string;
  isCaptain?: boolean;
  playerImage?: string;
}

interface FootballMatch {
  homeTeam: string;
  awayTeam: string;
  homeScore: string | null;
  awayScore: string | null;
  status: string;
  minute: string | null;
  competition: string | null;
  startTime: string | null;
  homeGoals?: GoalEvent[];
  awayGoals?: GoalEvent[];
  homeLineup?: PlayerInfo[];
  awayLineup?: PlayerInfo[];
  homeSubs?: SubstitutionEvent[];
  awaySubs?: SubstitutionEvent[];
}

// Common team name aliases for better matching
const TEAM_ALIASES: Record<string, string[]> = {
  'tottenham': ['tottenham hotspur', 'spurs', 'tottenham hotspur fc'],
  'man city': ['manchester city', 'manchester city fc'],
  'man utd': ['manchester united', 'manchester united fc', 'man united'],
  'wolves': ['wolverhampton wanderers', 'wolverhampton'],
  'brighton': ['brighton & hove albion', 'brighton hove albion', 'brighton and hove albion'],
  'west ham': ['west ham united', 'west ham utd'],
  'newcastle': ['newcastle united', 'newcastle utd'],
  'leeds': ['leeds united', 'leeds utd'],
  'leicester': ['leicester city', 'leicester city fc'],
  'aston villa': ['aston villa fc'],
  'nottm forest': ['nottingham forest', 'notts forest', 'nottingham forest fc'],
  'bournemouth': ['afc bournemouth'],
  'crystal palace': ['crystal palace fc'],
  'everton': ['everton fc'],
  'arsenal': ['arsenal fc'],
  'chelsea': ['chelsea fc'],
  'liverpool': ['liverpool fc'],
  'fulham': ['fulham fc'],
  'brentford': ['brentford fc'],
  'ipswich': ['ipswich town', 'ipswich town fc'],
  'southampton': ['southampton fc'],
  'charlton': ['charlton athletic', 'charlton athletic fc'],
};

// Get all possible name variations for a team
function getTeamVariations(name: string): string[] {
  const normalized = name.toLowerCase().trim();
  const variations = [normalized];
  
  // Add aliases
  for (const [key, aliases] of Object.entries(TEAM_ALIASES)) {
    if (normalized.includes(key) || aliases.some(a => normalized.includes(a))) {
      variations.push(key, ...aliases);
    }
  }
  
  return [...new Set(variations)];
}

// Normalize team name for matching
function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+fc$/i, '')
    .replace(/\s+united$/i, ' utd')
    .replace(/\s+city$/i, '')
    .replace(/manchester\s+/i, 'man ')
    .replace(/tottenham\s+hotspur/i, 'tottenham')
    .replace(/wolverhampton\s+wanderers/i, 'wolves')
    .replace(/west\s+ham\s+united/i, 'west ham')
    .replace(/newcastle\s+united/i, 'newcastle')
    .replace(/brighton\s+(&|and)\s+hove\s+albion/i, 'brighton')
    .replace(/afc\s+bournemouth/i, 'bournemouth')
    .replace(/nottingham\s+forest/i, 'nottm forest')
    .replace(/leicester\s+city/i, 'leicester')
    .replace(/leeds\s+united/i, 'leeds')
    .replace(/charlton\s+athletic/i, 'charlton')
    .replace(/\s+/g, ' ')
    .trim();
}

// Match team names with fuzzy matching
function teamsMatch(dbTeam: string, apiTeam: string): boolean {
  const normalizedDb = normalizeTeamName(dbTeam);
  const normalizedApi = normalizeTeamName(apiTeam);
  
  // Direct match
  if (normalizedDb === normalizedApi) return true;
  
  // Substring match
  if (normalizedDb.includes(normalizedApi) || normalizedApi.includes(normalizedDb)) return true;
  
  // Check aliases
  const dbVariations = getTeamVariations(dbTeam);
  const apiVariations = getTeamVariations(apiTeam);
  
  for (const dbVar of dbVariations) {
    for (const apiVar of apiVariations) {
      if (dbVar === apiVar) return true;
      if (dbVar.includes(apiVar) || apiVar.includes(dbVar)) return true;
    }
  }
  
  // Word matching
  const dbWords = normalizedDb.split(' ').filter(w => w.length > 2);
  const apiWords = normalizedApi.split(' ').filter(w => w.length > 2);
  
  const matchingWords = dbWords.filter(w => apiWords.includes(w));
  if (matchingWords.length >= 1 && matchingWords.length >= Math.min(dbWords.length, apiWords.length) * 0.5) {
    return true;
  }
  
  return false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[auto-sync-football] Starting automatic football score sync...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all live AND recently completed football matches with auto_sync enabled
    const now = new Date();
    const { data: sportsData } = await supabase
      .from('sports')
      .select('id')
      .ilike('name', '%football%');
    
    const footballSportIds = (sportsData || []).map(s => s.id);
    
    if (footballSportIds.length === 0) {
      console.log('[auto-sync-football] No football sport found');
      return new Response(JSON.stringify({ success: true, message: 'No football sport found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get matches: live, completed (48h), and upcoming within 60 minutes
    const { data: liveMatches, error: matchError } = await supabase
      .from('matches')
      .select(`
        id,
        team_a_id,
        team_b_id,
        score_a,
        score_b,
        status,
        match_minute,
        sport_id,
        auto_sync_enabled,
        match_start_time,
        team_a:teams!matches_team_a_id_fkey(name, short_name, aliases),
        team_b:teams!matches_team_b_id_fkey(name, short_name, aliases)
      `)
      .in('status', ['upcoming', 'live', 'completed'])
      .eq('is_active', true)
      .eq('auto_sync_enabled', true)
      .in('sport_id', footballSportIds);

    if (matchError) {
      console.error('[auto-sync-football] Error fetching matches:', matchError);
      throw matchError;
    }

    // Filter: completed within 48h, live always, upcoming within 60 minutes
    const footballMatches = (liveMatches || []).filter(m => {
      if (m.status === 'completed' && m.match_start_time) {
        const matchTime = new Date(m.match_start_time);
        const hoursSinceMatch = (now.getTime() - matchTime.getTime()) / (1000 * 60 * 60);
        return hoursSinceMatch <= 48;
      }
      if (m.status === 'upcoming' && m.match_start_time) {
        const matchTime = new Date(m.match_start_time);
        const minutesUntilMatch = (matchTime.getTime() - now.getTime()) / (1000 * 60);
        // Sync upcoming matches within 60 minutes to get early lineup data
        return minutesUntilMatch <= 60 && minutesUntilMatch >= -10;
      }
      return true; // Live matches always sync
    });

    if (footballMatches.length === 0) {
      console.log('[auto-sync-football] No football matches to sync');
      return new Response(JSON.stringify({ success: true, message: 'No matches to sync', updated: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[auto-sync-football] Found ${footballMatches.length} football matches to sync`);

    // Fetch scores from ESPN API via scrape-football-scores function
    const { data: apiResponse, error: apiError } = await supabase.functions.invoke(
      'scrape-football-scores',
      { body: { allLeagues: true, includeDetails: true } }
    );

    if (apiError || !apiResponse?.success) {
      console.error('[auto-sync-football] API error:', apiError || apiResponse?.error);
      throw new Error(apiError?.message || apiResponse?.error || 'API fetch failed');
    }

    const apiMatches: FootballMatch[] = apiResponse.matches || [];
    console.log(`[auto-sync-football] API returned ${apiMatches.length} matches`);

    let updatedCount = 0;
    const results: { matchId: string; teamA: string; teamB: string; scoreA: string | null; scoreB: string | null }[] = [];
    const matchedDbIds = new Set<string>();

    // Per-match processing logic — used for both ESPN and Sofascore passes.
    async function processOne(dbMatch: any, matchedApi: FootballMatch, isReversed: boolean, source: 'espn' | 'sofa') {
      const teamA = (dbMatch.team_a as unknown) as { name: string; short_name: string } | null;
      const teamB = (dbMatch.team_b as unknown) as { name: string; short_name: string } | null;
      const teamAName = teamA?.name || '';
      const teamBName = teamB?.name || '';
      const teamAId = dbMatch.team_a_id;
      const teamBId = dbMatch.team_b_id;

      const newScoreA = isReversed ? matchedApi.awayScore : matchedApi.homeScore;
      const newScoreB = isReversed ? matchedApi.homeScore : matchedApi.awayScore;
      const goalsTeamA = isReversed ? matchedApi.awayGoals : matchedApi.homeGoals;
      const goalsTeamB = isReversed ? matchedApi.homeGoals : matchedApi.awayGoals;
      const lineupTeamA = isReversed ? matchedApi.awayLineup : matchedApi.homeLineup;
      const lineupTeamB = isReversed ? matchedApi.homeLineup : matchedApi.awayLineup;
      const subsTeamA = isReversed ? matchedApi.awaySubs : matchedApi.homeSubs;
      const subsTeamB = isReversed ? matchedApi.homeSubs : matchedApi.awaySubs;

      let newMinute: number | null = null;
      if (matchedApi.minute) {
        const mm = matchedApi.minute.match(/(\d+)/);
        if (mm) newMinute = parseInt(mm[1], 10);
      }

      let newStatus = dbMatch.status;
      if (matchedApi.status === 'Completed') newStatus = 'completed';
      else if (matchedApi.status === 'Half Time') { newStatus = 'live'; newMinute = 45; }
      else if (matchedApi.status === 'Live') newStatus = 'live';
      else if (dbMatch.status === 'live' && matchedApi.status === 'Scheduled') newStatus = 'live';

      if (newMinute === null && newStatus === 'live' && dbMatch.match_start_time) {
        const startTime = new Date(dbMatch.match_start_time).getTime();
        const elapsedMin = (Date.now() - startTime) / 1000 / 60;
        if (elapsedMin <= 47) newMinute = Math.min(Math.floor(elapsedMin), 45);
        else if (elapsedMin <= 63) newMinute = 45;
        else newMinute = Math.min(Math.floor(elapsedMin - 15), 90);
      }

      const scoreChanged = newScoreA !== dbMatch.score_a || newScoreB !== dbMatch.score_b;
      const minuteChanged = newMinute !== null && newMinute !== dbMatch.match_minute;
      const statusChanged = newStatus !== dbMatch.status;
      const hasGoalData = (goalsTeamA?.length || 0) > 0 || (goalsTeamB?.length || 0) > 0;

      if (scoreChanged || minuteChanged || statusChanged || hasGoalData) {
        const updateData: Record<string, unknown> = {};
        if (newScoreA !== null) updateData.score_a = newScoreA;
        if (newScoreB !== null) updateData.score_b = newScoreB;
        if (newMinute !== null) updateData.match_minute = newMinute;
        if (statusChanged) updateData.status = newStatus;
        if (goalsTeamA) updateData.goals_team_a = goalsTeamA;
        if (goalsTeamB) updateData.goals_team_b = goalsTeamB;
        updateData.last_api_sync = new Date().toISOString();
        const { error: updateError } = await supabase.from('matches').update(updateData).eq('id', dbMatch.id);
        if (!updateError) {
          console.log(`[auto-sync-football][${source}] Updated ${teamAName} vs ${teamBName}: ${newScoreA}-${newScoreB} (${newMinute}')`);
          updatedCount++;
          results.push({ matchId: dbMatch.id, teamA: teamAName, teamB: teamBName, scoreA: newScoreA, scoreB: newScoreB });
        } else {
          console.error(`[auto-sync-football][${source}] update error`, updateError);
        }
      }

      // Lineup sync (same logic as before)
      if (lineupTeamA?.length || lineupTeamB?.length) {
        const { data: existingTeamAPlayers } = await supabase.from('match_playing_xi').select('id, player_image').eq('match_id', dbMatch.id).eq('team_id', teamAId);
        const { data: existingTeamBPlayers } = await supabase.from('match_playing_xi').select('id, player_image').eq('match_id', dbMatch.id).eq('team_id', teamBId);
        const existingTeamACount = existingTeamAPlayers?.length || 0;
        const existingTeamBCount = existingTeamBPlayers?.length || 0;
        const newTeamACount = lineupTeamA?.length || 0;
        const newTeamBCount = lineupTeamB?.length || 0;
        const teamAMissingImages = existingTeamACount > 0 && (existingTeamAPlayers || []).filter(p => !p.player_image).length > existingTeamACount / 2;
        const teamBMissingImages = existingTeamBCount > 0 && (existingTeamBPlayers || []).filter(p => !p.player_image).length > existingTeamBCount / 2;
        const newTeamAHasImages = (lineupTeamA || []).some(p => !!p.playerImage);
        const newTeamBHasImages = (lineupTeamB || []).some(p => !!p.playerImage);
        const needsTeamASync = newTeamACount > 0 && (existingTeamACount === 0 || (existingTeamACount < 11 && newTeamACount > existingTeamACount) || (teamAMissingImages && newTeamAHasImages));
        const needsTeamBSync = newTeamBCount > 0 && (existingTeamBCount === 0 || (existingTeamBCount < 11 && newTeamBCount > existingTeamBCount) || (teamBMissingImages && newTeamBHasImages));
        if (needsTeamASync || needsTeamBSync) {
          const lineupInserts: any[] = [];
          if (needsTeamASync && lineupTeamA) {
            if (existingTeamACount > 0) await supabase.from('match_playing_xi').delete().eq('match_id', dbMatch.id).eq('team_id', teamAId);
            for (let i = 0; i < lineupTeamA.length; i++) {
              const p = lineupTeamA[i];
              lineupInserts.push({ match_id: dbMatch.id, team_id: teamAId, player_name: p.name, player_role: p.position || null, batting_order: i + 1, is_captain: p.isCaptain || false, is_vice_captain: false, player_image: p.playerImage || null });
            }
          }
          if (needsTeamBSync && lineupTeamB) {
            if (existingTeamBCount > 0) await supabase.from('match_playing_xi').delete().eq('match_id', dbMatch.id).eq('team_id', teamBId);
            for (let i = 0; i < lineupTeamB.length; i++) {
              const p = lineupTeamB[i];
              lineupInserts.push({ match_id: dbMatch.id, team_id: teamBId, player_name: p.name, player_role: p.position || null, batting_order: i + 1, is_captain: p.isCaptain || false, is_vice_captain: false, player_image: p.playerImage || null });
            }
          }
          if (lineupInserts.length > 0) {
            const { error: lineupError } = await supabase.from('match_playing_xi').insert(lineupInserts);
            if (lineupError) console.error(`[auto-sync-football][${source}] lineup insert error`, lineupError);
            else console.log(`[auto-sync-football][${source}] inserted ${lineupInserts.length} players`);
          }
        }
      }

      // Substitutions
      if (subsTeamA?.length || subsTeamB?.length) {
        const { data: existingSubs } = await supabase.from('match_substitutions').select('id, minute, player_in, player_out').eq('match_id', dbMatch.id);
        const existingSubsSet = new Set((existingSubs || []).map(s => `${s.minute}-${s.player_in}-${s.player_out}`));
        const subsInserts: any[] = [];
        const push = (arr: SubstitutionEvent[] | undefined, teamId: string) => {
          if (!arr) return;
          for (const sub of arr) {
            if (!sub.playerIn || !sub.playerOut || sub.playerIn === 'Unknown' || sub.playerOut === 'Unknown') continue;
            const key = `${sub.minute}-${sub.playerIn}-${sub.playerOut}`;
            if (!existingSubsSet.has(key)) {
              subsInserts.push({ match_id: dbMatch.id, team_id: teamId, player_out: sub.playerOut, player_in: sub.playerIn, minute: sub.minute });
              existingSubsSet.add(key);
            }
          }
        };
        push(subsTeamA, teamAId);
        push(subsTeamB, teamBId);
        if (subsInserts.length > 0) {
          const { error: subsError } = await supabase.from('match_substitutions').insert(subsInserts);
          if (subsError) console.error(`[auto-sync-football][${source}] subs insert error`, subsError);
          else console.log(`[auto-sync-football][${source}] inserted ${subsInserts.length} subs`);
        }
      }
    }

    // Match and update scores
    for (const dbMatch of footballMatches) {
      const teamA = (dbMatch.team_a as unknown) as { name: string; short_name: string } | null;
      const teamB = (dbMatch.team_b as unknown) as { name: string; short_name: string } | null;
      const teamAName = teamA?.name || '';
      const teamAShort = teamA?.short_name || '';
      const teamBName = teamB?.name || '';
      const teamBShort = teamB?.short_name || '';

      // Find matching API match
      const apiMatch = apiMatches.find(api => {
        const homeMatches = teamsMatch(teamAName, api.homeTeam) || teamsMatch(teamAShort, api.homeTeam);
        const awayMatches = teamsMatch(teamBName, api.awayTeam) || teamsMatch(teamBShort, api.awayTeam);
        return homeMatches && awayMatches;
      });

      // Also check reverse (in case home/away is swapped)
      const apiMatchReverse = !apiMatch ? apiMatches.find(api => {
        const homeMatches = teamsMatch(teamBName, api.homeTeam) || teamsMatch(teamBShort, api.homeTeam);
        const awayMatches = teamsMatch(teamAName, api.awayTeam) || teamsMatch(teamAShort, api.awayTeam);
        return homeMatches && awayMatches;
      }) : null;

      const matchedApi = apiMatch || apiMatchReverse;
      const isReversed = !!apiMatchReverse && !apiMatch;

      if (matchedApi) {
        matchedDbIds.add(dbMatch.id);
        await processOne(dbMatch, matchedApi as FootballMatch, isReversed, 'espn');
      } else {
        console.log(`[auto-sync-football] No ESPN match found for ${teamAName} vs ${teamBName}`);
      }
    }

    // ---- Sofascore fallback for unmatched matches ----
    const unmatched = footballMatches.filter(m => !matchedDbIds.has(m.id));
    if (unmatched.length > 0) {
      console.log(`[auto-sync-football] Trying Sofascore fallback for ${unmatched.length} unmatched matches`);
      const sofaPayload = unmatched.map(m => {
        const ta = m.team_a as any; const tb = m.team_b as any;
        return {
          id: m.id,
          teamA: ta?.name || '',
          teamB: tb?.name || '',
          aliasesA: Array.isArray(ta?.aliases) ? ta.aliases : [],
          aliasesB: Array.isArray(tb?.aliases) ? tb.aliases : [],
        };
      });
      try {
        const { data: sofaResp, error: sofaErr } = await supabase.functions.invoke('scrape-sofascore-football', { body: { matches: sofaPayload } });
        if (sofaErr) {
          console.warn('[auto-sync-football] Sofascore fallback failed:', sofaErr.message);
        } else {
          const sofaMatches: FootballMatch[] = (sofaResp as any)?.matches || [];
          console.log(`[auto-sync-football] Sofascore returned ${sofaMatches.length} matches`);
          for (const sm of sofaMatches) {
            const db = unmatched.find(u => u.id === (sm as any).matchId);
            if (!db) continue;
            // Sofascore output is already oriented to teamA/teamB (home=teamA), so isReversed=false
            await processOne(db, sm, false, 'sofa');
          }
        }
      } catch (e) {
        console.warn('[auto-sync-football] Sofascore fallback exception:', e);
      }
    }


    console.log(`[auto-sync-football] Sync complete. Updated ${updatedCount} matches.`);

    return new Response(JSON.stringify({ 
      success: true, 
      updated: updatedCount,
      results,
      totalMatches: footballMatches.length,
      apiMatchesFound: apiMatches.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[auto-sync-football] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
