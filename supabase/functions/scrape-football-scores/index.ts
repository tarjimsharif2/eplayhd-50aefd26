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
  matchUrl: string | null;
  startTime: string | null;
  venue?: string | null;
  eventId?: string;
  round?: string | null;
  homeTeamLogo?: string | null;
  awayTeamLogo?: string | null;
  homeGoals?: GoalEvent[];
  awayGoals?: GoalEvent[];
  homeLineup?: PlayerInfo[];
  awayLineup?: PlayerInfo[];
  homeSubs?: SubstitutionEvent[];
  awaySubs?: SubstitutionEvent[];
}

// ESPN API endpoints for different leagues (fallback if DB is empty)
const ESPN_LEAGUES_FALLBACK: Record<string, string> = {
  'epl': 'eng.1',          // English Premier League
  'laliga': 'esp.1',       // La Liga
  'bundesliga': 'ger.1',   // Bundesliga
  'seriea': 'ita.1',       // Serie A
  'ligue1': 'fra.1',       // Ligue 1
  'ucl': 'uefa.champions', // UEFA Champions League
  'uel': 'uefa.europa',    // UEFA Europa League
  'mls': 'usa.1',          // MLS
  'worldcup': 'fifa.world',
};

const ESPN_LEAGUE_ALIASES: Record<string, string> = {
  'sau.1': 'ksa.1',
  'sau.psl': 'ksa.1',
  'ksa.psl': 'ksa.1',
  'ksa.spl': 'ksa.1',
};

function normalizeESPNLeagueCode(league: string): string {
  const rawCode = ESPN_LEAGUES_FALLBACK[league as keyof typeof ESPN_LEAGUES_FALLBACK] || league;
  const key = rawCode.trim().toLowerCase();
  return ESPN_LEAGUE_ALIASES[key] || rawCode.trim();
}

// Helper to get all active league codes from database
async function getActiveLeagueCodes(): Promise<string[]> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('No Supabase credentials, using fallback leagues');
      return Object.values(ESPN_LEAGUES_FALLBACK);
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data: leagues, error } = await supabase
      .from('football_leagues')
      .select('league_code')
      .eq('is_active', true);
    
    if (error || !leagues || leagues.length === 0) {
      console.log('No leagues in DB or error, using fallback leagues:', error?.message);
      return Object.values(ESPN_LEAGUES_FALLBACK);
    }
    
    console.log(`Found ${leagues.length} active leagues in database`);
    return [...new Set(leagues.map(l => normalizeESPNLeagueCode(l.league_code)).filter(Boolean))];
  } catch (err) {
    console.error('Error fetching leagues from DB:', err);
    return Object.values(ESPN_LEAGUES_FALLBACK);
  }
}

// TheSportsDB: fetch all players of a team and return name->image map
// Circuit breaker + per-invocation cache to avoid hammering on 429s
let theSportsDBDisabled = false;
const theSportsDBCache = new Map<string, Map<string, string>>();
async function fetchTheSportsDBPlayerImages(teamName: string): Promise<Map<string, string>> {
  const imageMap = new Map<string, string>();
  if (theSportsDBDisabled) return imageMap;
  const cacheKey = teamName.toLowerCase();
  if (theSportsDBCache.has(cacheKey)) return theSportsDBCache.get(cacheKey)!;
  try {
    // Free API key "3" for TheSportsDB v1
    const url = `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?t=${encodeURIComponent(teamName)}`;
    console.log(`[TheSportsDB] Fetching players for team: ${teamName}`);
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    if (!response.ok) {
      console.warn(`[TheSportsDB] API returned ${response.status} for team: ${teamName}`);
      if (response.status === 429) {
        theSportsDBDisabled = true;
        console.warn('[TheSportsDB] Rate limited — disabling for the rest of this invocation');
      }
      theSportsDBCache.set(cacheKey, imageMap);
      return imageMap;
    }
    const data = await response.json();
    const players = data?.player || [];
    for (const p of players) {
      const name = p.strPlayer as string;
      // Prefer cutout (transparent bg), then thumb, then render
      const image = (p.strCutout || p.strThumb || p.strRender) as string | null;
      if (name && image) {
        // Store with lowercase key for fuzzy matching
        imageMap.set(name.toLowerCase(), image);
      }
    }
    console.log(`[TheSportsDB] Found ${imageMap.size} player images for ${teamName}`);
  } catch (err) {
    console.warn(`[TheSportsDB] Error fetching players for ${teamName}:`, err);
  }
  theSportsDBCache.set(cacheKey, imageMap);
  return imageMap;
}

// Match a player name against TheSportsDB map (fuzzy: last name match)
function findTheSportsDBImage(playerName: string, imageMap: Map<string, string>): string | undefined {
  if (imageMap.size === 0) return undefined;
  const lowerName = playerName.toLowerCase();
  // Exact match first
  if (imageMap.has(lowerName)) return imageMap.get(lowerName);
  // Try last name match
  const parts = lowerName.split(' ');
  const lastName = parts[parts.length - 1];
  if (lastName.length >= 3) {
    for (const [key, url] of imageMap) {
      if (key.endsWith(lastName) || key.includes(lastName)) {
        return url;
      }
    }
  }
  // Try first name match for single-name players (e.g., "Neymar")
  if (parts.length === 1 && lowerName.length >= 4) {
    for (const [key, url] of imageMap) {
      if (key.includes(lowerName)) return url;
    }
  }
  return undefined;
}

