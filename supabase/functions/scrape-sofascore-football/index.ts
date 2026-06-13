import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SOFA_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": "https://www.sofascore.com/",
  "Origin": "https://www.sofascore.com",
};

interface GoalEvent { player: string; minute: string; assist?: string; type: "goal" | "penalty" | "own_goal"; }
interface SubstitutionEvent { playerOut: string; playerIn: string; minute: string; }
interface PlayerInfo { name: string; position: string; jerseyNumber?: string; isCaptain?: boolean; playerImage?: string; }
interface FootballMatch {
  matchId?: string;
  eventId?: string;
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

function norm(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
const STOP = new Set(["fc", "cf", "afc", "sc", "ac", "club", "the", "of", "team", "national"]);
function toks(s: string): string[] {
  return norm(s).split(" ").filter((t) => t && !STOP.has(t));
}
function teamScore(sofa: string, name: string): number {
  const a = toks(name); if (!a.length) return 0;
  const b = new Set(toks(sofa));
  const hits = a.filter((t) => b.has(t)).length;
  return hits / a.length;
}
function bestSideScore(sofa: string, names: string[]): number {
  let best = 0; for (const n of names) { const s = teamScore(sofa, n); if (s > best) best = s; }
  return best;
}

async function safeFetch(url: string): Promise<any | null> {
  try {
    const r = await fetch(url, { headers: SOFA_HEADERS });
    if (!r.ok) { console.warn(`[sofa] ${r.status} ${url}`); return null; }
    return await r.json();
  } catch (e) { console.warn(`[sofa] fetch failed ${url}`, e); return null; }
}

function mapStatus(code?: string, desc?: string): string {
  const t = (code || desc || "").toLowerCase();
  if (t.includes("finished") || t === "ended" || t.includes("ft")) return "Completed";
  if (t.includes("halftime") || t === "ht") return "Half Time";
  if (t.includes("inprogress") || t === "live" || t.includes("1st half") || t.includes("2nd half") || t.includes("first half") || t.includes("second half")) return "Live";
  if (t.includes("postponed") || t.includes("canceled") || t.includes("cancelled") || t.includes("abandoned")) return "Postponed";
  return "Scheduled";
}

function fmtMinute(ev: any): string | null {
  // ev.time = elapsed minutes, ev.addedTime extra
  const t = ev?.time;
  const status = ev?.status?.type;
  if (status === "finished") return null;
  if (status === "inprogress" && typeof t === "number") return `${t}'`;
  if (typeof t === "number") return `${t}'`;
  return null;
}

async function fetchEventDetails(eventId: number): Promise<{ goals: { home: GoalEvent[]; away: GoalEvent[] }; subs: { home: SubstitutionEvent[]; away: SubstitutionEvent[] }; lineups: { home: PlayerInfo[]; away: PlayerInfo[] } }> {
  const empty = { goals: { home: [] as GoalEvent[], away: [] as GoalEvent[] }, subs: { home: [] as SubstitutionEvent[], away: [] as SubstitutionEvent[] }, lineups: { home: [] as PlayerInfo[], away: [] as PlayerInfo[] } };
  const [inc, lu] = await Promise.all([
    safeFetch(`https://api.sofascore.com/api/v1/event/${eventId}/incidents`),
    safeFetch(`https://api.sofascore.com/api/v1/event/${eventId}/lineups`),
  ]);

  if (inc?.incidents && Array.isArray(inc.incidents)) {
    for (const it of inc.incidents) {
      const minute = it.time != null ? String(it.time) + (it.addedTime ? `+${it.addedTime}` : "") : "";
      const isHome = it.isHome === true;
      if (it.incidentType === "goal") {
        const type: GoalEvent["type"] = it.incidentClass === "ownGoal" ? "own_goal" : (it.incidentClass === "penalty" ? "penalty" : "goal");
        const player = it.player?.name || "Unknown";
        const assist = it.assist1?.name || undefined;
        // own_goal: credited to opposite team
        const target = type === "own_goal" ? (!isHome) : isHome;
        (target ? empty.goals.home : empty.goals.away).push({ player, minute, assist, type });
      } else if (it.incidentType === "substitution") {
        const playerIn = it.playerIn?.name || "Unknown";
        const playerOut = it.playerOut?.name || "Unknown";
        (isHome ? empty.subs.home : empty.subs.away).push({ playerIn, playerOut, minute });
      }
    }
  }

  const buildLineup = (side: any): PlayerInfo[] => {
    if (!side?.players || !Array.isArray(side.players)) return [];
    return side.players
      .filter((p: any) => p?.substitute === false || p?.substitute == null) // starting XI first
      .slice(0, 11)
      .map((p: any) => {
        const player = p.player || {};
        const id = player.id;
        return {
          name: player.name || player.shortName || "Unknown",
          position: p.position || player.position || "",
          jerseyNumber: p.shirtNumber ? String(p.shirtNumber) : undefined,
          isCaptain: !!p.captain,
          playerImage: id ? `https://api.sofascore.app/api/v1/player/${id}/image` : undefined,
        };
      });
  };

  if (lu?.confirmed !== false) {
    if (lu?.home) empty.lineups.home = buildLineup(lu.home);
    if (lu?.away) empty.lineups.away = buildLineup(lu.away);
  }

  return empty;
}

async function findEventForMatch(teamANames: string[], teamBNames: string[]): Promise<any | null> {
  // Search Sofascore using the first non-empty primary name; fall back to aliases
  const queries = [...teamANames, ...teamBNames].map((s) => (s || "").trim()).filter(Boolean).slice(0, 4);
  const tried = new Set<string>();
  for (const q of queries) {
    const key = q.toLowerCase();
    if (tried.has(key)) continue;
    tried.add(key);
    const search = await safeFetch(`https://api.sofascore.com/api/v1/search/events?q=${encodeURIComponent(q)}`);
    const events: any[] = search?.results?.map((r: any) => r.entity).filter((e: any) => e?.tournament?.category?.sport?.slug === "football" || e?.homeTeam) || [];
    let best: { ev: any; score: number } | null = null;
    for (const ev of events) {
      const hn = ev?.homeTeam?.name || ev?.homeTeam?.shortName || "";
      const an = ev?.awayTeam?.name || ev?.awayTeam?.shortName || "";
      if (!hn || !an) continue;
      // Try both orientations
      const s1 = bestSideScore(hn, teamANames) + bestSideScore(an, teamBNames);
      const s2 = bestSideScore(hn, teamBNames) + bestSideScore(an, teamANames);
      const s = Math.max(s1, s2);
      if (s >= 2 && (!best || s > best.score)) best = { ev, score: s };
    }
    if (best) return best.ev;
  }
  return null;
}

async function fetchSofaForMatch(input: { id: string; teamA: string; teamB: string; aliasesA?: string[]; aliasesB?: string[] }): Promise<FootballMatch | null> {
  const aNames = [input.teamA, ...(input.aliasesA || [])].filter(Boolean);
  const bNames = [input.teamB, ...(input.aliasesB || [])].filter(Boolean);
  const ev = await findEventForMatch(aNames, bNames);
  if (!ev?.id) return null;

  // Fetch full event for accurate score/status/minute
  const full = await safeFetch(`https://api.sofascore.com/api/v1/event/${ev.id}`);
  const e = full?.event || ev;

  const homeName = e?.homeTeam?.name || ev.homeTeam?.name || "";
  const awayName = e?.awayTeam?.name || ev.awayTeam?.name || "";
  // Determine orientation: which Sofa side corresponds to our teamA
  const orientA_home = bestSideScore(homeName, aNames) + bestSideScore(awayName, bNames);
  const orientA_away = bestSideScore(awayName, aNames) + bestSideScore(homeName, bNames);
  const reversed = orientA_away > orientA_home;

  const details = await fetchEventDetails(e.id);

  const homeScore = e?.homeScore?.current != null ? String(e.homeScore.current) : null;
  const awayScore = e?.awayScore?.current != null ? String(e.awayScore.current) : null;
  const status = mapStatus(e?.status?.type, e?.status?.description);
  const minute = fmtMinute(e);
  const startTime = e?.startTimestamp ? new Date(e.startTimestamp * 1000).toISOString() : null;
  const competition = e?.tournament?.name || ev?.tournament?.name || null;

  const homeGoals = details.goals.home;
  const awayGoals = details.goals.away;
  const homeLineup = details.lineups.home;
  const awayLineup = details.lineups.away;
  const homeSubs = details.subs.home;
  const awaySubs = details.subs.away;

  return {
    matchId: input.id,
    eventId: String(e.id),
    homeTeam: reversed ? awayName : homeName,
    awayTeam: reversed ? homeName : awayName,
    homeScore: reversed ? awayScore : homeScore,
    awayScore: reversed ? homeScore : awayScore,
    status,
    minute,
    competition,
    startTime,
    homeGoals: reversed ? awayGoals : homeGoals,
    awayGoals: reversed ? homeGoals : awayGoals,
    homeLineup: reversed ? awayLineup : homeLineup,
    awayLineup: reversed ? homeLineup : awayLineup,
    homeSubs: reversed ? awaySubs : homeSubs,
    awaySubs: reversed ? homeSubs : awaySubs,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const matches: { id: string; teamA: string; teamB: string; aliasesA?: string[]; aliasesB?: string[] }[] = body?.matches || [];
    if (!Array.isArray(matches) || matches.length === 0) {
      return new Response(JSON.stringify({ success: true, matches: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Limit concurrency
    const out: FootballMatch[] = [];
    const CONC = 3;
    for (let i = 0; i < matches.length; i += CONC) {
      const chunk = matches.slice(i, i + CONC);
      const res = await Promise.all(chunk.map((m) => fetchSofaForMatch(m).catch((e) => { console.warn("[sofa] match failed", m, e); return null; })));
      for (const r of res) if (r) out.push(r);
    }

    return new Response(JSON.stringify({ success: true, matches: out }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[scrape-sofascore-football] fatal", e);
    return new Response(JSON.stringify({ success: false, error: (e as Error).message, fallback: false, matches: [] }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});