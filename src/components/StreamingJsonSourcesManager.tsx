import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, RefreshCw, Globe, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface JsonSource {
  id: string;
  name: string;
  url: string;
  is_active: boolean;
  last_synced_at: string | null;
  last_sync_status: string | null;
}

const StreamingJsonSourcesManager = () => {
  const { toast } = useToast();
  const [sources, setSources] = useState<JsonSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("streaming_json_sources" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    setSources((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!name.trim() || !url.trim()) {
      toast({ title: "Name and URL required", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("streaming_json_sources" as any).insert({
      name: name.trim(), url: url.trim(), is_active: true,
    });
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    setName(""); setUrl("");
    toast({ title: "Source added" });
    load();
  };

  const toggle = async (s: JsonSource) => {
    await supabase.from("streaming_json_sources" as any)
      .update({ is_active: !s.is_active }).eq("id", s.id);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("streaming_json_sources" as any).delete().eq("id", id);
    toast({ title: "Source removed" });
    load();
  };

  const runNow = async () => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("sync-streaming-from-json", { body: {} });
    setRunning(false);
    if (error) return toast({ title: "Sync failed", description: error.message, variant: "destructive" });
    toast({ title: "Sync complete", description: JSON.stringify(data) });
    load();
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><Globe className="w-4 h-4" /> Auto Streaming JSON Sources</h3>
            <p className="text-xs text-muted-foreground">
              Add JSON feed URLs. Servers auto-sync every 5 minutes by matching team names.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={runNow} disabled={running}>
            {running ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
            Run Sync Now
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-2">
          <Input placeholder="Source name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="https://example.com/api/match.json" value={url} onChange={(e) => setUrl(e.target.value)} />
          <Button onClick={add}><Plus className="w-4 h-4 mr-1" />Add</Button>
        </div>

        {loading ? (
          <div className="text-center py-4"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
        ) : sources.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No JSON sources configured</p>
        ) : (
          <div className="space-y-2">
            {sources.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 p-2 border rounded-lg">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{s.name}</span>
                    {s.last_sync_status && s.last_sync_status !== "ok" && (
                      <Badge variant="destructive" className="text-[10px]">{s.last_sync_status}</Badge>
                    )}
                    {s.last_synced_at && (
                      <span className="text-[10px] text-muted-foreground">
                        synced {new Date(s.last_synced_at).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{s.url}</p>
                </div>
                <Switch checked={s.is_active} onCheckedChange={() => toggle(s)} />
                <Button size="sm" variant="ghost" onClick={() => remove(s.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StreamingJsonSourcesManager;