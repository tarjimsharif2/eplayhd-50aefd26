import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Normalize team/match name for fuzzy matching
function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  // remove common stop words / suffixes that hurt matching
  const stop = new Set([
    "fc", "cf", "afc", "sc", "ac", "club", "the", "of", "team",
    "eng", "hd", "ru", "ar", "es", "fr", "pt", "1", "2", "3",
  ]);
  return normalize(s).split(" ").filter((t) => t && !stop.has(t));
}

// Generic tokens shared across many teams — useless for distinguishing matches
const GENERIC = new Set([
  "women", "womens", "ladies", "men", "mens", "national",
  "under", "youth", "junior", "senior", "reserves", "ii",
  "w", "u", "u19", "u20", "u21", "u23", "a", "b",
  "vs", "v", "live", "match", "stream",
]);

// Build the set of "match terms" for a team:
//  - distinctive primary-name tokens (len>=4, non-generic)
//  - short_name (any length >=2, non-generic) — e.g. "WI", "SL"
//  - aliases (any length >=2, non-generic)
// At least one term from BOTH teams must appear in the entry tokens
// for the match to be accepted.
function buildMatchTerms(primary: string, shortName: string, aliases: any): string[] {
  const out = new Set<string>();
  for (const t of tokens(primary)) {
    if (t.length >= 4 && !GENERIC.has(t)) out.add(t);
  }
  const add = (raw: string) => {
    const n = normalize(raw);
    for (const t of n.split(" ")) {
      if (t.length >= 2 && !GENERIC.has(t)) out.add(t);
    }
  };
  if (shortName) add(shortName);
  if (Array.isArray(aliases)) {
    for (const a of aliases) if (typeof a === "string" && a.trim()) add(a);
  }
  return [...out];
}

