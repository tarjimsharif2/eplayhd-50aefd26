import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePublicSiteSettings } from '@/hooks/usePublicSiteSettings';

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
  isSub?: boolean;
  formation?: string;
  formationPlace?: number;
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

interface SyncResult {
  matchId: string;
  teamA: string;
  teamB: string;
  scoreA: string | null;
  scoreB: string | null;
  status: string;
  updated: boolean;
}

// Normalize team name for matching
function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+fc$/i, '')
    .replace(/\s+united$/i, ' utd')
    .replace(/\s+city$/i, '')
    .replace(/manchester\s+/i, 'man ')
    .replace(/tottenham\s+hotspur/i, 'spurs')
    .replace(/wolverhampton\s+wanderers/i, 'wolves')
    .replace(/west\s+ham\s+united/i, 'west ham')
    .replace(/newcastle\s+united/i, 'newcastle')
    .replace(/\s+/g, ' ')
    .trim();
}

// Match team names with fuzzy matching
function teamsMatch(dbTeam: string, apiTeam: string): boolean {
  const normalizedDb = normalizeTeamName(dbTeam);
  const normalizedApi = normalizeTeamName(apiTeam);
  
  // Exact match
  if (normalizedDb === normalizedApi) return true;
  
  // One contains the other
  if (normalizedDb.includes(normalizedApi) || normalizedApi.includes(normalizedDb)) return true;
  
  // Word-based matching
  const dbWords = normalizedDb.split(' ').filter(w => w.length > 2);
  const apiWords = normalizedApi.split(' ').filter(w => w.length > 2);
  
  const matchingWords = dbWords.filter(w => apiWords.includes(w));
  if (matchingWords.length >= 1 && matchingWords.length >= Math.min(dbWords.length, apiWords.length) * 0.5) {
    return true;
  }
  
  return false;
}

