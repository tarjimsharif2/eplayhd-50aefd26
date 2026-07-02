import { useState } from 'react';
import { useBottomNavItems, useUpsertBottomNav, useDeleteBottomNav, BottomNavItem } from '@/hooks/useBottomNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

const ICONS = [
  'Home', 'Tv', 'Radio', 'LayoutGrid', 'Trophy', 'Calendar', 'Star', 'Flame',
  'PlayCircle', 'Zap', 'Users', 'Award', 'Newspaper', 'Search', 'Menu',
  'Bell', 'Heart', 'Globe', 'Video', 'Grid3x3', 'List', 'Bookmark',
];

const IconPreview = ({ name, className }: { name: string; className?: string }) => {
  const C = (LucideIcons as any)[name] || LucideIcons.Circle;
  return <C className={className} />;
};

const empty = { label: '', url: '/', icon_name: 'Home', display_order: 0, is_active: true };

const BottomNavManager = () => {
  const { data: items, isLoading } = useBottomNavItems(false);
  const upsert = useUpsertBottomNav();
  const del = useDeleteBottomNav();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BottomNavItem | null>(null);
  const [form, setForm] = useState<any>(empty);

  const openNew = () => {
    setEditing(null);
    setForm({ ...empty, display_order: (items?.length || 0) + 1 });
    setOpen(true);
  };
  const openEdit = (it: BottomNavItem) => {
    setEditing(it);
    setForm({ label: it.label, url: it.url, icon_name: it.icon_name, display_order: it.display_order, is_active: it.is_active });
    setOpen(true);
  };
  const save = async () => {
    if (!form.label.trim() || !form.url.trim()) {
      toast({ title: 'Label and URL required', variant: 'destructive' });
      return;
    }
    try {
      await upsert.mutateAsync(editing ? { ...form, id: editing.id } : form);
      toast({ title: 'Saved' });
      setOpen(false);
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    }
  };
  const remove = async (id: string) => {
    if (!confirm('Delete this button?')) return;
    try {
      await del.mutateAsync(id);
      toast({ title: 'Deleted' });
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Mobile Bottom Navigation</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Add, edit, reorder buttons shown at the bottom of the mobile view.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Add Button</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? 'Edit Button' : 'New Button'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Label</Label>
                <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Home" />
              </div>
              <div>
                <Label>URL</Label>
                <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="/ or /channels" />
              </div>
              <div>
                <Label>Icon</Label>
                <div className="grid grid-cols-8 gap-2 max-h-48 overflow-y-auto p-2 border rounded-md">
                  {ICONS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setForm({ ...form, icon_name: n })}
                      className={`flex items-center justify-center p-2 rounded border ${form.icon_name === n ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-muted'}`}
                      title={n}
                    >
                      <IconPreview name={n} className="w-4 h-4" />
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Selected: {form.icon_name}</p>
              </div>
              <div>
                <Label>Display order</Label>
                <Input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label>Active</Label>
              </div>
              <Button onClick={save} disabled={upsert.isPending} className="w-full">
                {upsert.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
        ) : !items || items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No buttons yet.</p>
        ) : (
          <div className="space-y-2">
            {items.map((it) => (
              <div key={it.id} className="flex items-center gap-3 p-3 border rounded-md">
                <IconPreview name={it.icon_name} className="w-5 h-5" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{it.label}</div>
                  <div className="text-xs text-muted-foreground truncate">{it.url}</div>
                </div>
                <span className="text-xs text-muted-foreground">#{it.display_order}</span>
                {!it.is_active && <span className="text-xs px-2 py-0.5 rounded bg-muted">Hidden</span>}
                <Button size="sm" variant="ghost" onClick={() => openEdit(it)}><Edit className="w-4 h-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => remove(it.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BottomNavManager;