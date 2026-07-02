import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2, Radio, ExternalLink, Server } from 'lucide-react';
import {
  EventItem, EventStreamingServer, useAllEvents, useSaveEvent, useDeleteEvent,
  useEventStreamingServers, useSaveEventServer, useDeleteEventServer, getEffectiveEventStatus,
} from '@/hooks/useEvents';

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const toLocalDT = (iso: string | null | undefined) =>
  iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';

const emptyForm = (): Partial<EventItem> => ({
  name: '', slug: '', logo_url: '', location: '', year: new Date().getFullYear(),
  description: '', event_start_time: '', event_end_time: null,
  is_active: true, is_priority: false,
});

const EventsManager = () => {
  const { data: events, isLoading } = useAllEvents();
  const save = useSaveEvent();
  const del = useDeleteEvent();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<EventItem>>(emptyForm());
  const [serverEventId, setServerEventId] = useState<string | null>(null);

  const openNew = () => { setForm(emptyForm()); setOpen(true); };
  const openEdit = (e: EventItem) => {
    setForm({ ...e, event_start_time: toLocalDT(e.event_start_time), event_end_time: toLocalDT(e.event_end_time) as any });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.name || !form.event_start_time) { toast.error('Name and start time are required'); return; }
    const payload: any = {
      ...form,
      slug: form.slug || slugify(form.name),
      event_start_time: new Date(form.event_start_time as string).toISOString(),
      event_end_time: form.event_end_time ? new Date(form.event_end_time as string).toISOString() : null,
      year: form.year ? Number(form.year) : null,
    };
    try {
      await save.mutateAsync(payload);
      toast.success('Event saved');
      setOpen(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><Radio className="w-5 h-5" /> Events</CardTitle>
          <p className="text-sm text-muted-foreground">Non-team events (opening ceremony, auction, etc.)</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> New Event</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {events?.length === 0 && <p className="text-sm text-muted-foreground">No events yet.</p>}
        {events?.map((e) => {
          const status = getEffectiveEventStatus(e);
          return (
            <div key={e.id} className="flex items-center gap-3 p-3 border border-border rounded-lg">
              <div className="w-12 h-12 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                {e.logo_url ? <img src={e.logo_url} alt={e.name} className="w-full h-full object-contain" /> : <Radio className="w-5 h-5 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold truncate">{e.name}</p>
                  <Badge variant={status === 'live' ? 'destructive' : status === 'upcoming' ? 'default' : 'secondary'}>{status}</Badge>
                  {!e.is_active && <Badge variant="outline">inactive</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(e.event_start_time).toLocaleString()}{e.location ? ` • ${e.location}` : ''}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => window.open(`/event/${e.slug}`, '_blank')}><ExternalLink className="w-4 h-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => setServerEventId(e.id)}><Server className="w-4 h-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => openEdit(e)}><Pencil className="w-4 h-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => { if (confirm('Delete event?')) del.mutate(e.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          );
        })}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? 'Edit Event' : 'New Event'}</DialogTitle></DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Name *</Label>
              <Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slug || slugify(e.target.value) })} />
            </div>
            <div className="md:col-span-2">
              <Label>Slug</Label>
              <Input value={form.slug || ''} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} placeholder="opening-ceremony-2026" />
            </div>
            <div className="md:col-span-2">
              <Label>Logo URL</Label>
              <Input value={form.logo_url || ''} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} />
            </div>
            <div>
              <Label>Location</Label>
              <Input value={form.location || ''} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div>
              <Label>Year</Label>
              <Input type="number" value={form.year || ''} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Start Time *</Label>
              <Input type="datetime-local" value={form.event_start_time || ''} onChange={(e) => setForm({ ...form, event_start_time: e.target.value })} />
            </div>
            <div>
              <Label>End Time (optional)</Label>
              <Input type="datetime-local" value={(form.event_end_time as any) || ''} onChange={(e) => setForm({ ...form, event_end_time: e.target.value as any })} />
            </div>
            <div className="md:col-span-2">
              <Label>Description</Label>
              <Textarea rows={3} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={!!form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Active</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={!!form.is_priority} onCheckedChange={(v) => setForm({ ...form, is_priority: v })} />
              <Label>Featured / Priority</Label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {serverEventId && (
        <EventServersDialog eventId={serverEventId} onClose={() => setServerEventId(null)} />
      )}
    </Card>
  );
};

const EventServersDialog = ({ eventId, onClose }: { eventId: string; onClose: () => void }) => {
  const { data: servers } = useEventStreamingServers(eventId);
  const save = useSaveEventServer();
  const del = useDeleteEventServer();
  const [form, setForm] = useState<Partial<EventStreamingServer>>({ server_type: 'iframe', is_active: true, display_order: 0 });

  const add = async () => {
    if (!form.server_name || !form.server_url) { toast.error('Name and URL required'); return; }
    await save.mutateAsync({ ...form, event_id: eventId } as any);
    setForm({ server_type: 'iframe', is_active: true, display_order: (servers?.length ?? 0) });
    toast.success('Server added');
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Streaming Servers</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {servers?.map((s) => (
            <div key={s.id} className="flex items-center gap-2 p-2 border rounded">
              <Badge variant="outline">{s.server_type}</Badge>
              <span className="flex-1 truncate text-sm">{s.server_name}</span>
              <span className="text-xs text-muted-foreground truncate max-w-[200px]">{s.server_url}</span>
              <Button variant="ghost" size="sm" onClick={() => del.mutate({ id: s.id, event_id: eventId })}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          ))}
          {servers?.length === 0 && <p className="text-sm text-muted-foreground">No servers yet.</p>}
        </div>
        <div className="border-t pt-3 space-y-2">
          <p className="font-semibold text-sm">Add server</p>
          <div className="grid gap-2 md:grid-cols-2">
            <Input placeholder="Server name (e.g. Server 1)" value={form.server_name || ''} onChange={(e) => setForm({ ...form, server_name: e.target.value })} />
            <Select value={form.server_type} onValueChange={(v: any) => setForm({ ...form, server_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="iframe">iframe</SelectItem>
                <SelectItem value="m3u8">m3u8</SelectItem>
                <SelectItem value="embed">embed</SelectItem>
                <SelectItem value="iframe_to_m3u8">iframe_to_m3u8</SelectItem>
              </SelectContent>
            </Select>
            <Input className="md:col-span-2" placeholder="Server URL" value={form.server_url || ''} onChange={(e) => setForm({ ...form, server_url: e.target.value })} />
            <Input placeholder="Referer (optional)" value={form.referer_value || ''} onChange={(e) => setForm({ ...form, referer_value: e.target.value })} />
            <Input placeholder="Origin (optional)" value={form.origin_value || ''} onChange={(e) => setForm({ ...form, origin_value: e.target.value })} />
          </div>
          <Button onClick={add} disabled={save.isPending}><Plus className="w-4 h-4 mr-1" /> Add server</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EventsManager;