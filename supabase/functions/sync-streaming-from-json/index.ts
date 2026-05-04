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

function teamMatchScore(jsonName: string, teamA: string, teamB: string): number {
  const jt = new Set(tokens(jsonName));
  const a = tokens(teamA);
  const b = tokens(teamB);
  if (!a.length || !b.length) return 0;
  const aHits = a.filter((t) => jt.has(t)).length;
  const bHits = b.filter((t) => jt.has(t)).length;
  if (aHits === 0 || bHits === 0) return 0;
  return (aHits / a.length) + (bHits / b.length);
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
    // 1. Load active JSON sources
    const { data: sources, error: srcErr } = await supabase
      .from("streaming_json_sources")
      .select("*")
      .eq("is_active", true);
    if (srcErr) throw srcErr;
    if (!sources || sources.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "no sources" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Load matches that opt-in & are upcoming/live
    const { data: matches, error: mErr } = await supabase
      .from("matches")
      .select("id, status, auto_streaming_enabled, team_a:team_a_id(id,name,short_name), team_b:team_b_id(id,name,short_name)")
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
      .select("id, match_id, auto_source_id, server_url, server_name")
      .in("match_id", matchIds)
      .not("auto_source_id", "is", null);

    const existingMap = new Map<string, any>();
    for (const s of existingAuto || []) {
      existingMap.set(`${s.match_id}::${s.auto_source_id}`, s);
    }

    let totalAdded = 0, totalUpdated = 0, totalKept = 0;
    const seenKeys = new Set<string>();

    // 4. For each source, fetch and process
    for (const src of sources) {
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
      for (const m of matches) {
        const aName = (m.team_a as any)?.name || "";
        const bName = (m.team_b as any)?.name || "";
        if (!aName || !bName) continue;

        let idx = 0;
        for (const e of entries) {
          const ename = e.name || e.title || e.match_name || "";
          if (!ename) continue;
          const score = teamMatchScore(ename, aName, bName);
          if (score < 1.0) continue; // need at least all tokens of both teams matched

          const playerUrl: string = e.playerUrl || e.player_url || e.url || e.streamUrl || "";
          if (!playerUrl) continue;

          // Build a stable auto_source_id: source + entry id/url
          const entryKey = e.id || e.matchUrl || `${ename}-${idx}`;
          const autoId = `${src.id}::${entryKey}`;
          const dedupKey = `${m.id}::${autoId}`;
          if (seenKeys.has(dedupKey)) { idx++; continue; }
          seenKeys.add(dedupKey);

          const serverName = `${src.name}: ${ename}`.slice(0, 200);
          const existing = existingMap.get(dedupKey);

          if (existing) {
            if (existing.server_url !== playerUrl || existing.server_name !== serverName) {
              await supabase.from("streaming_servers").update({
                server_url: playerUrl,
                server_name: serverName,
                is_working: true,
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
              display_order: 999,
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