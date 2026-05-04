import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://crex.live/',
};

const PLAYER_IMAGE_URL = (id: string) => `https://cricketvectors.akamaized.net/players/org/${id}.png`;
const normalize = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

async function fetchText(url: string): Promise<string | null> {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 15000);
    const r = await fetch(url, { headers: HEADERS, signal: c.signal, redirect: 'follow' });
    clearTimeout(t);
    if (!r.ok) { console.warn(`[crex] ${url} -> ${r.status}`); return null; }
    return await r.text();
  } catch (e) { console.warn(`[crex] err ${url}`, e); return null; }
}

async function fetchJson(url: string): Promise<any | null> {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 12000);
    const r = await fetch(url, { headers: HEADERS, signal: c.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

function parseAppRootState(html: string): any | null {
  const m = html.match(/<script id="app-root-state"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1].replace(/&q;/g, '"').replace(/&a;/g, '&').replace(/&l;/g, '<').replace(/&g;/g, '>').replace(/&s;/g, "'")); }
  catch (e) { console.warn('[crex] state parse failed', e); return null; }
}

function extractPlayerNames(html: string): Map<string, string> {
  // Match /player/<slug>-<ID>
  const out = new Map<string, string>();
  const re = /href="\/player\/([a-z0-9-]+)-([A-Z0-9]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const id = m[2];
    if (!out.has(id)) {
      const name = m[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      out.set(id, name);
    }
  }
  return out;
}

// Fetch player full name from /player/x-<ID> profile page <title>
async function fetchPlayerName(id: string): Promise<string | null> {
  const html = await fetchText(`https://crex.live/player/x-${id}`);
  if (!html) return null;
  const t = html.match(/<title>([^<]+)<\/title>/i);
  if (!t) return null;
  // Title format: "Full Name <Country> Cricket Player Profile, ..."
  const raw = t[1].trim();
  const cut = raw.split(/\s+(?:Cricket\s+Player\s+Profile|Player\s+Profile|\|)/i)[0];
  // Strip trailing nationality/role words (Japanese, Indian, English, etc.)
  const cleaned = cut.replace(/\s+(Indian|Pakistani|Japanese|English|Australian|Sri\s+Lankan|Bangladeshi|South\s+African|New\s+Zealand|Afghan|Afghani|West\s+Indian|Zimbabwean|Irish|Scottish|Dutch|American|Canadian|Nepalese|Nepali|Omani|Emirati|Kenyan|Namibian|Ugandan)$/i, '').trim();
  return cleaned || null;
}

async function fillMissingNames(ids: string[], nameMap: Map<string, string>): Promise<void> {
  const missing = ids.filter(id => !nameMap.has(id));
  if (!missing.length) return;
  // Limit concurrency to avoid hammering
  const CONC = 5;
  for (let i = 0; i < missing.length; i += CONC) {
    const batch = missing.slice(i, i + CONC);
    const results = await Promise.all(batch.map(id => fetchPlayerName(id).then(n => [id, n] as const)));
    for (const [id, n] of results) if (n) nameMap.set(id, n);
  }
}

function parseTpTb(s: string): string[][] {
  if (!s || !s.includes('/')) return [[], []];
  const parts = s.split('/');
  return [
    parts[0].split('-').filter(Boolean).map(x => x.split('.')[0]),
    parts[1].split('-').filter(Boolean).map(x => x.split('.')[0]),
  ];
}

function rolePositionFromCode(rawRole: any): { position: string; isWk: boolean } {
  const i = parseInt(String(rawRole), 10);
  if (!isNaN(i) && String(rawRole).length < 3) {
    if (i === 4 || i === 0) return { position: 'Wicket-keeper', isWk: true };
    if (i === 1) return { position: 'Batsman', isWk: false };
    if (i === 2) return { position: 'Bowler', isWk: false };
    if (i === 3) return { position: 'All-rounder', isWk: false };
  }
  const r = String(rawRole || '').toLowerCase();
  if (r.includes('wk') || r.includes('keeper')) return { position: 'Wicket-keeper', isWk: true };
  if (r.includes('all')) return { position: 'All-rounder', isWk: false };
  if (r.includes('bowl')) return { position: 'Bowler', isWk: false };
  if (r.includes('bat')) return { position: 'Batsman', isWk: false };
  return { position: '', isWk: false };
}

