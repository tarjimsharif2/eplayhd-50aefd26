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
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function findEventId(teamAName: string, teamBName: string, matchDate?: string): Promise<string | null> {
  const tryDates: string[] = [];
  const base = matchDate ? new Date(matchDate) : new Date();
  for (let offset = -1; offset <= 1; offset++) {
    const d = new Date(base.getTime() + offset * 86400000);
    tryDates.push(d.toISOString().slice(0, 10));
  }
  const aN = normalize(teamAName);
  const bN = normalize(teamBName);
  for (const date of tryDates) {
    const data = await fetchJson(`https://api.sofascore.com/api/v1/sport/cricket/scheduled-events/${date}`);
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json().catch(() => ({}));
    const { matchId } = body || {};
    if (!matchId) {
      return new Response(JSON.stringify({ success: false, error: 'matchId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load match with teams
    const { data: match } = await supabase
      .from('matches')
      .select(`id, sofascore_event_id, match_date, team_a_id, team_b_id,
               team_a:teams!matches_team_a_id_fkey(id, name),
               team_b:teams!matches_team_b_id_fkey(id, name)`)
      .eq('id', matchId)
      .maybeSingle();

    if (!match) {
      return new Response(JSON.stringify({ success: false, error: 'Match not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const teamAName = (match.team_a as any)?.name || '';
    const teamBName = (match.team_b as any)?.name || '';

    let eventId: string | null = (match as any).sofascore_event_id || null;
    if (!eventId) {
      eventId = await findEventId(teamAName, teamBName, (match as any).match_date);
      if (eventId) {
        await supabase.from('matches').update({ sofascore_event_id: eventId }).eq('id', matchId);
      }
    }
    if (!eventId) {
      return new Response(JSON.stringify({ success: false, error: 'No Sofascore event found', updated: 0 }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const lineupsData = await fetchJson(`https://api.sofascore.com/api/v1/event/${eventId}/lineups`);
    if (!lineupsData) {
      return new Response(JSON.stringify({ success: false, error: 'No lineups from Sofascore', updated: 0 }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const homePlayers: any[] = lineupsData?.home?.players || [];
    const awayPlayers: any[] = lineupsData?.away?.players || [];
    const all = [...homePlayers, ...awayPlayers];

    // Build name -> sofascore player id map (normalized)
    const nameToId = new Map<string, string>();
    for (const entry of all) {
      const p = entry?.player || {};
      const id = p.id ? String(p.id) : null;
      if (!id) continue;
      const names = [p.name, p.shortName].filter(Boolean);
      for (const n of names) {
        const key = normalize(n);
        if (key && !nameToId.has(key)) nameToId.set(key, id);
      }
    }

    if (nameToId.size === 0) {
      return new Response(JSON.stringify({ success: true, updated: 0, message: 'No player ids in Sofascore lineup yet' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get current playing XI (only those without sofascore image)
    const { data: roster } = await supabase
      .from('match_playing_xi')
      .select('id, player_name, player_image, sofascore_player_id')
      .eq('match_id', matchId);

    const updates: Promise<any>[] = [];
    let updated = 0;
    for (const r of roster || []) {
      if ((r as any).sofascore_player_id) continue; // already enriched
      const key = normalize(r.player_name || '');
      if (!key) continue;
      // exact, then fuzzy contains
      let id = nameToId.get(key) || null;
      if (!id) {
        for (const [k, v] of nameToId) {
          if (k.includes(key) || key.includes(k)) { id = v; break; }
        }
      }
      if (!id) continue;
      updated++;
      updates.push(
        supabase.from('match_playing_xi')
          .update({ player_image: PLAYER_IMAGE_URL(id), sofascore_player_id: id })
          .eq('id', r.id)
      );
    }
    await Promise.all(updates);

    return new Response(JSON.stringify({ success: true, eventId, updated, totalSofaPlayers: nameToId.size }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});