export function useFootballScoreSync(intervalSeconds: number = 60) {
  const queryClient = useQueryClient();
  const { data: siteSettings } = usePublicSiteSettings();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSyncingRef = useRef(false);

  const syncScores = useCallback(async (): Promise<SyncResult[]> => {
    if (isSyncingRef.current) {
      console.log('[Football Sync] Already syncing, skipping...');
      return [];
    }

    isSyncingRef.current = true;
    const results: SyncResult[] = [];

    try {
      console.log('[Football Sync] Starting sync...');

      // Get all live AND completed (within last 48h) football matches from database
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
          team_a:teams!matches_team_a_id_fkey(name, short_name),
          team_b:teams!matches_team_b_id_fkey(name, short_name),
          sport:sports!matches_sport_id_fkey(name)
        `)
        .in('status', ['live', 'completed'])
        .eq('is_active', true);

      if (matchError) {
        console.error('[Football Sync] Error fetching matches:', matchError);
        return results;
      }

      // Filter only football matches with auto_sync enabled
      // For completed matches, sync if completed within last 48 hours
      const now = new Date();
      const footballMatches = (liveMatches || []).filter(m => {
        const isFootball = m.sport?.name?.toLowerCase() === 'football' || 
                          m.sport?.name?.toLowerCase().includes('football');
        const hasAutoSync = m.auto_sync_enabled === true;
        
        if (!isFootball || !hasAutoSync) return false;
        
        // For completed matches, sync if match started within last 48 hours
        if (m.status === 'completed' && m.match_start_time) {
          const matchTime = new Date(m.match_start_time);
          const hoursSinceMatch = (now.getTime() - matchTime.getTime()) / (1000 * 60 * 60);
          return hoursSinceMatch <= 48;
        }
        
        return true;
      });

      if (footballMatches.length === 0) {
        console.log('[Football Sync] No football matches with auto-sync enabled');
        return results;
      }

      console.log(`[Football Sync] Found ${footballMatches.length} football matches to sync`);
      
      // Check which matches need lineup data
      const matchIds = footballMatches.map(m => m.id);
      const { data: existingLineups } = await supabase
        .from('match_playing_xi')
        .select('match_id')
        .in('match_id', matchIds);
      
      const matchesWithLineup = new Set((existingLineups || []).map(l => l.match_id));
      const matchesNeedingLineup = footballMatches.filter(m => !matchesWithLineup.has(m.id));
      
      console.log(`[Football Sync] ${matchesNeedingLineup.length} matches need lineup data`);

      // Fetch scores from ESPN API (all leagues) with details for lineup/subs
      const { data: apiResponse, error: apiError } = await supabase.functions.invoke(
        'scrape-football-scores',
        { body: { allLeagues: true, includeDetails: true } }
      );

      if (apiError || !apiResponse?.success) {
        console.error('[Football Sync] API error:', apiError || apiResponse?.error);
        return results;
      }

      const apiMatches: FootballMatch[] = apiResponse.matches || [];
      console.log(`[Football Sync] API returned ${apiMatches.length} matches`);

      // Match and update scores
      for (const dbMatch of footballMatches) {
        const teamAName = dbMatch.team_a?.name || '';
        const teamAShort = dbMatch.team_a?.short_name || '';
        const teamBName = dbMatch.team_b?.name || '';
        const teamBShort = dbMatch.team_b?.short_name || '';
        const teamAId = dbMatch.team_a_id;
        const teamBId = dbMatch.team_b_id;

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
          const newScoreA = isReversed ? matchedApi.awayScore : matchedApi.homeScore;
          const newScoreB = isReversed ? matchedApi.homeScore : matchedApi.awayScore;
          
          // Get goal events (swap if reversed)
          const goalsTeamA = isReversed ? matchedApi.awayGoals : matchedApi.homeGoals;
          const goalsTeamB = isReversed ? matchedApi.homeGoals : matchedApi.awayGoals;
          
          // Get lineup (swap if reversed)
          const lineupTeamA = isReversed ? matchedApi.awayLineup : matchedApi.homeLineup;
          const lineupTeamB = isReversed ? matchedApi.homeLineup : matchedApi.awayLineup;
          
          // Get substitutions (swap if reversed)
          const subsTeamA = isReversed ? matchedApi.awaySubs : matchedApi.homeSubs;
          const subsTeamB = isReversed ? matchedApi.homeSubs : matchedApi.awaySubs;
          
          // Parse minute from API
          let newMinute: number | null = null;
          if (matchedApi.minute) {
            const minuteMatch = matchedApi.minute.match(/(\d+)/);
            if (minuteMatch) {
              newMinute = parseInt(minuteMatch[1], 10);
            }
          }

          // Determine new status
          let newStatus = dbMatch.status;
          if (matchedApi.status === 'Completed') {
            newStatus = 'completed';
          } else if (matchedApi.status === 'Half Time') {
            newStatus = 'live';
            newMinute = 45;
          }

          // Check if update needed
          const scoreChanged = newScoreA !== dbMatch.score_a || newScoreB !== dbMatch.score_b;
          const minuteChanged = newMinute !== null && newMinute !== dbMatch.match_minute;
          const statusChanged = newStatus !== dbMatch.status;
          const hasGoalData = goalsTeamA?.length || goalsTeamB?.length;
          const hasLineupData = lineupTeamA?.length || lineupTeamB?.length;
          const hasSubsData = subsTeamA?.length || subsTeamB?.length;

          if (scoreChanged || minuteChanged || statusChanged || hasGoalData) {
            const updateData: Record<string, unknown> = {};
            
            if (newScoreA !== null) updateData.score_a = newScoreA;
            if (newScoreB !== null) updateData.score_b = newScoreB;
            if (newMinute !== null) updateData.match_minute = newMinute;
            if (statusChanged) updateData.status = newStatus;
            if (goalsTeamA) updateData.goals_team_a = goalsTeamA;
            if (goalsTeamB) updateData.goals_team_b = goalsTeamB;
            updateData.last_api_sync = new Date().toISOString();

            const { error: updateError } = await supabase
              .from('matches')
              .update(updateData)
              .eq('id', dbMatch.id);

            if (updateError) {
              console.error(`[Football Sync] Error updating match ${dbMatch.id}:`, updateError);
            } else {
              console.log(`[Football Sync] Updated ${teamAName} vs ${teamBName}: ${newScoreA}-${newScoreB} (${newMinute}')`);
              results.push({
                matchId: dbMatch.id,
                teamA: teamAName,
                teamB: teamBName,
                scoreA: newScoreA,
                scoreB: newScoreB,
                status: newStatus,
                updated: true,
              });
            }
          }
          
          // Sync lineup data to match_playing_xi table
          if (hasLineupData) {
            try {
              // Check if lineup already exists
              const { data: existingLineup } = await supabase
                .from('match_playing_xi')
                .select('id')
                .eq('match_id', dbMatch.id)
                .limit(1);
              
              // Only insert if no lineup exists
              if (!existingLineup || existingLineup.length === 0) {
                const lineupInserts = [];
                
                // Team A lineup
                if (lineupTeamA) {
                  for (let i = 0; i < lineupTeamA.length; i++) {
                    const player = lineupTeamA[i];
                    const jerseyNumber = player.jerseyNumber != null ? parseInt(String(player.jerseyNumber), 10) : NaN;
                    lineupInserts.push({
                      match_id: dbMatch.id,
                      team_id: teamAId,
                      player_name: player.name,
                      player_role: player.position || null,
                      batting_order: Number.isFinite(jerseyNumber) ? jerseyNumber : i + 1,
                      jersey_number: Number.isFinite(jerseyNumber) ? jerseyNumber : null,
                      formation: player.formation || null,
                      formation_place: player.formationPlace || null,
                      is_captain: player.isCaptain || false,
                      is_vice_captain: false,
                      is_bench: !!player.isSub,
                    });
                  }
                }
                
                // Team B lineup
                if (lineupTeamB) {
                  for (let i = 0; i < lineupTeamB.length; i++) {
                    const player = lineupTeamB[i];
                    const jerseyNumber = player.jerseyNumber != null ? parseInt(String(player.jerseyNumber), 10) : NaN;
                    lineupInserts.push({
                      match_id: dbMatch.id,
                      team_id: teamBId,
                      player_name: player.name,
                      player_role: player.position || null,
                      batting_order: Number.isFinite(jerseyNumber) ? jerseyNumber : i + 1,
                      jersey_number: Number.isFinite(jerseyNumber) ? jerseyNumber : null,
                      formation: player.formation || null,
                      formation_place: player.formationPlace || null,
                      is_captain: player.isCaptain || false,
                      is_vice_captain: false,
                      is_bench: !!player.isSub,
                    });
                  }
                }
                
                if (lineupInserts.length > 0) {
                  const { error: lineupError } = await supabase
                    .from('match_playing_xi')
                    .insert(lineupInserts);
                  
                  if (lineupError) {
                    console.error(`[Football Sync] Error inserting lineup:`, lineupError);
                  } else {
                    console.log(`[Football Sync] Inserted ${lineupInserts.length} players for ${teamAName} vs ${teamBName}`);
                  }
                }
              }
            } catch (lineupErr) {
              console.error('[Football Sync] Lineup sync error:', lineupErr);
            }
          }
          
          // Sync substitution data to match_substitutions table
          if (hasSubsData) {
            try {
              // Get existing subs with full details for proper duplicate check
              const { data: existingSubs } = await supabase
                .from('match_substitutions')
                .select('id, minute, player_in, player_out')
                .eq('match_id', dbMatch.id);
              
              // Use combination of minute + player_in + player_out for duplicate detection
              const existingSubsSet = new Set(
                (existingSubs || []).map(s => `${s.minute}-${s.player_in}-${s.player_out}`)
              );
              
              const subsInserts = [];
              
              // Team A subs - filter out Unknown entries
              if (subsTeamA) {
                for (const sub of subsTeamA) {
                  // Skip Unknown entries
                  if (!sub.playerIn || !sub.playerOut || 
                      sub.playerIn === 'Unknown' || sub.playerOut === 'Unknown') {
                    continue;
                  }
                  const key = `${sub.minute}-${sub.playerIn}-${sub.playerOut}`;
                  if (!existingSubsSet.has(key)) {
                    subsInserts.push({
                      match_id: dbMatch.id,
                      team_id: teamAId,
                      player_out: sub.playerOut,
                      player_in: sub.playerIn,
                      minute: sub.minute,
                    });
                    // Add to set to avoid duplicates within same batch
                    existingSubsSet.add(key);
                  }
                }
              }
              
              // Team B subs - filter out Unknown entries
              if (subsTeamB) {
                for (const sub of subsTeamB) {
                  // Skip Unknown entries
                  if (!sub.playerIn || !sub.playerOut || 
                      sub.playerIn === 'Unknown' || sub.playerOut === 'Unknown') {
                    continue;
                  }
                  const key = `${sub.minute}-${sub.playerIn}-${sub.playerOut}`;
                  if (!existingSubsSet.has(key)) {
                    subsInserts.push({
                      match_id: dbMatch.id,
                      team_id: teamBId,
                      player_out: sub.playerOut,
                      player_in: sub.playerIn,
                      minute: sub.minute,
                    });
                    // Add to set to avoid duplicates within same batch
                    existingSubsSet.add(key);
                  }
                }
              }
              
              if (subsInserts.length > 0) {
                const { error: subsError } = await supabase
                  .from('match_substitutions')
                  .insert(subsInserts);
                
                if (subsError) {
                  console.error(`[Football Sync] Error inserting subs:`, subsError);
                } else {
                  console.log(`[Football Sync] Inserted ${subsInserts.length} substitutions for ${teamAName} vs ${teamBName}`);
                }
              }
            } catch (subsErr) {
              console.error('[Football Sync] Subs sync error:', subsErr);
            }
          }
        } else {
          console.log(`[Football Sync] No API match found for ${teamAName} vs ${teamBName}`);
        }
      }

      // Invalidate queries to refresh UI
      if (results.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['matches'] });
        queryClient.invalidateQueries({ queryKey: ['playing_xi'] });
        queryClient.invalidateQueries({ queryKey: ['substitutions'] });
      }

      console.log(`[Football Sync] Sync complete. Updated ${results.length} matches.`);

    } catch (error) {
      console.error('[Football Sync] Sync error:', error);
    } finally {
      isSyncingRef.current = false;
    }

    return results;
  }, [queryClient]);

  useEffect(() => {
    // Initial sync
    syncScores();

    // Set up interval
    intervalRef.current = setInterval(() => {
      syncScores();
    }, intervalSeconds * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [syncScores, intervalSeconds]);

  return { syncScores };
}
