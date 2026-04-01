import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, Loader2, RefreshCw, CloudDownload, Settings2 } from "lucide-react";
import { Tournament, Team } from "@/hooks/useSportsData";
import SearchableSelect from "@/components/SearchableSelect";

interface PointsTableEntry {
  id: string;
  tournament_id: string;
  team_id: string;
  position: number;
  played: number;
  won: number;
  lost: number;
  tied: number;
  no_result: number;
  points: number;
  net_run_rate: number;
  runs_scored?: number;
  overs_faced?: number;
  runs_conceded?: number;
  overs_bowled?: number;
  group_name?: string | null;
  team?: Team;
}

interface PointsTableManagerProps {
  tournament: Tournament;
  teams: Team[];
}

const PointsTableManager = ({ tournament, teams }: PointsTableManagerProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [seriesIdDialogOpen, setSeriesIdDialogOpen] = useState(false);
  const [seriesIdInput, setSeriesIdInput] = useState('');
  const [editingEntry, setEditingEntry] = useState<PointsTableEntry | null>(null);
  const [form, setForm] = useState({
    team_id: '',
    position: 1,
    played: 0,
    won: 0,
    lost: 0,
    tied: 0,
    no_result: 0,
    points: 0,
    net_run_rate: 0,
    group_name: '',
  });

  // Initialize series ID from tournament
  useEffect(() => {
    if ((tournament as any).series_id) {
      setSeriesIdInput((tournament as any).series_id);
    }
  }, [tournament]);

  // Fetch points table entries for this tournament - sorted by position
  const { data: entries, isLoading } = useQuery({
    queryKey: ['tournament_points_table', tournament.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tournament_points_table')
        .select(`
          *,
          team:teams(*)
        `)
        .eq('tournament_id', tournament.id)
        .order('group_name')
        .order('position');
      
      if (error) throw error;
      return data as PointsTableEntry[];
    },
  });

  // Create mutation
  const createEntry = useMutation({
    mutationFn: async (entry: Omit<PointsTableEntry, 'id' | 'team'>) => {
      const { data, error } = await supabase
        .from('tournament_points_table')
        .insert(entry)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament_points_table', tournament.id] });
      toast({ title: "Entry added successfully" });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update mutation
  const updateEntry = useMutation({
    mutationFn: async ({ id, ...entry }: Partial<PointsTableEntry> & { id: string }) => {
      const { data, error } = await supabase
        .from('tournament_points_table')
        .update(entry)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament_points_table', tournament.id] });
      toast({ title: "Entry updated successfully" });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tournament_points_table')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament_points_table', tournament.id] });
      toast({ title: "Entry deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Recalculate positions mutation
  const recalculatePositions = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('recalculate_tournament_positions', {
        p_tournament_id: tournament.id
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament_points_table', tournament.id] });
      toast({ title: "Positions recalculated", description: "Rankings updated based on points, NRR, and wins" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Save series ID to tournament
  const saveSeriesId = useMutation({
    mutationFn: async (seriesId: string) => {
      const { error } = await supabase
        .from('tournaments')
        .update({ series_id: seriesId } as any)
        .eq('id', tournament.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
    },
  });

  // Sync points table from RapidAPI (Cricbuzz)
  const syncFromApi = useMutation({
    mutationFn: async (seriesId: string) => {
      // Save series ID for future use
      await saveSeriesId.mutateAsync(seriesId);
      
      const { data, error } = await supabase.functions.invoke('sync-points-table', {
        body: { tournamentId: tournament.id, seriesId }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.requiresSeriesId) {
        // Show series ID input dialog
        setSeriesIdDialogOpen(true);
      } else if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['tournament_points_table', tournament.id] });
        let message = `Updated: ${data.updated}, Inserted: ${data.inserted}`;
        if (data.skippedTeams && data.skippedTeams.length > 0) {
          message += `. Skipped teams: ${data.skippedTeams.join(', ')}`;
        }
        toast({ 
          title: "Points table synced", 
          description: message
        });
        setSeriesIdDialogOpen(false);
      } else {
        toast({ title: "Sync failed", description: data.error || 'Unknown error', variant: "destructive" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setEditingEntry(null);
    setForm({
      team_id: '',
      position: (entries?.length || 0) + 1,
      played: 0,
      won: 0,
      lost: 0,
      tied: 0,
      no_result: 0,
      points: 0,
      net_run_rate: 0,
      group_name: '',
    });
  };

  const handleEdit = (entry: PointsTableEntry) => {
    setEditingEntry(entry);
    setForm({
      team_id: entry.team_id,
      position: entry.position,
      played: entry.played,
      won: entry.won,
      lost: entry.lost,
      tied: entry.tied,
      no_result: entry.no_result,
      points: entry.points,
      net_run_rate: entry.net_run_rate,
      group_name: entry.group_name || '',
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.team_id) {
      toast({ title: "Please select a team", variant: "destructive" });
      return;
    }

    const entryData = {
      tournament_id: tournament.id,
      team_id: form.team_id,
      position: form.position,
      played: form.played,
      won: form.won,
      lost: form.lost,
      tied: form.tied,
      no_result: form.no_result,
      points: form.points,
      net_run_rate: form.net_run_rate,
      group_name: form.group_name || null,
    };

    if (editingEntry) {
      updateEntry.mutate({ id: editingEntry.id, ...entryData });
    } else {
      createEntry.mutate(entryData);
    }
  };

  const handleSyncClick = () => {
    // If series ID already saved, sync directly
    if ((tournament as any).series_id) {
      syncFromApi.mutate((tournament as any).series_id);
    } else {
      // Open series ID dialog
      setSeriesIdDialogOpen(true);
    }
  };

  const handleSyncWithSeriesId = () => {
    if (!seriesIdInput.trim()) {
      toast({ title: "Please enter Series ID", variant: "destructive" });
      return;
    }
    syncFromApi.mutate(seriesIdInput.trim());
  };

  // Get teams that are not already in the points table
  const availableTeams = teams.filter(
    team => !entries?.some(e => e.team_id === team.id) || editingEntry?.team_id === team.id
  );

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold">Points Table - {tournament.name}</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSyncClick}
            disabled={syncFromApi.isPending}
          >
            {syncFromApi.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <CloudDownload className="w-4 h-4 mr-1" />
            )}
            Sync from API
          </Button>
          {(tournament as any).series_id && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSeriesIdDialogOpen(true)}
              title="Change Series ID"
            >
              <Settings2 className="w-4 h-4" />
            </Button>
          )}
          {entries && entries.length > 1 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => recalculatePositions.mutate()}
              disabled={recalculatePositions.isPending}
            >
              {recalculatePositions.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-1" />
              )}
              Recalculate
            </Button>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Team
          </Button>
        </div>
      </div>

      {entries && entries.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2">#</th>
                <th className="text-left py-2 px-2">Team</th>
                <th className="text-left py-2 px-1">Group</th>
                <th className="text-center py-2 px-1">P</th>
                <th className="text-center py-2 px-1">W</th>
                <th className="text-center py-2 px-1">L</th>
                <th className="text-center py-2 px-1">T</th>
                <th className="text-center py-2 px-1">NR</th>
                <th className="text-center py-2 px-1">NRR</th>
                <th className="text-center py-2 px-1">Pts</th>
                <th className="text-right py-2 px-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => {
                // Calculate position within group
                const groupEntries = entries.filter(e => (e.group_name || '') === (entry.group_name || ''));
                const groupPosition = groupEntries.indexOf(entry) + 1;
                return (
                <tr key={entry.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2 px-2 font-medium">{entry.position || groupPosition}</td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      {entry.team?.logo_url && (
                        <img src={entry.team.logo_url} alt="" className="w-5 h-5 object-contain" />
                      )}
                      <span>{entry.team?.short_name || entry.team?.name}</span>
                    </div>
                  </td>
                  <td className="py-2 px-1 text-xs text-muted-foreground">
                    {entry.group_name || '-'}
                  </td>
                  <td className="text-center py-2 px-1">{entry.played}</td>
                  <td className="text-center py-2 px-1">{entry.won}</td>
                  <td className="text-center py-2 px-1">{entry.lost}</td>
                  <td className="text-center py-2 px-1">{entry.tied}</td>
                  <td className="text-center py-2 px-1">{entry.no_result}</td>
                  <td className="text-center py-2 px-1">
                    <span className={(Number(entry.net_run_rate) || 0) >= 0 ? 'text-green-500' : 'text-red-500'}>
                      {(() => { const n = Number(entry.net_run_rate); return Number.isFinite(n) ? `${n >= 0 ? '+' : ''}${n.toFixed(3)}` : '+0.000'; })()}
                    </span>
                  </td>
                  <td className="text-center py-2 px-1 font-bold">{entry.points}</td>
                  <td className="text-right py-2 px-2">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(entry)}>
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteEntry.mutate(entry.id)}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-center text-muted-foreground py-4">No entries yet. Add teams to the points table.</p>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEntry ? 'Edit Entry' : 'Add Team to Points Table'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Team</Label>
              <SearchableSelect
                options={availableTeams.map((team) => ({
                  value: team.id,
                  label: team.name,
                  sublabel: team.short_name,
                  imageUrl: team.logo_url,
                }))}
                value={form.team_id}
                onValueChange={(value) => setForm({ ...form, team_id: value })}
                placeholder="Select team"
                searchPlaceholder="Search teams..."
                emptyText="No teams found."
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Position</Label>
                <Input 
                  type="number" 
                  min={1}
                  value={form.position} 
                  onChange={(e) => setForm({ ...form, position: parseInt(e.target.value) || 1 })} 
                />
              </div>
              <div className="space-y-2">
                <Label>Played</Label>
                <Input 
                  type="number" 
                  min={0}
                  value={form.played} 
                  onChange={(e) => setForm({ ...form, played: parseInt(e.target.value) || 0 })} 
                />
              </div>
              <div className="space-y-2">
                <Label>Points</Label>
                <Input 
                  type="number" 
                  min={0}
                  value={form.points} 
                  onChange={(e) => setForm({ ...form, points: parseInt(e.target.value) || 0 })} 
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-2">
                <Label>Won</Label>
                <Input 
                  type="number" 
                  min={0}
                  value={form.won} 
                  onChange={(e) => setForm({ ...form, won: parseInt(e.target.value) || 0 })} 
                />
              </div>
              <div className="space-y-2">
                <Label>Lost</Label>
                <Input 
                  type="number" 
                  min={0}
                  value={form.lost} 
                  onChange={(e) => setForm({ ...form, lost: parseInt(e.target.value) || 0 })} 
                />
              </div>
              <div className="space-y-2">
                <Label>Tied</Label>
                <Input 
                  type="number" 
                  min={0}
                  value={form.tied} 
                  onChange={(e) => setForm({ ...form, tied: parseInt(e.target.value) || 0 })} 
                />
              </div>
              <div className="space-y-2">
                <Label>NR</Label>
                <Input 
                  type="number" 
                  min={0}
                  value={form.no_result} 
                  onChange={(e) => setForm({ ...form, no_result: parseInt(e.target.value) || 0 })} 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Net Run Rate</Label>
                <Input 
                  type="number" 
                  step="0.001"
                  value={form.net_run_rate} 
                  onChange={(e) => setForm({ ...form, net_run_rate: parseFloat(e.target.value) || 0 })} 
                />
              </div>
              <div className="space-y-2">
                <Label>Group Name</Label>
                <Input 
                  placeholder="e.g., Group A, Group B"
                  value={form.group_name} 
                  onChange={(e) => setForm({ ...form, group_name: e.target.value })} 
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button 
              variant="gradient" 
              onClick={handleSave}
              disabled={createEntry.isPending || updateEntry.isPending}
            >
              {(createEntry.isPending || updateEntry.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editingEntry ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Series ID Input Dialog */}
      <Dialog open={seriesIdDialogOpen} onOpenChange={setSeriesIdDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enter Cricbuzz Series ID</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the Series ID from Cricbuzz URL. For example, if the URL is:<br/>
              <code className="text-xs bg-muted px-1 py-0.5 rounded">cricbuzz.com/cricket-series/3718/...</code><br/>
              Then the Series ID is <strong>3718</strong>
            </p>
            {(tournament as any).series_id && (
              <p className="text-sm text-green-600 dark:text-green-400">
                ✓ Saved Series ID: <strong>{(tournament as any).series_id}</strong>
              </p>
            )}
            <div className="space-y-2">
              <Label>Series ID</Label>
              <Input
                placeholder="e.g., 3718"
                value={seriesIdInput}
                onChange={(e) => setSeriesIdInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSyncWithSeriesId();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSeriesIdDialogOpen(false)}>Cancel</Button>
            <Button 
              variant="gradient" 
              onClick={handleSyncWithSeriesId}
              disabled={!seriesIdInput.trim() || syncFromApi.isPending}
            >
              {syncFromApi.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Sync Points Table
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PointsTableManager;