// Fill missing player images using TheSportsDB as fallback
async function enrichLineupWithTheSportsDB(
  homeLineup: PlayerInfo[], awayLineup: PlayerInfo[],
  homeTeamName: string, awayTeamName: string
): Promise<void> {
  const homeMissing = homeLineup.some(p => !p.playerImage);
  const awayMissing = awayLineup.some(p => !p.playerImage);
  
  // Always try to enrich - TheSportsDB can fill in missing images
  console.log(`[TheSportsDB] Enriching: Home missing ${homeLineup.filter(p => !p.playerImage).length}/${homeLineup.length}, Away missing ${awayLineup.filter(p => !p.playerImage).length}/${awayLineup.length}`);
  
  // Fetch both teams in parallel
  const [homeImages, awayImages] = await Promise.all([
    homeMissing ? fetchTheSportsDBPlayerImages(homeTeamName) : Promise.resolve(new Map<string, string>()),
    awayMissing ? fetchTheSportsDBPlayerImages(awayTeamName) : Promise.resolve(new Map<string, string>()),
  ]);
  
  let filled = 0;
  for (const player of homeLineup) {
    if (!player.playerImage) {
      const img = findTheSportsDBImage(player.name, homeImages);
      if (img) { player.playerImage = img; filled++; }
    }
  }
  for (const player of awayLineup) {
    if (!player.playerImage) {
      const img = findTheSportsDBImage(player.name, awayImages);
      if (img) { player.playerImage = img; filled++; }
    }
  }
  console.log(`[TheSportsDB] Filled ${filled} player images`);
}

// Helper to safely extract headshot URL from ESPN player data
// ONLY returns explicit headshots from API - constructed CDN URLs return blank placeholders
function getPlayerHeadshot(player: Record<string, unknown>): string | undefined {
  // Check explicit headshot href from API response
  const headshot = player.headshot as Record<string, unknown> | string | undefined;
  if (headshot) {
    if (typeof headshot === 'string' && headshot.startsWith('http')) return headshot;
    if (typeof headshot === 'object' && headshot !== null) {
      const href = headshot.href as string | undefined;
      if (href && typeof href === 'string' && href.startsWith('http')) return href;
    }
  }
  // Also check athlete.headshot if nested
  const athlete = player.athlete as Record<string, unknown> | undefined;
  if (athlete) {
    const athleteHeadshot = athlete.headshot as Record<string, unknown> | string | undefined;
    if (athleteHeadshot) {
      if (typeof athleteHeadshot === 'string' && athleteHeadshot.startsWith('http')) return athleteHeadshot;
      if (typeof athleteHeadshot === 'object' && athleteHeadshot !== null) {
        const href = athleteHeadshot.href as string | undefined;
        if (href && typeof href === 'string' && href.startsWith('http')) return href;
      }
    }
    // DO NOT construct from athlete ID - ESPN CDN returns blank placeholder images
  }
  // DO NOT construct from player ID - ESPN CDN returns blank placeholder images
  return undefined;
}

