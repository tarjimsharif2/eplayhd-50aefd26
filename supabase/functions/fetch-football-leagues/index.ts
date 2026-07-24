import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ESPN API endpoints to discover leagues
const ESPN_ENDPOINTS = [
  'https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard',
];

interface LeagueInfo {
  code: string;
  name: string;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[fetch-football-leagues] Starting league fetch...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const leagues = new Map<string, LeagueInfo>();
    
    // Fetch from ESPN all scoreboard
    for (const endpoint of ESPN_ENDPOINTS) {
      try {
        console.log(`[fetch-football-leagues] Fetching from: ${endpoint}`);
        
        const response = await fetch(endpoint, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        
        if (!response.ok) {
          console.error(`[fetch-football-leagues] Error fetching ${endpoint}: ${response.status}`);
          continue;
        }
        
        const data = await response.json();
        
        // Extract leagues from the response
        if (data.leagues && Array.isArray(data.leagues)) {
          for (const league of data.leagues) {
            if (league.slug && league.name) {
              const code = league.slug;
              if (!leagues.has(code)) {
                leagues.set(code, {
                  code: code,
                  name: league.name,
                });
                console.log(`[fetch-football-leagues] Found league: ${code} - ${league.name}`);
              }
            }
          }
        }
        
        // Also check events for league info
        if (data.events && Array.isArray(data.events)) {
          for (const event of data.events) {
            if (event.league?.slug && event.league?.name) {
              const code = event.league.slug;
              if (!leagues.has(code)) {
                leagues.set(code, {
                  code: code,
                  name: event.league.name,
                });
                console.log(`[fetch-football-leagues] Found league from event: ${code} - ${event.league.name}`);
              }
            }
          }
        }
      } catch (error) {
        console.error(`[fetch-football-leagues] Error processing ${endpoint}:`, error);
      }
    }
    
    // Add some common leagues that might not appear in scoreboard
    const commonLeagues: LeagueInfo[] = [
      { code: 'eng.1', name: 'Premier League' },
      { code: 'esp.1', name: 'La Liga' },
      { code: 'ger.1', name: 'Bundesliga' },
      { code: 'ita.1', name: 'Serie A' },
      { code: 'fra.1', name: 'Ligue 1' },
      { code: 'uefa.champions', name: 'UEFA Champions League' },
      { code: 'uefa.europa', name: 'UEFA Europa League' },
      { code: 'uefa.europa.conf', name: 'UEFA Conference League' },
      { code: 'fifa.world', name: 'FIFA World Cup' },
      { code: 'fifa.cwc', name: 'FIFA Club World Cup' },
      { code: 'fifa.friendly', name: 'International Friendly' },
      { code: 'uefa.euro', name: 'UEFA European Championship' },
      { code: 'uefa.euroq', name: 'UEFA Euro Qualifiers' },
      { code: 'uefa.nations', name: 'UEFA Nations League' },
      { code: 'conmebol.libertadores', name: 'Copa Libertadores' },
      { code: 'conmebol.sudamericana', name: 'Copa Sudamericana' },
      { code: 'arg.1', name: 'Liga Profesional Argentina' },
      { code: 'bra.1', name: 'Brasileirão Série A' },
      { code: 'mex.1', name: 'Liga MX' },
      { code: 'usa.1', name: 'MLS' },
      { code: 'ned.1', name: 'Eredivisie' },
      { code: 'por.1', name: 'Primeira Liga' },
      { code: 'tur.1', name: 'Süper Lig' },
      { code: 'sco.1', name: 'Scottish Premiership' },
      { code: 'bel.1', name: 'Belgian Pro League' },
      { code: 'sau.1', name: 'Saudi Pro League' },
      { code: 'ind.1', name: 'Indian Super League' },
      { code: 'jpn.1', name: 'J1 League' },
      { code: 'kor.1', name: 'K League 1' },
      { code: 'chn.1', name: 'Chinese Super League' },
      { code: 'aus.1', name: 'A-League Men' },
      { code: 'eng.2', name: 'EFL Championship' },
      { code: 'eng.3', name: 'EFL League One' },
      { code: 'eng.4', name: 'EFL League Two' },
      { code: 'esp.2', name: 'La Liga 2' },
      { code: 'ger.2', name: '2. Bundesliga' },
      { code: 'ita.2', name: 'Serie B' },
      { code: 'fra.2', name: 'Ligue 2' },
      { code: 'eng.fa', name: 'FA Cup' },
      { code: 'eng.league_cup', name: 'EFL Cup' },
      { code: 'esp.copa_del_rey', name: 'Copa del Rey' },
      { code: 'ger.dfb_pokal', name: 'DFB Pokal' },
      { code: 'ita.coppa_italia', name: 'Coppa Italia' },
      { code: 'fra.coupe_de_france', name: 'Coupe de France' },
      { code: 'eng.community_shield', name: 'Community Shield' },
      { code: 'esp.super_cup', name: 'Supercopa de España' },
      { code: 'uefa.super_cup', name: 'UEFA Super Cup' },
      { code: 'conmebol.america', name: 'Copa America' },
      { code: 'concacaf.gold', name: 'CONCACAF Gold Cup' },
      { code: 'concacaf.nations.league', name: 'CONCACAF Nations League' },
      { code: 'afc.asian.cup', name: 'AFC Asian Cup' },
      { code: 'caf.nations', name: 'Africa Cup of Nations' },
      { code: 'fifa.worldq.uefa', name: 'FIFA World Cup Qualifiers (UEFA)' },
      { code: 'fifa.worldq.conmebol', name: 'FIFA World Cup Qualifiers (CONMEBOL)' },
      { code: 'fifa.worldq.afc', name: 'FIFA World Cup Qualifiers (AFC)' },
      { code: 'fifa.worldq.caf', name: 'FIFA World Cup Qualifiers (CAF)' },
      { code: 'fifa.worldq.concacaf', name: 'FIFA World Cup Qualifiers (CONCACAF)' },
      { code: 'club.friendly', name: 'Club Friendly' },
      { code: 'uefa.wchampions', name: 'UEFA Women\'s Champions League' },
      { code: 'fifa.wworld', name: 'FIFA Women\'s World Cup' },
    ];
    
    for (const league of commonLeagues) {
      if (!leagues.has(league.code)) {
        leagues.set(league.code, league);
      }
    }
    
    console.log(`[fetch-football-leagues] Total leagues found: ${leagues.size}`);
    
    // Upsert leagues to database
    const leagueArray = Array.from(leagues.values());
    let insertedCount = 0;
    let updatedCount = 0;
    
    for (const league of leagueArray) {
      const { data: existing } = await supabase
        .from('football_leagues')
        .select('id')
        .eq('league_code', league.code)
        .maybeSingle();
      
      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('football_leagues')
          .update({
            league_name: league.name,
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('league_code', league.code);
        
        if (!error) updatedCount++;
      } else {
        // Insert new
        const { error } = await supabase
          .from('football_leagues')
          .insert({
            league_code: league.code,
            league_name: league.name,
            is_active: true,
          });
        
        if (!error) insertedCount++;
      }
    }
    
    console.log(`[fetch-football-leagues] Inserted: ${insertedCount}, Updated: ${updatedCount}`);
    
    return new Response(
      JSON.stringify({
        success: true,
        total: leagues.size,
        inserted: insertedCount,
        updated: updatedCount,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[fetch-football-leagues] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