function entryMatchesTeams(jsonName: string, aTerms: string[], bTerms: string[]): boolean {
  if (!aTerms.length || !bTerms.length) return false;
  const jt = new Set(tokens(jsonName));
  const aOk = aTerms.some((t) => jt.has(t));
  const bOk = bTerms.some((t) => jt.has(t));
  return aOk && bOk;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const log = (...a: unknown[]) => console.log("[sync-streaming-from-json]", ...a);

  try {
    // 1. Load active JSON sources, ordered by display_order then created_at
    const { data: sources, error: srcErr } = await supabase
      .from("streaming_json_sources")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (srcErr) throw srcErr;
    if (!sources || sources.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "no sources" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Load matches that opt-in & are upcoming/live
    const { data: matches, error: mErr } = await supabase
      .from("matches")
      .select("id, status, auto_streaming_enabled, team_a:team_a_id(id,name,short_name,aliases), team_b:team_b_id(id,name,short_name,aliases)")
      .eq("auto_streaming_enabled", true)
      .in("status", ["upcoming", "live"]);
    if (mErr) throw mErr;

    if (!matches || matches.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "no eligible matches" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Existing auto-imported servers (to update / delete stale)
    const matchIds = matches.map((m: any) => m.id);
    const { data: existingAuto } = await supabase
      .from("streaming_servers")
      .select("id, match_id, auto_source_id, server_url, server_name, display_order")
      .in("match_id", matchIds)
      .not("auto_source_id", "is", null);

    const existingMap = new Map<string, any>();
    for (const s of existingAuto || []) {
      existingMap.set(`${s.match_id}::${s.auto_source_id}`, s);
    }

    // Fetch manual (non-auto) servers to determine base display_order per match.
    // Auto servers must be placed AFTER all manual servers, preserving manual order.
    const { data: manualServers } = await supabase
      .from("streaming_servers")
      .select("match_id, display_order")
      .in("match_id", matchIds)
      .is("auto_source_id", null);

    const manualMaxOrder = new Map<string, number>();
    for (const s of manualServers || []) {
      const cur = manualMaxOrder.get(s.match_id) || 0;
      if ((s.display_order || 0) > cur) manualMaxOrder.set(s.match_id, s.display_order || 0);
    }

    let totalAdded = 0, totalUpdated = 0, totalKept = 0;
    const seenKeys = new Set<string>();
    // Track per-match server counter to name "Server 1, Server 2, ..."
    const matchServerCount = new Map<string, number>();

    // 4. For each source, fetch and process
    for (const src of sources) {
      const urlField: string = (src as any).url_field || "playerUrl";
      let entries: any[] = [];
      let status = "ok";
      try {
        const r = await fetch(src.url, { headers: { "User-Agent": "LovableBot/1.0" } });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        entries = Array.isArray(json) ? json : (json.matches || json.data || json.events || []);
      } catch (e) {
        log("source fetch failed", src.name, e);
        status = `error: ${(e as Error).message}`.slice(0, 200);
        await supabase.from("streaming_json_sources").update({
          last_synced_at: new Date().toISOString(),
          last_sync_status: status,
        }).eq("id", src.id);
        continue;
      }

      // 5. Match entries to matches
      const useEntryName: boolean = !!(src as any).use_entry_name;
      for (const m of matches) {
        const aTeam = m.team_a as any;
        const bTeam = m.team_b as any;
        const aName = aTeam?.name || "";
        const bName = bTeam?.name || "";
        if (!aName || !bName) continue;
        const aTerms = buildMatchTerms(aName, aTeam?.short_name || "", aTeam?.aliases);
        const bTerms = buildMatchTerms(bName, bTeam?.short_name || "", bTeam?.aliases);

        let idx = 0;
        for (const e of entries) {
          const ename = e.name || e.title || e.match_name || "";
          if (!ename) continue;
          if (!entryMatchesTeams(ename, aTerms, bTerms)) { idx++; continue; }

          // Read the configured field (supports dotted path like "stream.url")
          const playerUrl: string = String(
            urlField.split(".").reduce((acc: any, k) => (acc == null ? acc : acc[k]), e) ?? ""
          );
          if (!playerUrl) continue;

          // Build a stable auto_source_id: source + entry id/url
          const entryKey = e.id || e.matchUrl || `${ename}-${idx}`;
          const autoId = `${src.id}::${urlField}::${entryKey}`;
          const dedupKey = `${m.id}::${autoId}`;
          if (seenKeys.has(dedupKey)) { idx++; continue; }
          seenKeys.add(dedupKey);

          // Increment per-match counter -> Server 1, Server 2, ...
          const nextNum = (matchServerCount.get(m.id) || 0) + 1;
          matchServerCount.set(m.id, nextNum);
          // display_order is placed AFTER manual servers so manual ones keep their position.
          const orderPos = (manualMaxOrder.get(m.id) || 0) + nextNum;
          // If source has "use entry name" enabled, prefer the JSON entry's
          // serverName / server_name / channelName field; fall back to entry name.
          const rawName = useEntryName
            ? (e.serverName || e.server_name || e.channelName || e.channel || ename)
            : "";
          const entryName = String(rawName).trim();
          const serverName = entryName || `Server ${nextNum}`;
          const existing = existingMap.get(dedupKey);

          if (existing) {
            if (existing.server_url !== playerUrl || existing.server_name !== serverName) {
              await supabase.from("streaming_servers").update({
                server_url: playerUrl,
                server_name: serverName,
                is_working: true,
                display_order: orderPos,
              }).eq("id", existing.id);
              totalUpdated++;
            } else if ((existing.display_order || 0) !== orderPos) {
              await supabase.from("streaming_servers").update({
                display_order: orderPos,
              }).eq("id", existing.id);
              totalUpdated++;
            } else {
              totalKept++;
            }
          } else {
            await supabase.from("streaming_servers").insert({
              match_id: m.id,
              server_name: serverName,
              server_url: playerUrl,
              server_type: "iframe",
              display_order: orderPos,
              is_active: true,
              auto_source_id: autoId,
            });
            totalAdded++;
          }
          idx++;
        }
      }

      await supabase.from("streaming_json_sources").update({
        last_synced_at: new Date().toISOString(),
        last_sync_status: status,
      }).eq("id", src.id);
    }

    // 6. Remove auto-imported servers that no longer appear in any feed
    let totalRemoved = 0;
    for (const s of existingAuto || []) {
      const key = `${s.match_id}::${s.auto_source_id}`;
      if (!seenKeys.has(key)) {
        // Only delete if its source prefix matches a still-active source we processed
        const srcId = String(s.auto_source_id).split("::")[0];
        if (sources.some((x: any) => x.id === srcId)) {
          await supabase.from("streaming_servers").delete().eq("id", s.id);
          totalRemoved++;
        }
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      sources: sources.length,
      matches: matches.length,
      added: totalAdded,
      updated: totalUpdated,
      kept: totalKept,
      removed: totalRemoved,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    log("fatal", e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});