// Fetch from ESPN public API
// Fetch match detail (lineup, substitutions & goals) from ESPN summary API
async function fetchMatchDetails(eventId: string, leagueCode: string): Promise<{
  homeLineup?: PlayerInfo[];
  awayLineup?: PlayerInfo[];
  homeSubs?: SubstitutionEvent[];
  awaySubs?: SubstitutionEvent[];
  homeGoals?: GoalEvent[];
  awayGoals?: GoalEvent[];
  round?: string;
} | null> {
  try {
    const detailUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueCode}/summary?event=${eventId}`;
    console.log(`Fetching match details: ${detailUrl}`);
    
    const response = await fetch(detailUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    const homeLineup: PlayerInfo[] = [];
    const awayLineup: PlayerInfo[] = [];
    const homeSubs: SubstitutionEvent[] = [];
    const awaySubs: SubstitutionEvent[] = [];
    let round: string | undefined = undefined;
    
    // Extract round/week info from summary API (header.week)
    const headerWeek = data.header?.week?.number;
    if (headerWeek) {
      round = `Round #${headerWeek}`;
      console.log(`[Match ${eventId}] Found week from header: ${round}`);
    }
    
    // Also check header.season.type.week
    if (!round && data.header?.season?.type?.week?.number) {
      round = `Round #${data.header.season.type.week.number}`;
      console.log(`[Match ${eventId}] Found week from season.type: ${round}`);
    }
    
    // Get home/away team IDs from header
    const competition = data.header?.competitions?.[0];
    const competitors = competition?.competitors || [];
    const homeTeamData = competitors.find((c: { homeAway: string }) => c.homeAway === 'home');
    const awayTeamData = competitors.find((c: { homeAway: string }) => c.homeAway === 'away');
    const homeTeamId = homeTeamData?.team?.id;
    const awayTeamId = awayTeamData?.team?.id;
    
    // Method 1: Parse from rosters array
    const rosters = data.rosters || [];
    for (const roster of rosters) {
      const isHome = roster.homeAway === 'home';
      const lineup = isHome ? homeLineup : awayLineup;
      
      for (const entry of roster.roster || []) {
        const player = entry.athlete;
        if (player && entry.starter) {
          const headshotUrl = getPlayerHeadshot(player as Record<string, unknown>);
          lineup.push({
            name: player.displayName || player.fullName || 'Unknown',
            position: entry.position?.abbreviation || player.position?.abbreviation || '',
            jerseyNumber: player.jersey || entry.jersey,
            isCaptain: entry.captain || false,
            playerImage: headshotUrl,
          });
        }
      }
    }
    
    // Method 2: Parse from boxscore.players if rosters empty
    if (homeLineup.length === 0 && awayLineup.length === 0) {
      const boxscorePlayers = data.boxscore?.players || [];
      for (const teamPlayers of boxscorePlayers) {
        const teamId = teamPlayers.team?.id;
        const isHome = teamId === homeTeamId;
        const lineup = isHome ? homeLineup : awayLineup;
        
        for (const statGroup of teamPlayers.statistics || []) {
          if (statGroup.type === 'starters' || statGroup.name?.toLowerCase().includes('starter')) {
            for (const player of statGroup.athletes || []) {
              const athlete = player.athlete || player;
              const headshotUrl = getPlayerHeadshot(athlete as Record<string, unknown>);
              lineup.push({
                name: athlete.displayName || athlete.fullName || 'Unknown',
                position: athlete.position?.abbreviation || player.position?.abbreviation || '',
                jerseyNumber: athlete.jersey,
                isCaptain: false,
                playerImage: headshotUrl,
              });
            }
          }
        }
      }
    }
    
    // Method 3: Parse from gameInfo.officials/formations if available
    if (homeLineup.length === 0 && awayLineup.length === 0) {
      const formations = data.gameInfo?.formations || data.formations || [];
      for (const formation of formations) {
        const teamId = formation.team?.id;
        const isHome = teamId === homeTeamId;
        const lineup = isHome ? homeLineup : awayLineup;
        
        for (const player of formation.players || formation.lineup || []) {
          const headshotUrl = getPlayerHeadshot(player as Record<string, unknown>);
          lineup.push({
            name: player.displayName || player.name || player.fullName || 'Unknown',
            position: player.position?.abbreviation || player.position || '',
            jerseyNumber: player.jersey,
            isCaptain: player.captain || false,
            playerImage: headshotUrl,
          });
        }
      }
    }
    
    // Enrich lineup with TheSportsDB player images (fallback for missing ESPN headshots)
    const homeTeamName = homeTeamData?.team?.displayName || homeTeamData?.team?.shortDisplayName || '';
    const awayTeamName = awayTeamData?.team?.displayName || awayTeamData?.team?.shortDisplayName || '';
    if (homeLineup.length > 0 || awayLineup.length > 0) {
      try {
        await enrichLineupWithTheSportsDB(homeLineup, awayLineup, homeTeamName, awayTeamName);
      } catch (err) {
        console.warn(`[Match ${eventId}] TheSportsDB enrichment failed:`, err);
      }
    }
    
    console.log(`[Match ${eventId}] Found ${homeLineup.length} home players, ${awayLineup.length} away players`);
    
    // Helper to extract player name from various ESPN API structures
    const getPlayerName = (playerObj: Record<string, unknown> | undefined | null): string => {
      if (!playerObj) return '';
      // Direct properties
      if (playerObj.displayName) return String(playerObj.displayName);
      if (playerObj.fullName) return String(playerObj.fullName);
      if (playerObj.shortName) return String(playerObj.shortName);
      if (playerObj.name) return String(playerObj.name);
      // Nested athlete object
      const athlete = playerObj.athlete as Record<string, unknown> | undefined;
      if (athlete) {
        if (athlete.displayName) return String(athlete.displayName);
        if (athlete.fullName) return String(athlete.fullName);
        if (athlete.shortName) return String(athlete.shortName);
        if (athlete.name) return String(athlete.name);
      }
      return '';
    };
    
    // Parse substitutions from keyEvents or plays
    const keyEvents = data.keyEvents || data.plays || [];
    for (const event of keyEvents) {
      if (event.type?.text === 'Substitution' || event.type?.id === '18' || 
          event.text?.toLowerCase().includes('substitution')) {
        const teamId = event.team?.id;
        const isHome = teamId === homeTeamId;
        
        const subsList = isHome ? homeSubs : awaySubs;
        
        // Get players from athletesInvolved (usually [playerOut, playerIn])
        const athletes = event.athletesInvolved || event.participants || [];
        
        // Try to extract player names
        let playerOut = '';
        let playerIn = '';
        
        if (athletes.length >= 2) {
          playerOut = getPlayerName(athletes[0]) || getPlayerName(athletes[1]);
          playerIn = getPlayerName(athletes[1]) || getPlayerName(athletes[0]);
          
          // Sometimes the order is reversed, check by type
          for (const a of athletes) {
            const pType = a.playerType || a.type;
            if (pType === 'playerOff' || pType === 'off') {
              playerOut = getPlayerName(a) || playerOut;
            } else if (pType === 'playerOn' || pType === 'on') {
              playerIn = getPlayerName(a) || playerIn;
            }
          }
        } else if (athletes.length === 1) {
          // Single athlete entry with both players nested
          const entry = athletes[0];
          playerOut = getPlayerName(entry.playerOff) || getPlayerName(entry.off) || getPlayerName(entry);
          playerIn = getPlayerName(entry.playerOn) || getPlayerName(entry.on) || '';
        }
        
        // Also try text parsing as fallback
        if ((!playerOut || !playerIn) && event.text) {
          const subText = String(event.text);
          // Pattern: "Substitution, Team. PlayerIn replaces PlayerOut"
          const replaceMatch = subText.match(/([A-Za-z\s\-']+)\s+replaces\s+([A-Za-z\s\-']+)/i);
          if (replaceMatch) {
            playerIn = playerIn || replaceMatch[1].trim();
            playerOut = playerOut || replaceMatch[2].trim();
          }
        }
        
        // Only add if we have BOTH valid player names (skip Unknown entries)
        if (playerOut && playerIn && playerOut !== 'Unknown' && playerIn !== 'Unknown') {
          const minute = event.clock?.displayValue || event.time?.displayValue || event.period?.displayValue || '';
          // Avoid duplicates within this parsing session
          const exists = subsList.some(s => s.minute === minute && s.playerIn === playerIn && s.playerOut === playerOut);
          if (!exists) {
            subsList.push({
              playerOut,
              playerIn,
              minute,
            });
          }
        }
      }
    }
    
    // Also check details array for substitutions (like goals)
    const details = data.details || competition?.details || [];
    for (const detail of details) {
      if (detail.type?.text === 'Substitution' || detail.type?.id === '18') {
        const teamId = detail.team?.id;
        const isHome = teamId === homeTeamId;
        const subsList = isHome ? homeSubs : awaySubs;
        
        const athletes = detail.athletesInvolved || [];
        let playerOut = '';
        let playerIn = '';
        
        for (const a of athletes) {
          const name = getPlayerName(a);
          const pType = a.playerType || a.type;
          if (pType === 'playerOff' || pType === 'off') {
            playerOut = name;
          } else if (pType === 'playerOn' || pType === 'on') {
            playerIn = name;
          }
        }
        
        // Fallback to array order
        if (!playerOut && !playerIn && athletes.length >= 2) {
          playerOut = getPlayerName(athletes[0]);
          playerIn = getPlayerName(athletes[1]);
        }
        
        const minute = detail.clock?.displayValue || detail.time?.displayValue || '';
        
        // Only add if we have BOTH valid player names (skip Unknown entries)
        // Use full duplicate check with minute, playerIn, AND playerOut
        const exists = subsList.some(s => s.minute === minute && s.playerIn === playerIn && s.playerOut === playerOut);
        if (!exists && playerOut && playerIn && playerOut !== 'Unknown' && playerIn !== 'Unknown') {
          subsList.push({
            playerOut,
            playerIn,
            minute,
          });
        }
      }
    }
    
    console.log(`[Match ${eventId}] Found ${homeSubs.length} home subs, ${awaySubs.length} away subs`);
    
    // Parse goals from multiple sources in summary API
    const homeGoals: GoalEvent[] = [];
    const awayGoals: GoalEvent[] = [];
    
    // Helper to add goal if not duplicate
    const addGoal = (goals: GoalEvent[], goal: GoalEvent) => {
      const exists = goals.some(g => 
        g.player === goal.player && g.minute === goal.minute && g.type === goal.type
      );
      if (!exists && goal.player && goal.player !== 'Unknown') {
        goals.push(goal);
      }
    };
    
    // Source 1: keyEvents array (for goals)
    const goalKeyEvents = data.keyEvents || [];
    for (const event of goalKeyEvents) {
      const typeText = event.type?.text?.toLowerCase() || '';
      const typeId = event.type?.id;
      
      if (typeText.includes('goal') || typeId === '8' || typeId === '58' || typeId === '25') {
        const teamId = event.team?.id;
        // Try multiple ways to determine if home or away
        let isHome = teamId === homeTeamId;
        let isAway = teamId === awayTeamId;
        
        // Fallback: check team name if ID doesn't match
        if (!isHome && !isAway && event.team?.displayName) {
          const teamName = event.team.displayName.toLowerCase();
          const homeTeamName = (homeTeamData?.team?.displayName || '').toLowerCase();
          const awayTeamName = (awayTeamData?.team?.displayName || '').toLowerCase();
          isHome = teamName.includes(homeTeamName) || homeTeamName.includes(teamName);
          isAway = teamName.includes(awayTeamName) || awayTeamName.includes(teamName);
        }
        
        // Fallback: use homeAway property if available
        if (!isHome && !isAway && event.team?.homeAway) {
          isHome = event.team.homeAway === 'home';
          isAway = event.team.homeAway === 'away';
        }
        
        const goalList = isHome ? homeGoals : (isAway ? awayGoals : homeGoals);
        
        const playerName = event.athletesInvolved?.[0]?.displayName || 
                          event.athletesInvolved?.[0]?.fullName ||
                          event.scoringPlay?.scoringPlayer?.displayName ||
                          event.scoringPlay?.scoringPlayer?.fullName ||
                          getPlayerName(event.participants?.[0]) || '';
        
        const goal: GoalEvent = {
          player: playerName,
          minute: event.clock?.displayValue || event.time?.displayValue || '',
          type: typeText.includes('penalty') ? 'penalty' : 
                typeText.includes('own') ? 'own_goal' : 'goal',
        };
        
        // Check for assist
        if (event.athletesInvolved?.length > 1) {
          goal.assist = event.athletesInvolved[1]?.displayName || event.athletesInvolved[1]?.fullName;
        }
        
        addGoal(goalList, goal);
      }
    }
    
    // Source 2: scoringPlays array
    const scoringPlays = data.scoringPlays || data.scoring || [];
    for (const play of scoringPlays) {
      const teamId = play.team?.id;
      // Try multiple ways to determine if home or away
      let isHome = teamId === homeTeamId;
      let isAway = teamId === awayTeamId;
      
      // Fallback: check team name if ID doesn't match
      if (!isHome && !isAway && play.team?.displayName) {
        const teamName = play.team.displayName.toLowerCase();
        const homeTeamName = (homeTeamData?.team?.displayName || '').toLowerCase();
        const awayTeamName = (awayTeamData?.team?.displayName || '').toLowerCase();
        isHome = teamName.includes(homeTeamName) || homeTeamName.includes(teamName);
        isAway = teamName.includes(awayTeamName) || awayTeamName.includes(teamName);
      }
      
      // Fallback: use homeAway property if available
      if (!isHome && !isAway && play.team?.homeAway) {
        isHome = play.team.homeAway === 'home';
        isAway = play.team.homeAway === 'away';
      }
      
      const goalList = isHome ? homeGoals : (isAway ? awayGoals : homeGoals);
      
      const typeText = play.type?.text?.toLowerCase() || '';
      
      const playerName = play.scoringPlayer?.displayName || 
                        play.scoringPlayer?.fullName ||
                        play.athletesInvolved?.[0]?.displayName ||
                        play.athletesInvolved?.[0]?.fullName ||
                        play.scorerName || '';
      
      const goal: GoalEvent = {
        player: playerName,
        minute: play.clock?.displayValue || play.time?.displayValue || play.period?.displayValue || '',
        type: typeText.includes('penalty') ? 'penalty' : 
              typeText.includes('own') ? 'own_goal' : 'goal',
      };
      
      // Check for assist
      const assistName = play.assistPlayer?.displayName || 
                        play.assistPlayer?.fullName ||
                        (play.athletesInvolved?.length > 1 ? play.athletesInvolved[1]?.displayName : null);
      if (assistName) {
        goal.assist = assistName;
      }
      
      addGoal(goalList, goal);
    }
    
    // Source 3: details array (for goals)
    const goalDetails = data.details || competition?.details || [];
    for (const detail of goalDetails) {
      const typeText = detail.type?.text?.toLowerCase() || '';
      const typeId = detail.type?.id;
      
      if (typeText.includes('goal') || typeId === '8' || typeId === '58' || typeId === '25') {
        const teamId = detail.team?.id;
        // Try multiple ways to determine if home or away
        let isHome = teamId === homeTeamId;
        let isAway = teamId === awayTeamId;
        
        // Fallback: check team name if ID doesn't match
        if (!isHome && !isAway && detail.team?.displayName) {
          const teamName = detail.team.displayName.toLowerCase();
          const homeTeamName = (homeTeamData?.team?.displayName || '').toLowerCase();
          const awayTeamName = (awayTeamData?.team?.displayName || '').toLowerCase();
          isHome = teamName.includes(homeTeamName) || homeTeamName.includes(teamName);
          isAway = teamName.includes(awayTeamName) || awayTeamName.includes(teamName);
        }
        
        // Fallback: use homeAway property if available
        if (!isHome && !isAway && detail.team?.homeAway) {
          isHome = detail.team.homeAway === 'home';
          isAway = detail.team.homeAway === 'away';
        }
        
        const goalList = isHome ? homeGoals : (isAway ? awayGoals : homeGoals);
        
        const playerName = detail.athletesInvolved?.[0]?.displayName || 
                          detail.athletesInvolved?.[0]?.fullName || '';
        
        const goal: GoalEvent = {
          player: playerName,
          minute: detail.clock?.displayValue || detail.time?.displayValue || '',
          type: typeText.includes('penalty') ? 'penalty' : 
                typeText.includes('own') ? 'own_goal' : 'goal',
        };
        
        // Check for assist
        if (detail.athletesInvolved?.length > 1) {
          goal.assist = detail.athletesInvolved[1]?.displayName || detail.athletesInvolved[1]?.fullName;
        }
        
        addGoal(goalList, goal);
      }
    }
    
    // Source 4: plays array (timeline of all events)
    const plays = data.plays || [];
    for (const play of plays) {
      const typeText = play.type?.text?.toLowerCase() || '';
      const typeId = play.type?.id;
      
      if (typeText.includes('goal') || typeId === '8' || typeId === '58' || typeId === '25') {
        const teamId = play.team?.id;
        // Try multiple ways to determine if home or away
        let isHome = teamId === homeTeamId;
        let isAway = teamId === awayTeamId;
        
        // Fallback: check team name if ID doesn't match
        if (!isHome && !isAway && play.team?.displayName) {
          const teamName = play.team.displayName.toLowerCase();
          const homeTeamName = (homeTeamData?.team?.displayName || '').toLowerCase();
          const awayTeamName = (awayTeamData?.team?.displayName || '').toLowerCase();
          isHome = teamName.includes(homeTeamName) || homeTeamName.includes(teamName);
          isAway = teamName.includes(awayTeamName) || awayTeamName.includes(teamName);
        }
        
        // Fallback: use homeAway property if available
        if (!isHome && !isAway && play.team?.homeAway) {
          isHome = play.team.homeAway === 'home';
          isAway = play.team.homeAway === 'away';
        }
        
        const goalList = isHome ? homeGoals : (isAway ? awayGoals : homeGoals);
        
        const playerName = play.athletesInvolved?.[0]?.displayName || 
                          play.athletesInvolved?.[0]?.fullName || '';
        
        const goal: GoalEvent = {
          player: playerName,
          minute: play.clock?.displayValue || play.time?.displayValue || '',
          type: typeText.includes('penalty') ? 'penalty' : 
                typeText.includes('own') ? 'own_goal' : 'goal',
        };
        
        // Check for assist
        if (play.athletesInvolved?.length > 1) {
          goal.assist = play.athletesInvolved[1]?.displayName || play.athletesInvolved[1]?.fullName;
        }
        
        addGoal(goalList, goal);
      }
    }
    
    console.log(`[Match ${eventId}] Found ${homeGoals.length} home goals, ${awayGoals.length} away goals from summary API`);
    
    return {
      homeLineup: homeLineup.length > 0 ? homeLineup : undefined,
      awayLineup: awayLineup.length > 0 ? awayLineup : undefined,
      homeSubs: homeSubs.length > 0 ? homeSubs : undefined,
      awaySubs: awaySubs.length > 0 ? awaySubs : undefined,
      homeGoals: homeGoals.length > 0 ? homeGoals : undefined,
      awayGoals: awayGoals.length > 0 ? awayGoals : undefined,
      round,
    };
    
  } catch (error) {
    console.error('Error fetching match details:', error);
    return null;
  }
}

