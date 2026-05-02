import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CREX_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://crex.live/',
};

const PLAYER_IMAGE_URL = (id: string) => `https://cricketvectors.akamaized.net/players/org/${id}.png`;
const TEAM_LOGO_URL = (id: string) => `https://cricketvectors.akamaized.net/Teams/${id}.png`;

const normalize = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, { headers: CREX_HEADERS, signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) {
      console.warn(`[crex] ${url} -> ${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(`[crex] fetch error`, e);
    return null;
  }
}

function parseAppRootState(html: string): any | null {
  const m = html.match(/<script id="app-root-state" type="application\/json">(.*?)<\/script>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1].replace(/&q;/g, '"'));
  } catch (e) {
    console.warn('[crex] state parse failed', e);
    return null;
  }
}

/** Locate the Crex match fkey by scraping the global fixtures list and matching team names. */
async function findMatchFkey(teamAName: string, teamBName: string): Promise<string | null> {
  const html = await fetchHtml('https://crex.live/fixtures/match-list');
  if (!html) return null;
  const state = parseAppRootState(html);
  if (!state) return null;

  const fixturesKey = Object.keys(state).find(k => k.includes('getFixture'));
  const mapKey = Object.keys(state).find(k => k.includes('getHomeMapDatadatewise'));
  if (!fixturesKey) return null;

  const fixtures: any[] = state[fixturesKey] || [];
  const mapData: any = mapKey ? (state[mapKey]?.body || state[mapKey] || {}) : {};
  const teamList: any[] = Array.isArray(mapData.t) ? mapData.t : Object.values(mapData.t || {});
  const getTeamName = (key: string) => {
    const t = teamList.find((x: any) => x.f_key === key);
    return t ? (t.n || t.f || '') : '';
  };

  const aN = normalize(teamAName);
  const bN = normalize(teamBName);

  for (const f of fixtures) {
    const t1Key = f.team1fkey || f.t1f;
    const t2Key = f.team2fkey || f.t2f;
    const n1 = normalize(f.team1 || getTeamName(t1Key) || '');
    const n2 = normalize(f.team2 || getTeamName(t2Key) || '');
    if (!n1 || !n2) continue;
    const ok =
      ((n1.includes(aN) || aN.includes(n1)) && (n2.includes(bN) || bN.includes(n2))) ||
      ((n1.includes(bN) || bN.includes(n1)) && (n2.includes(aN) || aN.includes(n2)));
    if (ok) {
      const fkey = f.matchFkey || f.mf || f.id;
      if (fkey) return String(fkey);
    }
  }
  return null;
}

function rolePositionFromCode(rawRole: any): { position: string; isWk: boolean } {
  const roleIndex = parseInt(String(rawRole), 10);
  let position = '';
  let isWk = false;
  if (!isNaN(roleIndex) && String(rawRole).length < 3) {
    if (roleIndex === 4 || roleIndex === 0) { position = 'Wicket-keeper'; isWk = true; }
    else if (roleIndex === 1) position = 'Batsman';
    else if (roleIndex === 2) position = 'Bowler';
    else if (roleIndex === 3) position = 'All-rounder';
  } else {
    const rs = String(rawRole || '').toLowerCase();
    if (rs.includes('wk') || rs.includes('keeper')) { position = 'Wicket-keeper'; isWk = true; }
    else if (rs.includes('all')) position = 'All-rounder';
    else if (rs.includes('bowl')) position = 'Bowler';
    else if (rs.includes('bat')) position = 'Batsman';
    else position = String(rawRole || '');
  }
  return { position, isWk };
}

/** Returns { home: { teamKey, players[] }, away: { teamKey, players[] } } or null. */
async function fetchSquads(matchFkey: string): Promise<any | null> {
  const html = await fetchHtml(`https://crex.live/cricket-live-score/match-${matchFkey}/match-details`);
  if (!html) return null;
  const state = parseAppRootState(html);
  if (!state) return null;

  const matchInfoKey = Object.keys(state).find(k => k.includes('getHomeMapDatamatchinfo'));
  const iv4Key = Object.keys(state).find(k => k.includes('getIV4'));
  const preLiveKey = Object.keys(state).find(k => k.includes('getPreLiveStats'));

  const matchInfo = matchInfoKey ? state[matchInfoKey] : null;
  const iv4 = iv4Key ? state[iv4Key] : null;
  const preLive = preLiveKey ? state[preLiveKey] : null;

  let playerList: any[] = matchInfo?.p || matchInfo?.body?.p;
  const teamList: any[] = matchInfo?.t || matchInfo?.body?.t || [];
  if (!playerList && teamList.length) playerList = teamList.flatMap((t: any) => t.p || []);
  if (!playerList || !playerList.length) return null;

  const tpStr = iv4?.tp || preLive?.tp;
  const tbStr = iv4?.tb || preLive?.tb;

  let t1Playing: string[] = [], t2Playing: string[] = [];
  let t1Bench: string[] = [], t2Bench: string[] = [];
  if (tpStr && String(tpStr).includes('/')) {
    const parts = String(tpStr).split('/');
    t1Playing = parts[0].split('-').filter(Boolean);
    t2Playing = parts[1].split('-').filter(Boolean);
  }
  if (tbStr && String(tbStr).includes('/')) {
    const parts = String(tbStr).split('/');
    t1Bench = parts[0].split('-').filter(Boolean);
    t2Bench = parts[1].split('-').filter(Boolean);
  }

  if (!t1Playing.length && !t2Playing.length && !t1Bench.length && !t2Bench.length) {
    return { teamList, playerList, t1: [], t2: [], hasLineup: false };
  }

  const ftpMap: Record<string, any> = {};
  if (preLive?.ftp) for (const f of preLive.ftp) ftpMap[f.p] = f.r;

  const buildPlayer = (str: string, isBench: boolean) => {
    if (!str) return null;
    const pData = str.split('.');
    const pId = pData[0];
    const pInfo = playerList.find((p: any) => p.f_key === pId) || {};
    const rawName = pInfo.n || pInfo.f || pId;
    const isCaptain = /\(c\)/i.test(rawName);
    const isWkRaw = /\(wk\)/i.test(rawName);
    const name = String(rawName).replace(/\((wk|c)\)/ig, '').replace(/\s+/g, ' ').trim();
    const rawRole = ftpMap[pId] !== undefined
      ? ftpMap[pId]
      : (pInfo.role || pInfo.p_role || pInfo.playerRole || pInfo.type || pData[2] || '1');
    const { position, isWk } = rolePositionFromCode(rawRole);
    return {
      id: pId,
      name,
      position,
      isWk: isWk || isWkRaw,
      isCaptain,
      isBench,
      image: PLAYER_IMAGE_URL(pId),
    };
  };

  const t1Players = [
    ...t1Playing.map(s => buildPlayer(s, false)).filter(Boolean),
    ...t1Bench.map(s => buildPlayer(s, true)).filter(Boolean),
  ];
  const t2Players = [
    ...t2Playing.map(s => buildPlayer(s, false)).filter(Boolean),
    ...t2Bench.map(s => buildPlayer(s, true)).filter(Boolean),
  ];

  // Determine team keys (for mapping to our teams). Crex stores teams in matchInfo.t.
  const t1Key = teamList?.[0]?.f_key || '';
  const t2Key = teamList?.[1]?.f_key || '';
  const t1Name = teamList?.[0]?.n || teamList?.[0]?.f || '';
  const t2Name = teamList?.[1]?.n || teamList?.[1]?.f || '';

  return {
    hasLineup: true,
    t1: { key: t1Key, name: t1Name, players: t1Players },
    t2: { key: t2Key, name: t2Name, players: t2Players },
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json().catch(() => ({}));
    const { matchId, teamAId, teamBId, teamAName, teamBName, crexMatchFkey: providedFkey } = body || {};

    if (!matchId || !teamAId || !teamBId || !teamAName || !teamBName) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required parameters' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let matchFkey: string | null = providedFkey || null;
    if (!matchFkey) {
      const { data: matchRow } = await supabase
        .from('matches')
        .select('crex_match_fkey')
        .eq('id', matchId)
        .maybeSingle();
      matchFkey = (matchRow as any)?.crex_match_fkey || null;
      if (!matchFkey) {
        matchFkey = await findMatchFkey(teamAName, teamBName);
        if (matchFkey) {
          await supabase.from('matches').update({ crex_match_fkey: matchFkey }).eq('id', matchId);
        }
      }
    }

    if (!matchFkey) {
      return new Response(JSON.stringify({ success: false, error: 'No matching Crex fixture found' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const squads = await fetchSquads(matchFkey);
    if (!squads || !squads.hasLineup) {
      return new Response(JSON.stringify({ success: false, error: 'Squads not yet published on Crex', matchFkey }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Map crex t1/t2 -> our teamA/teamB by name similarity
    const aN = normalize(teamAName);
    const t1N = normalize(squads.t1.name);
    const t1IsA = t1N && (t1N.includes(aN) || aN.includes(t1N));
    const homeMapsTo = t1IsA ? teamAId : teamBId;
    const awayMapsTo = t1IsA ? teamBId : teamAId;

    const buildRows = (players: any[], teamId: string) => {
      let order = 1;
      const seen = new Set<string>();
      const rows: any[] = [];
      for (const p of players) {
        const key = normalize(p.name);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        rows.push({
          match_id: matchId,
          team_id: teamId,
          player_name: p.name,
          player_role: p.position || null,
          is_captain: !!p.isCaptain,
          is_vice_captain: false,
          is_wicket_keeper: !!p.isWk,
          is_bench: !!p.isBench,
          batting_order: p.isBench ? null : order++,
          player_image: p.image || null,
        });
      }
      return rows;
    };

    const t1Rows = buildRows(squads.t1.players, homeMapsTo);
    const t2Rows = buildRows(squads.t2.players, awayMapsTo);

    const t1Starters = t1Rows.filter(r => !r.is_bench).length;
    const t2Starters = t2Rows.filter(r => !r.is_bench).length;
    const confirmedXI = t1Starters === 11 && t2Starters === 11;

    const finalRows = confirmedXI
      ? [...t1Rows, ...t2Rows]
      : [...t1Rows, ...t2Rows].map(r => ({ ...r, is_bench: true, batting_order: null }));

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
      matchFkey,
      confirmedXI,
      playersAdded: finalRows.length,
      t1Starters, t2Starters,
      message: confirmedXI
        ? `Synced confirmed Playing XI from Crex (${finalRows.length} players)`
        : `Crex squad fetched (${finalRows.length} players). Waiting for confirmed XI.`,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[sync-crex-playing-xi] error:', e);
    return new Response(JSON.stringify({ success: false, error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});