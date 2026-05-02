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
const normalize = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, { headers: CREX_HEADERS, signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

function parseAppRootState(html: string): any | null {
  const m = html.match(/<script id="app-root-state" type="application\/json">(.*?)<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1].replace(/&q;/g, '"')); } catch { return null; }
}

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
  let position = ''; let isWk = false;
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
    const rawRole = ftpMap[pId] !== undefined ? ftpMap[pId]
      : (pInfo.role || pInfo.p_role || pInfo.playerRole || pInfo.type || pData[2] || '1');
    const { position, isWk } = rolePositionFromCode(rawRole);
    return {
      id: pId, name, position,
      isWk: isWk || isWkRaw,
      isCaptain, isBench,
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

  // If no playing/bench split known but full squad available, mark all as bench candidates
  if (t1Players.length === 0 && t2Players.length === 0) {
    const grouped: Record<string, any[]> = {};
    for (const p of playerList) {
      const tk = p.team_f_key || p.tfk || p.t || '';
      if (!grouped[tk]) grouped[tk] = [];
      grouped[tk].push(p);
    }
    const teams = Object.keys(grouped);
    if (teams.length >= 2) {
      const map = (arr: any[]) => arr.map((pInfo: any) => ({
        id: pInfo.f_key,
        name: String(pInfo.n || pInfo.f || '').replace(/\((wk|c)\)/ig, '').replace(/\s+/g, ' ').trim(),
        position: rolePositionFromCode(pInfo.role || pInfo.p_role || '1').position,
        isWk: false, isCaptain: false, isBench: true,
        image: PLAYER_IMAGE_URL(pInfo.f_key),
      }));
      return {
        t1: { key: teams[0], name: teamList?.[0]?.n || '', players: map(grouped[teams[0]]) },
        t2: { key: teams[1], name: teamList?.[1]?.n || '', players: map(grouped[teams[1]]) },
        squadOnly: true,
      };
    }
    return null;
  }

  const t1Key = teamList?.[0]?.f_key || '';
  const t2Key = teamList?.[1]?.f_key || '';
  const t1Name = teamList?.[0]?.n || teamList?.[0]?.f || '';
  const t2Name = teamList?.[1]?.n || teamList?.[1]?.f || '';

  return {
    t1: { key: t1Key, name: t1Name, players: t1Players },
    t2: { key: t2Key, name: t2Name, players: t2Players },
    squadOnly: false,
  };
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

    const { data: match } = await supabase
      .from('matches')
      .select(`id, crex_match_fkey, team_a_id, team_b_id,
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
    const teamAId = (match as any).team_a_id;
    const teamBId = (match as any).team_b_id;

    let matchFkey: string | null = (match as any).crex_match_fkey || null;
    if (!matchFkey) {
      matchFkey = await findMatchFkey(teamAName, teamBName);
      if (matchFkey) {
        await supabase.from('matches').update({ crex_match_fkey: matchFkey }).eq('id', matchId);
      }
    }
    if (!matchFkey) {
      return new Response(JSON.stringify({ success: false, error: 'No matching Crex fixture', updated: 0, benchAdded: 0 }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const squads = await fetchSquads(matchFkey);
    if (!squads) {
      return new Response(JSON.stringify({ success: false, error: 'No Crex squad data', updated: 0, benchAdded: 0 }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Map Crex t1/t2 -> our teamA/teamB
    const aN = normalize(teamAName);
    const t1N = normalize(squads.t1.name);
    const t1IsA = t1N && (t1N.includes(aN) || aN.includes(t1N));
    const teamAPlayers: any[] = t1IsA ? squads.t1.players : squads.t2.players;
    const teamBPlayers: any[] = t1IsA ? squads.t2.players : squads.t1.players;

    // Build name -> player map per team
    const buildNameMap = (players: any[]) => {
      const map = new Map<string, any>();
      for (const p of players) {
        const key = normalize(p.name);
        if (key && !map.has(key)) map.set(key, p);
      }
      return map;
    };
    const aMap = buildNameMap(teamAPlayers);
    const bMap = buildNameMap(teamBPlayers);

    // Load existing roster
    const { data: roster } = await supabase
      .from('match_playing_xi')
      .select('id, team_id, player_name, player_image, is_bench')
      .eq('match_id', matchId);

    const existing = roster || [];
    const existingByTeam: Record<string, Set<string>> = { [teamAId]: new Set(), [teamBId]: new Set() };
    for (const r of existing) {
      const k = normalize(r.player_name || '');
      if (k && existingByTeam[r.team_id]) existingByTeam[r.team_id].add(k);
    }

    // 1) Update images for matching players (only if missing or non-cricketvectors)
    let updated = 0;
    const updates: Promise<any>[] = [];
    for (const r of existing) {
      const teamMap = r.team_id === teamAId ? aMap : (r.team_id === teamBId ? bMap : null);
      if (!teamMap) continue;
      const key = normalize(r.player_name || '');
      if (!key) continue;
      let p = teamMap.get(key);
      if (!p) {
        for (const [k, v] of teamMap) {
          if (k.includes(key) || key.includes(k)) { p = v; break; }
        }
      }
      if (!p) continue;
      const hasGoodImage = r.player_image && /cricketvectors\.akamaized/.test(r.player_image);
      if (hasGoodImage) continue;
      updated++;
      updates.push(
        supabase.from('match_playing_xi').update({ player_image: p.image }).eq('id', r.id)
      );
    }
    await Promise.all(updates);

    // 2) Append Crex bench players that aren't yet in DB
    const benchToInsert: any[] = [];
    const addBench = (players: any[], teamId: string) => {
      for (const p of players) {
        if (!p.isBench) continue; // only bench
        const key = normalize(p.name);
        if (!key) continue;
        if (existingByTeam[teamId]?.has(key)) continue;
        // fuzzy: skip if substring match exists
        let dup = false;
        for (const existKey of existingByTeam[teamId] || []) {
          if (existKey.includes(key) || key.includes(existKey)) { dup = true; break; }
        }
        if (dup) continue;
        benchToInsert.push({
          match_id: matchId,
          team_id: teamId,
          player_name: p.name,
          player_role: p.position || null,
          is_captain: !!p.isCaptain,
          is_vice_captain: false,
          is_wicket_keeper: !!p.isWk,
          is_bench: true,
          batting_order: null,
          player_image: p.image || null,
        });
        existingByTeam[teamId]?.add(key);
      }
    };
    addBench(teamAPlayers, teamAId);
    addBench(teamBPlayers, teamBId);

    let benchAdded = 0;
    if (benchToInsert.length > 0) {
      const { error: insErr } = await supabase.from('match_playing_xi').insert(benchToInsert);
      if (!insErr) benchAdded = benchToInsert.length;
      else console.warn('[enrich-from-crex] insert bench error:', insErr);
    }

    return new Response(JSON.stringify({
      success: true, matchFkey, updated, benchAdded,
      message: `Crex enrich: ${updated} images updated, ${benchAdded} bench players added`,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[enrich-from-crex] error:', e);
    return new Response(JSON.stringify({ success: false, error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});