async function fetchESPNScores(league: string = 'epl', includeDetails: boolean = false): Promise<FootballMatch[]> {
  const matches: FootballMatch[] = [];
  // league can be a short alias (epl, ucl) or a full ESPN code (eng.1, uefa.champions)
  const leagueCode = normalizeESPNLeagueCode(league);
  
  try {
    const formatDate = (d: Date) => d.toISOString().split('T')[0].replace(/-/g, '');
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7);

    // ESPN behaves inconsistently across competitions for ranged dates.
    // Strategy:
    // 1) Try ranged dates (fast)
    // 2) If it returns 0 events, fall back to per-day calls (reliable, esp. for some UEFA competitions)
    const rangedUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueCode}/scoreboard?dates=${formatDate(today)}-${formatDate(endDate)}`;
    console.log(`Fetching ESPN API: ${rangedUrl}`);

    const baseHeaders = {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    };

    const fetchEvents = async (url: string): Promise<any[]> => {
      const res = await fetch(url, { headers: baseHeaders });
      if (!res.ok) {
        console.error(`ESPN API error: ${res.status} (${url})`);
        return [];
      }
      const json = await res.json();
      return json?.events || [];
    };

    let events = await fetchEvents(rangedUrl);
    console.log(`ESPN API returned ${events.length} events (ranged)`);

    if (events.length === 0) {
      const perDayEvents: any[] = [];
      const start = new Date(today);
      start.setDate(start.getDate() - 1);

      const cursor = new Date(start);
      while (cursor <= endDate) {
        const dateStr = formatDate(cursor);
        const dayUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueCode}/scoreboard?dates=${dateStr}`;
        const dayEvents = await fetchEvents(dayUrl);
        if (dayEvents.length) {
          perDayEvents.push(...dayEvents);
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      events = perDayEvents;
      console.log(`ESPN API returned ${events.length} events (per-day fallback)`);
    }

    // Extended window fallback: some leagues (FIFA World Cup, Saudi Pro League,
    // off-season comps, future tournaments) have fixtures outside the 7-day window.
    // Try progressively wider windows up to ~12 months ahead, plus 30 days back.
    if (events.length === 0) {
      // Reduced from [30, 90, 180, 365] to save CPU; 90d catches most leagues, 365d covers far-future fixtures
      const wideWindows = [90, 365];
      for (const days of wideWindows) {
        const back = new Date(today);
        back.setDate(back.getDate() - 30);
        const forward = new Date(today);
        forward.setDate(forward.getDate() + days);
        const wideUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueCode}/scoreboard?dates=${formatDate(back)}-${formatDate(forward)}&limit=300`;
        console.log(`Wide window fallback (+${days}d): ${wideUrl}`);
        const wideEvents = await fetchEvents(wideUrl);
        if (wideEvents.length) {
          events = wideEvents;
          console.log(`ESPN API returned ${events.length} events (wide ${days}d window)`);
          break;
        }
      }
    }

    // Final fallback: try the season-based endpoint (no dates param returns current week,
    // but adding seasontype=1 (pre) / 2 (regular) / 3 (post) sometimes surfaces fixtures)
    if (events.length === 0) {
      const seasonYear = today.getFullYear();
      // Only try current season to save CPU
      for (const season of [seasonYear]) {
        const seasonUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueCode}/scoreboard?season=${season}&limit=300`;
        console.log(`Season fallback (${season}): ${seasonUrl}`);
        const sEvents = await fetchEvents(seasonUrl);
        if (sEvents.length) {
          events = sEvents;
          console.log(`ESPN API returned ${events.length} events (season=${season})`);
          break;
        }
      }
    }

    for (const event of events) {
      const competition = event.competitions?.[0];
      if (!competition) continue;
      
      const competitors = competition.competitors || [];
      if (competitors.length < 2) continue;
      
      const homeTeam = competitors.find((c: { homeAway: string }) => c.homeAway === 'home');
      const awayTeam = competitors.find((c: { homeAway: string }) => c.homeAway === 'away');
      
      if (!homeTeam || !awayTeam) continue;
      
      // Determine match status
      let status = 'Scheduled';
      let minute: string | null = null;
      
      const statusType = competition.status?.type?.name || '';
      const statusDetail = competition.status?.type?.detail || '';
      const displayClock = competition.status?.displayClock || '';
      const statusClock = competition.status?.clock || null;
      const statusPeriod = competition.status?.period || 0;
      
      if (statusType === 'STATUS_IN_PROGRESS') {
        status = 'Live';
        // Try multiple sources for match minute
        if (displayClock) {
          minute = displayClock;
        } else if (statusDetail) {
          // statusDetail might be like "69'" or "2nd Half - 69'" or just "2nd Half"
          const minuteFromDetail = statusDetail.match(/(\d+)/);
          if (minuteFromDetail) {
            minute = minuteFromDetail[1] + "'";
          }
        }
        
        // If still no minute, try to calculate from clock (seconds remaining in half)
        if (!minute && statusClock !== null && statusClock !== undefined) {
          const clockSeconds = Number(statusClock);
          if (!isNaN(clockSeconds)) {
            // ESPN clock can be seconds elapsed in the current period
            const periodMinutes = Math.floor(clockSeconds / 60);
            if (statusPeriod === 2) {
              minute = String(45 + periodMinutes) + "'";
            } else {
              minute = String(periodMinutes) + "'";
            }
          }
        }
        
        console.log(`[ESPN] Match minute extraction: displayClock="${displayClock}", statusDetail="${statusDetail}", statusClock=${statusClock}, period=${statusPeriod}, result="${minute}"`);
      } else if (statusType === 'STATUS_HALFTIME') {
        status = 'Half Time';
        minute = 'HT';
      } else if (statusType === 'STATUS_FINAL' || statusType === 'STATUS_FULL_TIME') {
        status = 'Completed';
        minute = 'FT';
      } else if (statusType === 'STATUS_SCHEDULED' || statusType === 'STATUS_POSTPONED') {
        status = statusType === 'STATUS_POSTPONED' ? 'Postponed' : 'Scheduled';
      }
      
      // Parse goal details from competition details
      const homeGoals: GoalEvent[] = [];
      const awayGoals: GoalEvent[] = [];
      
      // Get goal details from details array
      const details = competition.details || [];
      for (const detail of details) {
        if (detail.type?.text === 'Goal' || detail.type?.id === '8' || 
            detail.type?.text === 'Penalty - Scored' || detail.type?.id === '58' ||
            detail.type?.text === 'Own Goal' || detail.type?.id === '25') {
          
          const goalEvent: GoalEvent = {
            player: detail.athletesInvolved?.[0]?.displayName || detail.athletesInvolved?.[0]?.fullName || 'Unknown',
            minute: detail.clock?.displayValue || detail.time?.displayValue || '',
            type: detail.type?.text?.includes('Penalty') ? 'penalty' : 
                  detail.type?.text?.includes('Own') ? 'own_goal' : 'goal',
          };
          
          // Check for assist
          if (detail.athletesInvolved?.length > 1) {
            goalEvent.assist = detail.athletesInvolved[1]?.displayName || detail.athletesInvolved[1]?.fullName;
          }
          
          // Determine which team scored
          const teamId = detail.team?.id;
          if (teamId === homeTeam.team?.id) {
            homeGoals.push(goalEvent);
          } else if (teamId === awayTeam.team?.id) {
            awayGoals.push(goalEvent);
          }
        }
      }
      
      // Build match object
      // Get venue from competition
      const venue = competition.venue?.fullName || competition.venue?.shortName || null;
      
      // Extract round/matchday info from multiple sources in ESPN API
      let round: string | null = null;
      
      // Source 1: event.week.number (most common for league matches)
      if (event.week?.number) {
        round = `Round #${event.week.number}`;
      } else if (event.season?.type?.week?.number) {
        round = `Round #${event.season.type.week.number}`;
      }
      
      // Source 2: Check season.week directly
      if (!round && event.season?.week?.number) {
        round = `Round #${event.season.week.number}`;
      }
      
      // Source 3: Check competition.matchday or competition.week
      if (!round && competition.matchday) {
        round = `Matchday ${competition.matchday}`;
      }
      
      // Source 4: Status detail sometimes contains matchday info
      if (!round) {
        const statusDescription = competition.status?.type?.description || '';
        const statusDetail = competition.status?.type?.detail || '';
        const combined = `${statusDescription} ${statusDetail}`;
        
        const matchdayMatch = combined.match(/(?:Matchday|Round|Gameweek|Week)\s*(\d+)/i);
        if (matchdayMatch) {
          round = `Round #${matchdayMatch[1]}`;
        }
      }
      
      // Source 5: Competition groups sometimes have round info
      if (!round && competition.groups) {
        const groupInfo = Array.isArray(competition.groups) ? competition.groups.join(' ') : String(competition.groups);
        const groupMatch = groupInfo.match(/(?:Matchday|Round|Week)\s*(\d+)/i);
        if (groupMatch) {
          round = `Round #${groupMatch[1]}`;
        }
      }
      
      // Source 6: Event name for knockout stages or round info
      if (!round && event.name) {
        const eventName = event.name;
        
        // Check for league round patterns
        const roundPatterns = [
          /(?:Round|Matchday|Week|Gameweek|Match Day)\s*(\d+)/i,
          /(?:League Phase|Group Stage)\s*-?\s*(?:Matchday|Day|Round)?\s*(\d+)/i,
          /MD\s*(\d+)/i,  // Matchday shortcuts like "MD8"
        ];
        
        for (const pattern of roundPatterns) {
          const match = eventName.match(pattern);
          if (match) {
            round = `Round #${match[1]}`;
            break;
          }
        }
        
        // Check for knockout stages
        if (!round) {
          const knockoutMatch = eventName.match(/(Final|Semi-?Final|Quarter-?Final|Round of \d+|Playoffs?|Group Stage)/i);
          if (knockoutMatch) {
            round = knockoutMatch[1];
          }
        }
      }
      
      // Source 7: Competition notes
      if (!round && competition.notes) {
        const notes = Array.isArray(competition.notes) ? competition.notes.join(' ') : String(competition.notes);
        const noteMatch = notes.match(/(?:Matchday|Round|Week)\s*(\d+)/i);
        if (noteMatch) {
          round = `Round #${noteMatch[1]}`;
        }
      }
      
      // Source 8: competition headlines/shortName
      if (!round && competition.headlines) {
        const headlines = Array.isArray(competition.headlines) 
          ? competition.headlines.map((h: any) => h.shortLinkText || h.description || '').join(' ')
          : String(competition.headlines);
        const headlineMatch = headlines.match(/(?:Matchday|Round|Week)\s*(\d+)/i);
        if (headlineMatch) {
          round = `Round #${headlineMatch[1]}`;
        }
      }
      
      console.log(`Match: ${homeTeam.team?.displayName} vs ${awayTeam.team?.displayName}, Round: ${round}, event.week: ${JSON.stringify(event.week)}`);
      
      
      // Extract team logos from ESPN data
      const homeTeamLogo = homeTeam.team?.logo || homeTeam.team?.logos?.[0]?.href || null;
      const awayTeamLogo = awayTeam.team?.logo || awayTeam.team?.logos?.[0]?.href || null;
      
      const matchObj: FootballMatch = {
        homeTeam: homeTeam.team?.displayName || homeTeam.team?.name || 'Unknown',
        awayTeam: awayTeam.team?.displayName || awayTeam.team?.name || 'Unknown',
        homeScore: homeTeam.score?.toString() || null,
        awayScore: awayTeam.score?.toString() || null,
        status,
        minute,
        // Competition/league name (varies by endpoint/league)
        competition: event?.league?.name || event?.season?.name || event?.name || null,
        matchUrl: event.links?.[0]?.href || null,
        startTime: event.date || null,
        venue,
        eventId: event.id,
        round,
        homeTeamLogo,
        awayTeamLogo,
        homeGoals: homeGoals.length > 0 ? homeGoals : undefined,
        awayGoals: awayGoals.length > 0 ? awayGoals : undefined,
      };
      
      // Fetch detailed lineup, subs & goals if requested
      // Also fetch round info from summary API if not found from scoreboard
      if (includeDetails) {
        const matchDetails = await fetchMatchDetails(event.id, leagueCode);
        if (matchDetails) {
          // Update round from summary API if we didn't find it in scoreboard
          if (!matchObj.round && matchDetails.round) {
            matchObj.round = matchDetails.round;
          }

          // IMPORTANT: lineups are often available BEFORE kickoff.
          // Always attach lineups when present; substitutions only make sense once match has started.
          matchObj.homeLineup = matchDetails.homeLineup;
          matchObj.awayLineup = matchDetails.awayLineup;
          if (status === 'Live' || status === 'Half Time' || status === 'Completed') {
            matchObj.homeSubs = matchDetails.homeSubs;
            matchObj.awaySubs = matchDetails.awaySubs;
          }
          
          // CRITICAL: Merge goals from summary API with scoreboard goals
          // Summary API often has more complete goal data than scoreboard
          if (matchDetails.homeGoals || matchDetails.awayGoals) {
            // Merge home goals
            const mergedHomeGoals = [...(matchObj.homeGoals || [])];
            for (const goal of matchDetails.homeGoals || []) {
              const exists = mergedHomeGoals.some(g => 
                g.player === goal.player && g.minute === goal.minute && g.type === goal.type
              );
              if (!exists && goal.player && goal.player !== 'Unknown') {
                mergedHomeGoals.push(goal);
              }
            }
            if (mergedHomeGoals.length > 0) {
              matchObj.homeGoals = mergedHomeGoals;
            }
            
            // Merge away goals
            const mergedAwayGoals = [...(matchObj.awayGoals || [])];
            for (const goal of matchDetails.awayGoals || []) {
              const exists = mergedAwayGoals.some(g => 
                g.player === goal.player && g.minute === goal.minute && g.type === goal.type
              );
              if (!exists && goal.player && goal.player !== 'Unknown') {
                mergedAwayGoals.push(goal);
              }
            }
            if (mergedAwayGoals.length > 0) {
              matchObj.awayGoals = mergedAwayGoals;
            }
            
            console.log(`[${matchObj.homeTeam} vs ${matchObj.awayTeam}] Merged goals: ${matchObj.homeGoals?.length || 0} home, ${matchObj.awayGoals?.length || 0} away`);
          }
        }
      }
      
      matches.push(matchObj);
    }
    
  } catch (error) {
    console.error('ESPN API error:', error);
  }
  
  return matches;
}