async function findMatchFkey(teamAName: string, teamBName: string): Promise<string | null> {
  const html = await fetchText('https://crex.live/fixtures/match-list');
  if (!html) return null;
  const state = parseAppRootState(html);
  if (!state) return null;

  const fixturesKey = Object.keys(state).find(k => k.includes('getFixture'));
  if (!fixturesKey) return null;
  const fixtures: any[] = state[fixturesKey] || [];

  const aN = normalize(teamAName);
  const bN = normalize(teamBName);
  for (const f of fixtures) {
    const n1 = normalize(f.team1 || '');
    const n2 = normalize(f.team2 || '');
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

interface PlayerEntry { id: string; name: string; position: string; isWk: boolean; isCaptain: boolean; isBench: boolean; image: string; }

async function fetchSquads(matchFkey: string): Promise<{ hasLineup: boolean; t1Flag: string; t2Flag: string; t1Players: PlayerEntry[]; t2Players: PlayerEntry[]; t1Name: string; t2Name: string } | null> {
  const detailsUrl = `https://crex.live/cricket-live-score/match-${matchFkey}/match-details`;
  const scorecardUrl = `https://crex.live/cricket-live-score/match-${matchFkey}/match-scorecard`;
  const [detailsHtml, scoreHtml] = await Promise.all([fetchText(detailsUrl), fetchText(scorecardUrl)]);
  if (!detailsHtml) return null;

  const state = parseAppRootState(detailsHtml);
  if (!state) return null;

  // Try to fetch IV4 directly (more reliable) using fkey from state or arg
  let iv4: any = null;
  const iv4Key = Object.keys(state).find(k => k.includes('getIV4'));
  if (iv4Key) iv4 = state[iv4Key];
  if (!iv4 || !iv4.tp) {
    iv4 = await fetchJson(`https://api.goscorer.com/api/v3/getIV4?key=${matchFkey}`);
  }
  if (!iv4) return null;

  // SV3 has team full names + flags
  let sv3: any = null;
  const sv3Key = Object.keys(state).find(k => k.includes('getSV3'));
  if (sv3Key) sv3 = state[sv3Key];

  // PreLive has ftp (player roles)
  let preLive: any = null;
  const preLiveKey = Object.keys(state).find(k => k.includes('getPreLiveStats'));
  if (preLiveKey) preLive = state[preLiveKey];

  const tp = parseTpTb(iv4.tp || '');
  const tb = parseTpTb(iv4.tb || '');
  const t1Playing = tp[0] || [];
  const t2Playing = tp[1] || [];
  const t1Bench = tb[0] || [];
  const t2Bench = tb[1] || [];

  if (!t1Playing.length && !t2Playing.length && !t1Bench.length && !t2Bench.length) {
    return { hasLineup: false, t1Flag: '', t2Flag: '', t1Players: [], t2Players: [], t1Name: '', t2Name: '' };
  }

  // Player name map - merge names from both pages
  const nameMap = new Map<string, string>();
  for (const [id, name] of extractPlayerNames(detailsHtml)) nameMap.set(id, name);
  if (scoreHtml) for (const [id, name] of extractPlayerNames(scoreHtml)) if (!nameMap.has(id)) nameMap.set(id, name);

  // Bench (and any missing playing) IDs aren't linked on the details page —
  // fetch each player's profile page <title> to resolve full names.
  const allIds = [...t1Playing, ...t2Playing, ...t1Bench, ...t2Bench];
  await fillMissingNames(allIds, nameMap);

  // Captain detection from playing XI HTML in details page
  const captainMap = new Set<string>();
  const wkMap = new Set<string>();
  // Section markers for "(C)" and "(WK)"
  const xiSection = detailsHtml;
  const rowRe = /<div[^>]*class="playingxi-card-row"[^>]*>([\s\S]*?)<\/a>/g;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(xiSection)) !== null) {
    const block = rm[1];
    const idM = block.match(/href="\/player\/[a-z0-9-]+-([A-Z0-9]+)"/);
    if (!idM) continue;
    const id = idM[1];
    if (/\(\s*C\s*\)/.test(block)) captainMap.add(id);
    if (/\(\s*WK\s*\)/i.test(block)) wkMap.add(id);
  }

  // Roles map from preLive.ftp
  const roleMap: Record<string, any> = {};
  if (preLive?.ftp) for (const f of preLive.ftp) roleMap[f.p] = f.r;

  // Team flags - from iv4.t (e.g. "KB-I"), team1Flag, team2Flag, also from sv3 team1/team2
  let t1Flag = '', t2Flag = '';
  if (iv4.t && typeof iv4.t === 'string' && iv4.t.includes('-')) {
    const parts = iv4.t.split('-');
    t1Flag = parts[0]; t2Flag = parts[1];
  }
  if (!t1Flag) t1Flag = iv4.t1f?.toString().split('&')[5] || iv4.t1f || '';
  if (!t2Flag) t2Flag = iv4.t2f?.toString().split('&')[5] || iv4.t2f || '';

  // Resolve team names by matching flags against sv3
  let t1Name = '', t2Name = '';
  if (sv3) {
    // sv3 has team1/team2 short codes + team1_f_n/team2_f_n full names + team1flag/team2flag URLs containing flag id
    const s1Flag = (sv3.team1flag || '').match(/\/([A-Z0-9]+)\.png/i)?.[1] || sv3.team1 || '';
    const s2Flag = (sv3.team2flag || '').match(/\/([A-Z0-9]+)\.png/i)?.[1] || sv3.team2 || '';
    if (s1Flag === t1Flag) { t1Name = sv3.team1_f_n || sv3.team1; t2Name = sv3.team2_f_n || sv3.team2; }
    else if (s2Flag === t1Flag) { t1Name = sv3.team2_f_n || sv3.team2; t2Name = sv3.team1_f_n || sv3.team1; }
    else { t1Name = sv3.team1_f_n || sv3.team1 || ''; t2Name = sv3.team2_f_n || sv3.team2 || ''; }
  }

  const buildPlayer = (id: string, isBench: boolean): PlayerEntry => {
    const name = nameMap.get(id) || id;
    const role = roleMap[id] !== undefined ? roleMap[id] : '1';
    const { position, isWk } = rolePositionFromCode(role);
    return {
      id, name, position,
      isWk: isWk || wkMap.has(id),
      isCaptain: captainMap.has(id),
      isBench,
      image: PLAYER_IMAGE_URL(id),
    };
  };

  const t1Players = [...t1Playing.map(id => buildPlayer(id, false)), ...t1Bench.map(id => buildPlayer(id, true))];
  const t2Players = [...t2Playing.map(id => buildPlayer(id, false)), ...t2Bench.map(id => buildPlayer(id, true))];

  return { hasLineup: true, t1Flag, t2Flag, t1Name, t2Name, t1Players, t2Players };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json().catch(() => ({}));
    const { matchId, teamAId, teamBId, teamAName, teamBName, crexMatchFkey: providedFkey } = body || {};

    if (!matchId || !teamAId || !teamBId || !teamAName || !teamBName) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required parameters' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let matchFkey: string | null = providedFkey || null;
    if (!matchFkey) {
      const { data: matchRow } = await supabase.from('matches').select('crex_match_fkey').eq('id', matchId).maybeSingle();
      matchFkey = (matchRow as any)?.crex_match_fkey || null;
    }
    if (!matchFkey) {
      matchFkey = await findMatchFkey(teamAName, teamBName);
      if (matchFkey) await supabase.from('matches').update({ crex_match_fkey: matchFkey }).eq('id', matchId);
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

    // Map crex t1/t2 -> our teamA/teamB
    const aN = normalize(teamAName);
    const bN = normalize(teamBName);
    const t1N = normalize(squads.t1Name);
    const t2N = normalize(squads.t2Name);
    let t1IsA = false;
    if (t1N && (t1N.includes(aN) || aN.includes(t1N))) t1IsA = true;
    else if (t2N && (t2N.includes(aN) || aN.includes(t2N))) t1IsA = false;
    else if (t1N && (t1N.includes(bN) || bN.includes(t1N))) t1IsA = false;
    else t1IsA = true;
    const homeMapsTo = t1IsA ? teamAId : teamBId;
    const awayMapsTo = t1IsA ? teamBId : teamAId;

    const buildRows = (players: PlayerEntry[], teamId: string) => {
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

    const t1Rows = buildRows(squads.t1Players, homeMapsTo);
    const t2Rows = buildRows(squads.t2Players, awayMapsTo);

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
      t1Name: squads.t1Name,
      t2Name: squads.t2Name,
      message: confirmedXI
        ? `Synced confirmed Playing XI from Crex (${finalRows.length} players)`
        : `Crex squad fetched (${finalRows.length} players). Waiting for confirmed XI.`,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('[sync-crex-playing-xi] error:', e);
    return new Response(JSON.stringify({ success: false, error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
