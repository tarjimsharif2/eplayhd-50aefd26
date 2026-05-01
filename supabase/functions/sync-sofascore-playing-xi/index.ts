import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SOFA_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.sofascore.com/',
  'Origin': 'https://www.sofascore.com',
};

const PLAYER_IMAGE_URL = (id: string | number) => `https://api.sofascore.com/api/v1/player/${id}/image`;

const normalize = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

async function fetchJson(url: string): Promise<any | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, { headers: SOFA_HEADERS, signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) {
      console.warn(`[sofascore] ${url} -> ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.warn(`[sofascore] fetch error ${url}:`, e);
    return null;
  }
}

async function findEventId(teamAName: string, teamBName: string, matchDate?: string): Promise<string | null> {
  // Try a small window of dates around match date
  const tryDates: string[] = [];
  const base = matchDate ? new Date(matchDate) : new Date();
  for (let offset = -1; offset <= 1; offset++) {
    const d = new Date(base.getTime() + offset * 86400000);
    tryDates.push(d.toISOString().slice(0, 10));
  }

  const aN = normalize(teamAName);
  const bN = normalize(teamBName);

  for (const date of tryDates) {
    const url = `https://api.sofascore.com/api/v1/sport/cricket/scheduled-events/${date}`;
    const data = await fetchJson(url);
    const events = data?.events || [];
    for (const ev of events) {
      const home = normalize(ev?.homeTeam?.name || '');
      const away = normalize(ev?.awayTeam?.name || '');
      const homeMatchA = home && (home.includes(aN) || aN.includes(home));
      const homeMatchB = home && (home.includes(bN) || bN.includes(home));
      const awayMatchA = away && (away.includes(aN) || aN.includes(away));
      const awayMatchB = away && (away.includes(bN) || bN.includes(away));
      if ((homeMatchA && awayMatchB) || (homeMatchB && awayMatchA)) {
        return String(ev.id);
      }
    }
  }
  return null;
}

function mapPosition(pos?: string): string | null {
  if (!pos) return null;
  const p = pos.toLowerCase();
  if (p.includes('keeper') || p === 'wk') return 'Wicket-keeper';
  if (p.includes('bowl')) return 'Bowler';
  if (p.includes('all')) return 'All-rounder';
  if (p.includes('bat')) return 'Batsman';
  return pos;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const { matchId, teamAId, teamBId, teamAName, teamBName, sofascoreEventId: providedEventId } = body || {};

    if (!matchId || !teamAId || !teamBId || !teamAName || !teamBName) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required parameters' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get stored event id if not provided
    let eventId: string | null = providedEventId || null;
    if (!eventId) {
      const { data: matchRow } = await supabase
        .from('matches')
        .select('sofascore_event_id, match_date')
        .eq('id', matchId)
        .maybeSingle();
      eventId = (matchRow as any)?.sofascore_event_id || null;
      if (!eventId) {
        eventId = await findEventId(teamAName, teamBName, (matchRow as any)?.match_date);
        if (eventId) {
          await supabase.from('matches').update({ sofascore_event_id: eventId }).eq('id', matchId);
        }
      }
    }

    if (!eventId) {
      return new Response(JSON.stringify({ success: false, error: 'No matching Sofascore event found' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch lineups
    const lineupsData = await fetchJson(`https://api.sofascore.com/api/v1/event/${eventId}/lineups`);
    if (!lineupsData) {
      return new Response(JSON.stringify({ success: false, error: 'Lineups not available yet from Sofascore', eventId }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sofascore returns { confirmed: bool, home: { players: [...] }, away: { players: [...] } }
    const home = lineupsData?.home || {};
    const away = lineupsData?.away || {};
    const homePlayers: any[] = home?.players || [];
    const awayPlayers: any[] = away?.players || [];

    if (homePlayers.length === 0 && awayPlayers.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'No players in Sofascore lineup yet', eventId }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine which team in our DB corresponds to home / away.
    // Get event detail to read team names if available
    const eventDetail = await fetchJson(`https://api.sofascore.com/api/v1/event/${eventId}`);
    const apiHome = normalize(eventDetail?.event?.homeTeam?.name || eventDetail?.homeTeam?.name || '');
    const apiAway = normalize(eventDetail?.event?.awayTeam?.name || eventDetail?.awayTeam?.name || '');
    const aN = normalize(teamAName);
    const bN = normalize(teamBName);

    let homeMapsTo: string = teamAId;
    let awayMapsTo: string = teamBId;
    if (apiHome && (apiHome.includes(bN) || bN.includes(apiHome))) {
      homeMapsTo = teamBId;
      awayMapsTo = teamAId;
    } else if (apiAway && (apiAway.includes(aN) || aN.includes(apiAway))) {
      homeMapsTo = teamBId;
      awayMapsTo = teamAId;
    }

    const buildRows = (apiPlayers: any[], teamId: string) => {
      // substitute => bench, otherwise starter
      const rows: any[] = [];
      let order = 1;
      const seen = new Set<string>();
      for (const entry of apiPlayers) {
        const p = entry?.player || {};
        const name = p.name || p.shortName;
        if (!name) continue;
        const key = normalize(name);
        if (seen.has(key)) continue;
        seen.add(key);

        const isBench = entry?.substitute === true;
        const isCaptain = entry?.captain === true || p?.captain === true;
        const position = mapPosition(p.position);
        const sofaPlayerId = p.id ? String(p.id) : null;

        rows.push({
          match_id: matchId,
          team_id: teamId,
          player_name: name,
          player_role: position,
          is_captain: isCaptain,
          is_vice_captain: false,
          is_wicket_keeper: position === 'Wicket-keeper',
          is_bench: isBench,
          batting_order: isBench ? null : order++,
          player_image: sofaPlayerId ? PLAYER_IMAGE_URL(sofaPlayerId) : null,
          sofascore_player_id: sofaPlayerId,
        });
      }
      return rows;
    };

    const homeRows = buildRows(homePlayers, homeMapsTo);
    const awayRows = buildRows(awayPlayers, awayMapsTo);

    const homeStarters = homeRows.filter(r => !r.is_bench).length;
    const awayStarters = awayRows.filter(r => !r.is_bench).length;
    const confirmedXI = homeStarters === 11 && awayStarters === 11;

    // If not confirmed, push everyone to bench (do not guess starters)
    const finalRows = confirmedXI
      ? [...homeRows, ...awayRows]
      : [...homeRows, ...awayRows].map(r => ({ ...r, is_bench: true, batting_order: null }));

    // Replace existing players for this match
    await supabase.from('match_playing_xi').delete().eq('match_id', matchId);

    if (finalRows.length > 0) {
      const { error: insertError } = await supabase.from('match_playing_xi').insert(finalRows);
      if (insertError) {
        return new Response(JSON.stringify({ success: false, error: insertError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      eventId,
      confirmedXI,
      playersAdded: finalRows.length,
      homeStarters,
      awayStarters,
      message: confirmedXI
        ? `Synced confirmed Playing XI from Sofascore (${finalRows.length} players)`
        : `Sofascore squad fetched (${finalRows.length} players). Waiting for confirmed XI.`,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[sync-sofascore-playing-xi] error:', error);
    return new Response(JSON.stringify({ success: false, error: String(error?.message || error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});