// Fetch ALL active leagues from database (not just hardcoded ones)
async function fetchAllLeagues(includeDetails: boolean = false): Promise<FootballMatch[]> {
  const allMatches: FootballMatch[] = [];
  
  // Get all active leagues from database
  const leagueCodes = await getActiveLeagueCodes();
  console.log(`Fetching ${leagueCodes.length} leagues: ${leagueCodes.join(', ')}`);
  
  // Fetch in batches of 10 to avoid overwhelming the API
  const batchSize = 10;
  for (let i = 0; i < leagueCodes.length; i += batchSize) {
    const batch = leagueCodes.slice(i, i + batchSize);
    const promises = batch.map(leagueCode => fetchESPNScores(leagueCode, includeDetails));
    const results = await Promise.all(promises);
    
    for (const matches of results) {
      allMatches.push(...matches);
    }
  }
  
  // Remove duplicates by eventId
  const seen = new Set<string>();
  const uniqueMatches = allMatches.filter(m => {
    if (!m.eventId) return true; // Keep matches without eventId
    if (seen.has(m.eventId)) return false;
    seen.add(m.eventId);
    return true;
  });
  
  console.log(`Total unique matches from all leagues: ${uniqueMatches.length}`);
  return uniqueMatches;
}

// Extract text content from HTML
function extractText(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

// Decode HTML entities
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// Parse football scores from HTML (fallback for custom URLs)
function parseHTMLScores(html: string): FootballMatch[] {
  const matches: FootballMatch[] = [];
  
  try {
    // Pattern for table rows
    const rowPatterns = [
      /<tr[^>]*>([\s\S]*?)<\/tr>/gi,
      /<div[^>]*class="[^"]*(?:match|game|fixture|result)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    ];

    const potentialMatches: string[] = [];
    for (const pattern of rowPatterns) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(html)) !== null) {
        potentialMatches.push(match[1]);
      }
    }

    for (const matchHtml of potentialMatches) {
      if (matchHtml.length < 50) continue;
      
      const linkPattern = /<a[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>/gi;
      const links: { href: string; text: string }[] = [];
      let linkMatch;
      while ((linkMatch = linkPattern.exec(matchHtml)) !== null) {
        const text = decodeHtmlEntities(extractText(linkMatch[2]));
        if (text.length > 2 && text.length < 50) {
          links.push({ href: linkMatch[1], text });
        }
      }
      
      const numbers = matchHtml.match(/>(\d+)</g)?.map(n => n.replace(/[><]/g, '')) || [];
      
      const teamLinks = links.filter(l => 
        l.href.includes('/club/') || 
        l.href.includes('/team/') || 
        l.href.includes('/en/club/') ||
        l.href.includes('/en/team/')
      );
      
      if (teamLinks.length >= 2) {
        const homeTeam = teamLinks[0].text;
        const awayTeam = teamLinks[1].text;
        
        let homeScore: string | null = null;
        let awayScore: string | null = null;
        
        const scorePattern = /(\d+)\s*[-–:]\s*(\d+)/;
        const scoreMatch = matchHtml.match(scorePattern);
        if (scoreMatch) {
          homeScore = scoreMatch[1];
          awayScore = scoreMatch[2];
        } else if (numbers.length >= 2) {
          homeScore = numbers[0];
          awayScore = numbers[1];
        }
        
        let status = 'Scheduled';
        let minute: string | null = null;
        
        if (matchHtml.toLowerCase().includes('live') || matchHtml.includes("'")) {
          status = 'Live';
        }
        
        const minuteMatch = matchHtml.match(/(\d+(?:\+\d+)?)'|(\d+)\s*min/i);
        if (minuteMatch) {
          minute = (minuteMatch[1] || minuteMatch[2]) + "'";
          status = 'Live';
        }
        
        if (matchHtml.includes('FT') || matchHtml.toLowerCase().includes('full time')) {
          status = 'Completed';
        } else if (matchHtml.includes('HT') || matchHtml.toLowerCase().includes('half time')) {
          status = 'Half Time';
          minute = "45'";
        }
        
        const exists = matches.some(m => 
          m.homeTeam.toLowerCase() === homeTeam.toLowerCase() && 
          m.awayTeam.toLowerCase() === awayTeam.toLowerCase()
        );
        
        if (!exists && homeTeam !== awayTeam) {
          matches.push({
            homeTeam,
            awayTeam,
            homeScore,
            awayScore,
            status,
            minute,
            competition: null,
            matchUrl: teamLinks[0].href.split('/club/')[0] || null,
            startTime: null,
          });
        }
      }
    }
    
  } catch (error) {
    console.error('Error parsing HTML scores:', error);
  }
  
  return matches;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { url, league, allLeagues, matchId, includeDetails } = body;

    console.log(`Football scores request - league: ${league}, allLeagues: ${allLeagues}, includeDetails: ${includeDetails}, url: ${url}`);

    let matches: FootballMatch[] = [];

    // Option 1: Fetch all major leagues
    if (allLeagues) {
      console.log('Fetching all major leagues...');
      matches = await fetchAllLeagues(includeDetails === true);
    }
    // Option 2: Fetch specific league from ESPN
    else if (league) {
      console.log(`Fetching league: ${league}`);
      matches = await fetchESPNScores(league, includeDetails === true);
    }
    // Option 3: Scrape from custom URL (fallback)
    else if (url) {
      console.log(`Scraping custom URL: ${url}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const response = await fetch(url, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Cache-Control': 'no-cache',
        },
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: `Failed to fetch page: ${response.status}` }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const html = await response.text();
      console.log(`Fetched ${html.length} bytes`);
      matches = parseHTMLScores(html);
    }
    // Default: Fetch EPL
    else {
      console.log('No parameters, fetching EPL by default');
      matches = await fetchESPNScores('epl', includeDetails === true);
    }

    // Filter to only live matches if requested
    const liveOnly = body.liveOnly === true;
    if (liveOnly) {
      matches = matches.filter(m => m.status === 'Live' || m.status === 'Half Time');
    }

    console.log(`Returning ${matches.length} matches`);

    return new Response(
      JSON.stringify({
        success: true,
        matches,
        scrapedAt: new Date().toISOString(),
        matchId: matchId || null,
        totalMatches: matches.length,
        source: league || (allLeagues ? 'all-leagues' : (url ? 'custom-url' : 'epl')),
        availableLeagues: Object.keys(ESPN_LEAGUES_FALLBACK),
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: unknown) {
    console.error('Scrape football scores error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
