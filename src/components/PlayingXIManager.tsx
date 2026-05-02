import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Edit2, Trash2, Loader2, Upload, CloudDownload, X, ChevronDown, ArrowUpDown, Wand2, Save, Check, History, UserPlus, UserMinus, User, Image } from "lucide-react";
import CricApiMatchBrowser from "@/components/CricApiMatchBrowser";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Team } from "@/hooks/useSportsData";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Player {
  id: string;
  match_id: string;
  team_id: string;
  player_name: string;
  player_role: string | null;
  is_captain: boolean;
  is_vice_captain: boolean;
  is_wicket_keeper: boolean;
  batting_order: number | null;
  is_bench?: boolean;
  change_status?: string | null;
  player_image?: string | null;
}

interface PreviousMatch {
  id: string;
  match_date: string;
  team_a_id: string;
  team_b_id: string;
  team_a: { name: string; short_name: string };
  team_b: { name: string; short_name: string };
  tournament?: { name: string } | null;
}

interface PlayingXIManagerProps {
  matchId: string;
  teamA: Team;
  teamB: Team;
  cricbuzzMatchId?: string | null;
  cricapiMatchId?: string | null;
}

// Hooks for Playing XI management
export const usePlayingXI = (matchId: string | undefined) => {
  return useQuery({
    queryKey: ['playing_xi', matchId],
    queryFn: async () => {
      if (!matchId) return [];
      
      const { data, error } = await supabase
        .from('match_playing_xi')
        .select('*')
        .eq('match_id', matchId)
        .order('batting_order', { ascending: true, nullsFirst: false });
      
      if (error) throw error;
      return data as Player[];
    },
    enabled: !!matchId,
  });
};

export const useCreatePlayer = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (player: Omit<Player, 'id'>) => {
      const { data, error } = await supabase
        .from('match_playing_xi')
        .insert(player)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['playing_xi', variables.match_id] });
    },
  });
};

export const useBulkCreatePlayers = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (players: Omit<Player, 'id'>[]) => {
      if (players.length === 0) return [];
      
      const { data, error } = await supabase
        .from('match_playing_xi')
        .insert(players)
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      if (variables.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['playing_xi', variables[0].match_id] });
      }
    },
  });
};

export const useUpdatePlayer = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, match_id, ...player }: Partial<Player> & { id: string; match_id: string }) => {
      const { data, error } = await supabase
        .from('match_playing_xi')
        .update(player)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return { ...data, match_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['playing_xi', data.match_id] });
    },
  });
};

export const useDeletePlayer = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, match_id }: { id: string; match_id: string }) => {
      const { error } = await supabase
        .from('match_playing_xi')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { match_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['playing_xi', data.match_id] });
    },
  });
};

const PLAYER_ROLES = [
  'Batsman',
  'Bowler',
  'All-rounder',
  'Wicket-keeper',
  'Opening Batsman',
  'Middle-order Batsman',
  'Fast Bowler',
  'Spin Bowler',
];

const PlayingXIManager = ({ matchId, teamA, teamB, cricbuzzMatchId, cricapiMatchId }: PlayingXIManagerProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: players, isLoading } = usePlayingXI(matchId);
  const createPlayer = useCreatePlayer();
  const bulkCreatePlayers = useBulkCreatePlayers();
  const updatePlayer = useUpdatePlayer();
  const deletePlayer = useDeletePlayer();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [activeTeam, setActiveTeam] = useState<string>(teamA.id);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [fetchingSquad, setFetchingSquad] = useState(false);
  const [clearingSquad, setClearingSquad] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);
  const [importingSquad, setImportingSquad] = useState(false);
  const [selectedPreviousMatch, setSelectedPreviousMatch] = useState<string | null>(null);
  const [importForTeam, setImportForTeam] = useState<string | null>(null);
  
  // Pending changes state - tracks local is_bench changes before saving
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({});

  // CricAPI Match Browser state
  const [cricapiBrowserOpen, setCricapiBrowserOpen] = useState(false);
  const [pendingCricapiSource, setPendingCricapiSource] = useState<{ forceRefresh: boolean; isMatchXI?: boolean } | null>(null);
  
  // Touch swap state for mobile
  const [selectedForSwap, setSelectedForSwap] = useState<Player | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [fetchingImages, setFetchingImages] = useState(false);
  
  const [form, setForm] = useState({
    player_name: '',
    player_role: '',
    is_captain: false,
    is_vice_captain: false,
    is_wicket_keeper: false,
    batting_order: null as number | null,
    change_status: '' as string,
    is_bench: true, // Default to bench/squad, not playing XI
    player_image: '' as string,
  });
  const [bulkText, setBulkText] = useState('');
  const [bulkAddType, setBulkAddType] = useState<'playing_xi' | 'bench' | 'squad'>('squad');

  // Fetch previous matches with same teams
  const { data: previousMatches, isLoading: loadingPreviousMatches } = useQuery({
    queryKey: ['previous_matches_for_import', teamA.id, teamB.id, matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          id,
          match_date,
          team_a_id,
          team_b_id,
          team_a:teams!matches_team_a_id_fkey(name, short_name),
          team_b:teams!matches_team_b_id_fkey(name, short_name),
          tournament:tournaments(name)
        `)
        .or(`and(team_a_id.eq.${teamA.id},team_b_id.eq.${teamB.id}),and(team_a_id.eq.${teamB.id},team_b_id.eq.${teamA.id}),team_a_id.eq.${teamA.id},team_b_id.eq.${teamA.id},team_a_id.eq.${teamB.id},team_b_id.eq.${teamB.id}`)
        .neq('id', matchId)
        .order('match_date', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as PreviousMatch[];
    },
    enabled: importDialogOpen,
  });

  // Fetch players from selected previous match
  const { data: previousMatchPlayers, isLoading: loadingPreviousPlayers } = useQuery({
    queryKey: ['previous_match_players', selectedPreviousMatch],
    queryFn: async () => {
      if (!selectedPreviousMatch) return [];
      const { data, error } = await supabase
        .from('match_playing_xi')
        .select('*')
        .eq('match_id', selectedPreviousMatch);

      if (error) throw error;
      return data as Player[];
    },
    enabled: !!selectedPreviousMatch,
  });

  const teamAPlayers = players?.filter(p => p.team_id === teamA.id) || [];
  const teamBPlayers = players?.filter(p => p.team_id === teamB.id) || [];

  // Get effective is_bench status (pending or actual)
  const getEffectiveBench = (player: Player) => {
    if (pendingChanges.hasOwnProperty(player.id)) {
      return pendingChanges[player.id];
    }
    return player.is_bench ?? true;
  };

  // Split into Playing XI and Bench based on pending changes
  const teamAPlayingXI = teamAPlayers.filter(p => !getEffectiveBench(p)).slice(0, 11);
  const teamABench = teamAPlayers.filter(p => getEffectiveBench(p));
  const teamBPlayingXI = teamBPlayers.filter(p => !getEffectiveBench(p)).slice(0, 11);
  const teamBBench = teamBPlayers.filter(p => getEffectiveBench(p));

  // Check if there are unsaved changes
  const hasUnsavedChanges = Object.keys(pendingChanges).length > 0;

  // Auto select first 11 players as Playing XI
  const handleAutoSelect = (teamId: string) => {
    const teamPlayers = teamId === teamA.id ? teamAPlayers : teamBPlayers;
    
    if (teamPlayers.length === 0) {
      toast({ title: "No players found", description: "Sync or add squad first", variant: "destructive" });
      return;
    }

    const newPending = { ...pendingChanges };
    
    // Mark first 11 as Playing XI (is_bench: false), rest as bench (is_bench: true)
    teamPlayers.forEach((player, index) => {
      newPending[player.id] = index >= 11; // First 11 = false (Playing XI), rest = true (Bench)
    });
    
    setPendingChanges(newPending);
    toast({ title: "Auto select complete", description: `First 11 added to Playing XI. Save to apply.` });
  };

  // Save all pending changes
  const handleSaveChanges = async () => {
    if (!hasUnsavedChanges) return;
    
    setSavingChanges(true);
    
    try {
      const updates = Object.entries(pendingChanges).map(([playerId, isBench]) => 
        supabase
          .from('match_playing_xi')
          .update({ is_bench: isBench })
          .eq('id', playerId)
      );
      
      await Promise.all(updates);
      
      setPendingChanges({});
      queryClient.invalidateQueries({ queryKey: ['playing_xi', matchId] });
      toast({ title: "Saved!", description: "Playing XI updated successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSavingChanges(false);
    }
  };

  // Toggle player between Playing XI and Bench (local state)
  const handleToggleBenchLocal = (player: Player) => {
    const currentStatus = getEffectiveBench(player);
    setPendingChanges(prev => ({
      ...prev,
      [player.id]: !currentStatus
    }));
  };

  // Touch handlers for mobile swap - works between XI players AND XI-to-Bench
  const handleTouchStart = useCallback((player: Player, isInXI: boolean) => {
    // Allow selection from any Playing XI player
    if (!isInXI) return;
    
    const timer = setTimeout(() => {
      setSelectedForSwap(player);
      // Vibrate on mobile if supported
      if (navigator.vibrate) navigator.vibrate(50);
    }, 500); // 500ms long press
    
    setLongPressTimer(timer);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  }, [longPressTimer]);

  // Swap two players - works for XI-to-XI or XI-to-Bench
  const handleTouchSwap = useCallback((targetPlayer: Player, targetIsInXI: boolean) => {
    if (!selectedForSwap || selectedForSwap.id === targetPlayer.id) return;
    
    if (targetIsInXI) {
      // XI-to-XI swap: just swap batting_order conceptually (both stay in XI)
      // Since both are in XI, we don't change is_bench, just show a message
      toast({ 
        title: "XI Players Swapped",
        description: `${targetPlayer.player_name} ↔ ${selectedForSwap.player_name} - Both are in Playing XI`
      });
    } else {
      // XI-to-Bench swap: move selected to bench, move target to XI
      setPendingChanges(prev => ({
        ...prev,
        [selectedForSwap.id]: true,  // Move to bench
        [targetPlayer.id]: false,     // Move to XI
      }));
      
      toast({ 
        title: "Swapped",
        description: `${targetPlayer.player_name} ↔ ${selectedForSwap.player_name}. Save to apply.`
      });
    }
    
    setSelectedForSwap(null);
  }, [selectedForSwap, toast]);

  const cancelSwapSelection = () => {
    setSelectedForSwap(null);
  };

  // Toggle player between Playing XI and Bench
  const handleToggleBench = async (player: Player) => {
    try {
      await updatePlayer.mutateAsync({
        id: player.id,
        match_id: matchId,
        is_bench: !player.is_bench,
      });
      toast({ 
        title: player.is_bench ? "Added to Playing XI" : "Moved to Bench",
        description: player.player_name
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // Swap two players (one from XI, one from Bench)
  const handleSwapPlayers = async (xiPlayer: Player, benchPlayer: Player) => {
    try {
      await Promise.all([
        updatePlayer.mutateAsync({
          id: xiPlayer.id,
          match_id: matchId,
          is_bench: true,
        }),
        updatePlayer.mutateAsync({
          id: benchPlayer.id,
          match_id: matchId,
          is_bench: false,
        }),
      ]);
      toast({ 
        title: "Players swapped",
        description: `${benchPlayer.player_name} ↔ ${xiPlayer.player_name}`
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const resetForm = () => {
    setEditingPlayer(null);
    setForm({
      player_name: '',
      player_role: '',
      is_captain: false,
      is_vice_captain: false,
      is_wicket_keeper: false,
      batting_order: null,
      change_status: '',
      is_bench: true, // Default to bench/squad
      player_image: '',
    });
  };

  const handleOpenDialog = (player?: Player, addToBench: boolean = true) => {
    if (player) {
      setEditingPlayer(player);
      setActiveTeam(player.team_id);
      setForm({
        player_name: player.player_name,
        player_role: player.player_role || '',
        is_captain: player.is_captain,
        is_vice_captain: player.is_vice_captain,
        is_wicket_keeper: player.is_wicket_keeper,
        batting_order: player.batting_order,
        change_status: player.change_status || '',
        is_bench: player.is_bench ?? true,
        player_image: player.player_image || '',
      });
    } else {
      resetForm();
      setForm(prev => ({ ...prev, is_bench: addToBench }));
    }
    setDialogOpen(true);
  };

  // Import squad from previous match - for a specific team
  const handleImportFromPreviousMatch = async () => {
    if (!selectedPreviousMatch || !previousMatchPlayers || previousMatchPlayers.length === 0 || !importForTeam) {
      toast({ title: "Error", description: "Select a team and match to import", variant: "destructive" });
      return;
    }

    setImportingSquad(true);

    try {
      const selectedMatch = previousMatches?.find(m => m.id === selectedPreviousMatch);
      if (!selectedMatch) throw new Error("Match not found");

      // Check if the selected team played in this match
      const teamPlayedInMatch = selectedMatch.team_a_id === importForTeam || selectedMatch.team_b_id === importForTeam;
      
      if (!teamPlayedInMatch) {
        toast({ title: "Error", description: "Selected team did not play in this match", variant: "destructive" });
        setImportingSquad(false);
        return;
      }

      // Filter players from that team only (team_id is consistent across all matches)
      const teamPlayersFromPrevious = previousMatchPlayers.filter(p => p.team_id === importForTeam);

      if (teamPlayersFromPrevious.length === 0) {
        toast({ title: "Error", description: "No players found for this team in selected match", variant: "destructive" });
        setImportingSquad(false);
        return;
      }

      // Always clear existing players for this team before importing
      const { error: deleteError } = await supabase
        .from('match_playing_xi')
        .delete()
        .eq('match_id', matchId)
        .eq('team_id', importForTeam);
      
      if (deleteError) throw deleteError;

      // Add players with correct team_id for current match
      const playersToAdd = teamPlayersFromPrevious.map(p => ({
        match_id: matchId,
        team_id: importForTeam,
        player_name: p.player_name,
        player_role: p.player_role,
        is_captain: p.is_captain,
        is_vice_captain: p.is_vice_captain,
        is_wicket_keeper: p.is_wicket_keeper,
        batting_order: p.batting_order,
        is_bench: p.is_bench ?? false,
        change_status: null,
        player_image: p.player_image || null,
      }));

      const { error } = await supabase
        .from('match_playing_xi')
        .insert(playersToAdd);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['playing_xi', matchId] });
      setImportDialogOpen(false);
      setSelectedPreviousMatch(null);
      setImportForTeam(null);
      
      const teamName = importForTeam === teamA.id ? teamA.short_name : teamB.short_name;
      toast({ title: "Squad imported!", description: `${playersToAdd.length} players imported for ${teamName}` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setImportingSquad(false);
    }
  };

  // Mark player as IN (new to squad)
  const handleMarkAsIn = async (player: Player) => {
    try {
      await updatePlayer.mutateAsync({
        id: player.id,
        match_id: matchId,
        change_status: player.change_status === 'in' ? null : 'in',
      });
      toast({ title: player.change_status === 'in' ? "Unmarked" : "Marked as IN" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // Mark player as OUT (dropped from squad)
  const handleMarkAsOut = async (player: Player) => {
    try {
      await updatePlayer.mutateAsync({
        id: player.id,
        match_id: matchId,
        change_status: player.change_status === 'out' ? null : 'out',
      });
      toast({ title: player.change_status === 'out' ? "Unmarked" : "Marked as OUT" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleOpenBulkDialog = (teamId: string) => {
    setActiveTeam(teamId);
    setBulkText('');
    setBulkDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.player_name.trim()) {
      toast({ title: "Error", description: "Player name is required", variant: "destructive" });
      return;
    }

    try {
      if (editingPlayer) {
        await updatePlayer.mutateAsync({
          id: editingPlayer.id,
          match_id: matchId,
          player_name: form.player_name.trim(),
          player_role: form.player_role || null,
          is_captain: form.is_captain,
          is_vice_captain: form.is_vice_captain,
          is_wicket_keeper: form.is_wicket_keeper,
          batting_order: form.batting_order,
          is_bench: form.is_bench,
          player_image: form.player_image.trim() || null,
        } as any);
        toast({ title: "Player updated successfully" });
      } else {
        await createPlayer.mutateAsync({
          match_id: matchId,
          team_id: activeTeam,
          player_name: form.player_name.trim(),
          player_role: form.player_role || null,
          is_captain: form.is_captain,
          is_vice_captain: form.is_vice_captain,
          is_wicket_keeper: form.is_wicket_keeper,
          batting_order: form.batting_order,
          is_bench: form.is_bench,
          player_image: form.player_image.trim() || null,
        } as any);
        toast({ title: form.is_bench ? "Player added to Squad" : "Player added to Playing XI" });
      }
      setDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleBulkAdd = async () => {
    const lines = bulkText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length === 0) {
      toast({ title: "Error", description: "Please enter at least one player name", variant: "destructive" });
      return;
    }

    const currentTeamPlayers = activeTeam === teamA.id ? teamAPlayers : teamBPlayers;
    const currentPlayingXI = currentTeamPlayers.filter(p => !p.is_bench).length;
    
    // For Playing XI mode, check if we have space
    if (bulkAddType === 'playing_xi') {
      const availableSlots = 11 - currentPlayingXI;
      if (lines.length > availableSlots) {
        toast({ 
          title: "Error", 
          description: `Only ${availableSlots} Playing XI slots available. You entered ${lines.length} players.`, 
          variant: "destructive" 
        });
        return;
      }
    }

    const playersToAdd: Omit<Player, 'id'>[] = lines.map((name, index) => {
      // Parse player name with optional markers: (C), (VC), (WK)
      let playerName = name;
      let isCaptain = false;
      let isViceCaptain = false;
      let isWicketKeeper = false;

      if (name.includes('(C)') || name.includes('(c)')) {
        isCaptain = true;
        playerName = playerName.replace(/\(C\)/gi, '').trim();
      }
      if (name.includes('(VC)') || name.includes('(vc)')) {
        isViceCaptain = true;
        playerName = playerName.replace(/\(VC\)/gi, '').trim();
      }
      if (name.includes('(WK)') || name.includes('(wk)')) {
        isWicketKeeper = true;
        playerName = playerName.replace(/\(WK\)/gi, '').trim();
      }

      return {
        match_id: matchId,
        team_id: activeTeam,
        player_name: playerName,
        player_role: null,
        is_captain: isCaptain,
        is_vice_captain: isViceCaptain,
        is_wicket_keeper: isWicketKeeper,
        batting_order: currentTeamPlayers.length + index + 1,
        is_bench: bulkAddType !== 'playing_xi', // If playing_xi, is_bench = false; else true
      };
    });

    try {
      await bulkCreatePlayers.mutateAsync(playersToAdd);
      const typeLabel = bulkAddType === 'playing_xi' ? 'Playing XI' : 'Squad/Bench';
      toast({ title: `${playersToAdd.length} players added to ${typeLabel}` });
      setBulkDialogOpen(false);
      setBulkText('');
      setBulkAddType('squad');
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (player: Player) => {
    try {
      await deletePlayer.mutateAsync({ id: player.id, match_id: matchId });
      toast({ title: "Player removed successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // Client-side CricAPI match auto-detection (browser can reach cricapi.com, edge functions can't)
  const autoDetectCricapiMatchId = async (): Promise<string | null> => {
    // Get API key from site_settings (admin only)
    const { data: settings } = await supabase
      .from('site_settings')
      .select('cricket_api_key')
      .limit(1)
      .maybeSingle();

    if (!settings?.cricket_api_key) {
      throw new Error('CricAPI key not configured. Please add your API key in Settings → API Keys → CricAPI.');
    }

    const apiKey = settings.cricket_api_key;
    const normName = (n: string) => n.toLowerCase().replace(/\s*(women|men|u19|u-19|under-19|under 19)\s*/gi, '').replace(/\s+/g, ' ').trim();
    const normA = normName(teamA.name);
    const normB = normName(teamB.name);
    const shortA = teamA.short_name?.toLowerCase().trim() || '';
    const shortB = teamB.short_name?.toLowerCase().trim() || '';

    const findInList = (matches: any[]): string | null => {
      for (const m of matches) {
        if (!m.teams || m.teams.length < 2) continue;
        const t1 = normName(m.teams[0]);
        const t2 = normName(m.teams[1]);
        const s1 = m.teamInfo?.[0]?.shortname?.toLowerCase().trim() || '';
        const s2 = m.teamInfo?.[1]?.shortname?.toLowerCase().trim() || '';

        const matchA = t1 === normA || t1.includes(normA) || normA.includes(t1) || s1 === shortA ||
                       t2 === normA || t2.includes(normA) || normA.includes(t2) || s2 === shortA;
        const matchB = t1 === normB || t1.includes(normB) || normB.includes(t1) || s1 === shortB ||
                       t2 === normB || t2.includes(normB) || normB.includes(t2) || s2 === shortB;
        if (matchA && matchB) {
          console.log(`[CricAPI Client] Found match: "${m.name}" (ID: ${m.id})`);
          return m.id;
        }
      }
      return null;
    };

    // Try currentMatches first
    try {
      const res = await fetch(`https://api.cricapi.com/v1/currentMatches?apikey=${apiKey}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && data.data?.length > 0) {
          const found = findInList(data.data);
          if (found) return found;
        }
      }
    } catch (e) {
      console.warn('[CricAPI Client] currentMatches failed:', e);
    }

    // Fallback to matches (includes upcoming) - paginate through multiple pages
    for (let offset = 0; offset <= 75; offset += 25) {
      try {
        const res = await fetch(`https://api.cricapi.com/v1/matches?apikey=${apiKey}&offset=${offset}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'success' && data.data?.length > 0) {
            const found = findInList(data.data);
            if (found) return found;
            // If fewer results than page size, no more pages
            if (data.data.length < 25) break;
          } else {
            break; // No more data
          }
        }
      } catch (e) {
        console.warn(`[CricAPI Client] matches list (offset=${offset}) failed:`, e);
        break;
      }
    }

    return null;
  };

  // Fetch squad from RapidAPI (Cricbuzz)
  const handleFetchSquad = async (source: 'cricbuzz' | 'espn' | 'scrape' | 'rapidapi' | 'cricapi' | 'cricapi_xi' | 'api_cricket' | 'sofascore' | 'crex', forceRefresh = false) => {
    setFetchingSquad(true);

    // Always enrich player images from Sofascore (name-matched), regardless of lineup source
    const enrichImagesFromSofascore = async () => {
      try {
        await supabase.functions.invoke('enrich-player-images-sofascore', {
          body: { matchId },
        });
        queryClient.invalidateQueries({ queryKey: ['playing_xi', matchId] });
      } catch (e) {
        console.warn('[PlayingXI] Sofascore image enrich failed:', e);
      }
    };

    // Enrich bench + player images from Crex (regardless of XI source)
    const enrichFromCrex = async () => {
      try {
        await supabase.functions.invoke('enrich-from-crex', {
          body: { matchId },
        });
        queryClient.invalidateQueries({ queryKey: ['playing_xi', matchId] });
      } catch (e) {
        console.warn('[PlayingXI] Crex enrich failed:', e);
      }
    };

    try {
      // If force refresh, clear existing players first
      if (forceRefresh && players && players.length > 0) {
        const { error: deleteError } = await supabase
          .from('match_playing_xi')
          .delete()
          .eq('match_id', matchId);
        
        if (deleteError) {
          throw new Error('Failed to clear existing players');
        }
      }

      // Handle Sofascore lineups sync
      if (source === 'sofascore') {
        toast({ title: "Syncing Lineups...", description: "Fetching from Sofascore..." });
        const response = await supabase.functions.invoke('sync-sofascore-playing-xi', {
          body: {
            matchId,
            teamAId: teamA.id,
            teamBId: teamB.id,
            teamAName: teamA.name,
            teamBName: teamB.name,
          },
        });

        if (response.error) {
          throw new Error(response.error.message || 'Failed to sync from Sofascore');
        }
        const result = response.data;
        if (!result?.success) {
          throw new Error(result?.error || 'Failed to sync from Sofascore');
        }
        toast({
          title: result.confirmedXI ? "✅ Confirmed XI Synced!" : "Squad Fetched",
          description: result.message || `Synced ${result.playersAdded} players from Sofascore`,
        });
        queryClient.invalidateQueries({ queryKey: ['playing_xi', matchId] });
        setFetchingSquad(false);
        // Sofascore source already adds images; still enrich any missing
        enrichImagesFromSofascore();
      enrichFromCrex();
        enrichFromCrex();
        return;
      }

      // Handle Crex.live squads sync (Playing XI + Bench + Player Images)
      if (source === 'crex') {
        toast({ title: "Syncing Squads...", description: "Fetching from Crex.live..." });
        const response = await supabase.functions.invoke('sync-crex-playing-xi', {
          body: {
            matchId,
            teamAId: teamA.id,
            teamBId: teamB.id,
            teamAName: teamA.name,
            teamBName: teamB.name,
          },
        });
        if (response.error) {
          throw new Error(response.error.message || 'Failed to sync from Crex');
        }
        const result = response.data;
        if (!result?.success) {
          throw new Error(result?.error || 'Failed to sync from Crex');
        }
        toast({
          title: result.confirmedXI ? "✅ Confirmed XI Synced!" : "Squad Fetched",
          description: result.message || `Synced ${result.playersAdded} players from Crex`,
        });
        queryClient.invalidateQueries({ queryKey: ['playing_xi', matchId] });
        setFetchingSquad(false);
        // Crex provides cricketvectors images; still try Sofascore enrich for any missing
        enrichImagesFromSofascore();
      enrichFromCrex();
        enrichFromCrex();
        return;
      }

      // Handle API Cricket lineups sync separately
      if (source === 'api_cricket') {
        toast({ title: "Syncing Lineups...", description: "Fetching playing XI from API Cricket..." });
        const response = await supabase.functions.invoke('api-cricket', {
          body: {
            action: 'syncLineups',
            matchId,
            teamAName: teamA.name,
            teamBName: teamB.name,
            teamAId: teamA.id,
            teamBId: teamB.id,
          },
        });

        if (response.error) {
          throw new Error(response.error.message || 'Failed to sync lineups');
        }

        const result = response.data;
        if (!result?.success) {
          throw new Error(result?.error || 'Failed to sync lineups from API Cricket');
        }

        toast({
          title: "✅ Lineups Synced!",
          description: result.message || `Synced players from API Cricket`,
        });
        queryClient.invalidateQueries({ queryKey: ['playing_xi', matchId] });
        setFetchingSquad(false);
        // Fetch player images from Sofascore by name match
        enrichImagesFromSofascore();
      enrichFromCrex();
        enrichFromCrex();
        return;
      }

      let functionName = 'sync-playing-xi';
      if (source === 'espn') {
        functionName = 'sync-espn-playing-xi';
      } else if (source === 'scrape') {
        functionName = 'scrape-playing-xi';
      } else if (source === 'rapidapi') {
        functionName = 'sync-rapidapi-playing-xi';
      } else if (source === 'cricapi' || source === 'cricapi_xi') {
        functionName = 'sync-cricapi-playing-xi';
      }
      
      // For CricAPI: auto-detect match ID from browser if not set, and fetch squad data client-side
      let detectedCricapiId: string | undefined;
      let clientSquadData: any = undefined;
      if (source === 'cricapi' || source === 'cricapi_xi') {
        let effectiveCricapiId = cricapiMatchId;
        
        if (!effectiveCricapiId) {
          // Always open the CricAPI Match Browser for manual selection
          setPendingCricapiSource({ forceRefresh: players && players.length > 0 ? true : false, isMatchXI: source === 'cricapi_xi' });
          setCricapiBrowserOpen(true);
          setFetchingSquad(false);
          return; // Exit - will resume after user selects a match
        }

        // Fetch data from browser (CricAPI blocks edge function IPs)
        toast({ title: source === 'cricapi_xi' ? "Fetching Match XI..." : "Fetching squad...", description: "Loading player data from CricAPI..." });
        const { data: settings } = await supabase
          .from('site_settings')
          .select('cricket_api_key')
          .limit(1)
          .maybeSingle();

        if (!settings?.cricket_api_key) {
          throw new Error('CricAPI key not configured. Please add your API key in Settings → API Keys → CricAPI.');
        }

        const apiEndpoint = source === 'cricapi_xi' ? 'match_xi' : 'match_squad';
        const squadUrl = `https://api.cricapi.com/v1/${apiEndpoint}?apikey=${settings.cricket_api_key}&id=${effectiveCricapiId}`;
        const squadRes = await fetch(squadUrl);
        if (!squadRes.ok) {
          throw new Error(`CricAPI returned status ${squadRes.status}`);
        }
        clientSquadData = await squadRes.json();
        if (clientSquadData.status !== 'success' || !clientSquadData.data || clientSquadData.data.length < 2) {
          throw new Error(`CricAPI returned: ${clientSquadData.status}. Teams found: ${clientSquadData.data?.length || 0}. Need at least 2 teams.`);
        }
        console.log(`[CricAPI Client] ${apiEndpoint} fetched: ${clientSquadData.data.length} teams, info:`, clientSquadData.info);

        // For match_xi: also fetch full squad to get bench players
        let clientSquadFullData: any = undefined;
        if (source === 'cricapi_xi') {
          try {
            const fullSquadUrl = `https://api.cricapi.com/v1/match_squad?apikey=${settings.cricket_api_key}&id=${effectiveCricapiId}`;
            const fullRes = await fetch(fullSquadUrl);
            if (fullRes.ok) {
              const fullData = await fullRes.json();
              if (fullData.status === 'success' && fullData.data && fullData.data.length >= 2) {
                clientSquadFullData = fullData;
                console.log(`[CricAPI Client] Full squad also fetched for bench players: ${fullData.data.length} teams`);
              }
            }
          } catch (e) {
            console.warn('[CricAPI Client] Could not fetch full squad for bench:', e);
          }
        }

        // Store full squad data for edge function
        if (clientSquadFullData) {
          clientSquadData._fullSquadData = clientSquadFullData;
        }
      }

      const response = await supabase.functions.invoke(functionName, {
        body: {
          matchId,
          cricbuzzMatchId,
          cricapiMatchId: detectedCricapiId || cricapiMatchId,
          clientSquadData: (source === 'cricapi' || source === 'cricapi_xi') ? clientSquadData : undefined,
          isMatchXI: source === 'cricapi_xi',
          teamAId: teamA.id,
          teamBId: teamB.id,
          teamAName: teamA.name,
          teamAShortName: teamA.short_name,
          teamBName: teamB.name,
          teamBShortName: teamB.short_name,
        },
      });

      if (response.error) {
        // Parse detailed error from scrape function
        let errorMessage = response.error.message || 'Failed to sync playing XI';
        try {
          const errorData = JSON.parse(response.error.message);
          if (errorData.message) {
            errorMessage = errorData.message;
          }
          if (errorData.sourceResults && Array.isArray(errorData.sourceResults)) {
            const sourceSummary = errorData.sourceResults
              .map((s: { name: string; teamA: number; teamB: number }) => `${s.name}: ${s.teamA}+${s.teamB}`)
              .join(', ');
            errorMessage = `${errorData.message || errorData.error}\n\nSources: ${sourceSummary}`;
          }
        } catch {
          // Not JSON, use original message
        }
        throw new Error(errorMessage);
      }

      const result = response.data;

      if (!result.success) {
        // Check if error has sourceResults
        let description = result.error || result.message;
        if (result.sourceResults && Array.isArray(result.sourceResults)) {
          const sourceSummary = result.sourceResults
            .map((s: { name: string; teamA: number; teamB: number }) => `${s.name}: ${s.teamA}+${s.teamB}`)
            .join(', ');
          description = `${result.message || result.error}\n\nSources: ${sourceSummary}\n\n${result.suggestion || ''}`;
        }
        toast({ 
          title: result.alreadyExists ? "Already synced" : "11+11 players not found", 
          description,
          variant: result.alreadyExists ? "default" : "destructive"
        });
        queryClient.invalidateQueries({ queryKey: ['playing_xi', matchId] });
        return;
      }

      // Refresh the query
      queryClient.invalidateQueries({ queryKey: ['playing_xi', matchId] });

      toast({ 
        title: "Squad synced!", 
        description: `${result.totalPlayers || 0} players added (${result.teamA?.length || 0} + ${result.teamB?.length || 0})`
      });

      // Always enrich player images from Sofascore (name-based)
      enrichImagesFromSofascore();
      enrichFromCrex();

    } catch (err: any) {
      console.error('Fetch squad error:', err);
      toast({ title: "Error", description: err.message || 'Failed to fetch squad', variant: "destructive" });
    } finally {
      setFetchingSquad(false);
    }
  };

  // Handle match selection from CricAPI browser
  const handleCricApiMatchSelected = async (selectedMatchId: string, matchName: string) => {
    toast({ title: "Match selected!", description: matchName });
    
    // Save the cricapi match ID to the match record
    try {
      await supabase
        .from('matches')
        .update({ cricapi_match_id: selectedMatchId })
        .eq('id', matchId);
    } catch (e) {
      console.warn('Could not save cricapi_match_id:', e);
    }

    // Now fetch squad with this match ID
    const forceRefresh = pendingCricapiSource?.forceRefresh || false;
    const isMatchXI = pendingCricapiSource?.isMatchXI || false;
    setPendingCricapiSource(null);
    
    setFetchingSquad(true);
    try {
      if (forceRefresh && players && players.length > 0) {
        await supabase
          .from('match_playing_xi')
          .delete()
          .eq('match_id', matchId);
      }

      // Fetch squad data from browser
      const { data: settings } = await supabase
        .from('site_settings')
        .select('cricket_api_key')
        .limit(1)
        .maybeSingle();

      if (!settings?.cricket_api_key) {
        throw new Error('CricAPI key not configured');
      }

      const apiEndpoint = isMatchXI ? 'match_xi' : 'match_squad';
      toast({ title: isMatchXI ? "Fetching Match XI..." : "Fetching squad...", description: "Loading player data from CricAPI..." });
      const squadUrl = `https://api.cricapi.com/v1/${apiEndpoint}?apikey=${settings.cricket_api_key}&id=${selectedMatchId}`;
      const squadRes = await fetch(squadUrl);
      if (!squadRes.ok) throw new Error(`CricAPI returned status ${squadRes.status}`);
      
      const clientSquadData = await squadRes.json();
      if (clientSquadData.status !== 'success' || !clientSquadData.data || clientSquadData.data.length < 2) {
        throw new Error(`${isMatchXI ? 'Match XI' : 'Squad'} data not available yet. Teams found: ${clientSquadData.data?.length || 0}`);
      }

      // For match_xi: also fetch full squad to get bench players
      if (isMatchXI) {
        try {
          const fullSquadUrl = `https://api.cricapi.com/v1/match_squad?apikey=${settings.cricket_api_key}&id=${selectedMatchId}`;
          const fullRes = await fetch(fullSquadUrl);
          if (fullRes.ok) {
            const fullData = await fullRes.json();
            if (fullData.status === 'success' && fullData.data && fullData.data.length >= 2) {
              clientSquadData._fullSquadData = fullData;
              console.log('[CricAPI Client] Full squad also fetched for bench players');
            }
          }
        } catch (e) {
          console.warn('[CricAPI Client] Could not fetch full squad for bench:', e);
        }
      }

      const response = await supabase.functions.invoke('sync-cricapi-playing-xi', {
        body: {
          matchId,
          cricapiMatchId: selectedMatchId,
          clientSquadData,
          isMatchXI,
          teamAId: teamA.id,
          teamBId: teamB.id,
          teamAName: teamA.name,
          teamAShortName: teamA.short_name,
          teamBName: teamB.name,
          teamBShortName: teamB.short_name,
        },
      });

      if (response.error) throw new Error(response.error.message);
      
      const result = response.data;
      if (!result.success) {
        toast({ 
          title: result.alreadyExists ? "Already synced" : "Squad sync issue", 
          description: result.error || result.message,
          variant: result.alreadyExists ? "default" : "destructive"
        });
      } else {
        toast({ 
          title: "Squad synced!", 
          description: `${result.totalPlayers || 0} players added (${result.teamA?.length || 0} + ${result.teamB?.length || 0})`
        });
      }
      queryClient.invalidateQueries({ queryKey: ['playing_xi', matchId] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setFetchingSquad(false);
    }
  };

  // Clear all players from the squad
  const handleClearSquad = async () => {
    if (!players || players.length === 0) {
      toast({ title: "No players to clear", variant: "destructive" });
      return;
    }

    setClearingSquad(true);

    try {
      const { error } = await supabase
        .from('match_playing_xi')
        .delete()
        .eq('match_id', matchId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['playing_xi', matchId] });
      toast({ title: "Squad cleared successfully" });
    } catch (err: any) {
      console.error('Clear squad error:', err);
      toast({ title: "Error", description: err.message || 'Failed to clear squad', variant: "destructive" });
    } finally {
      setClearingSquad(false);
    }
  };

  // Fetch missing player images from TheSportsDB
  const handleFetchMissingImages = async () => {
    if (!players || players.length === 0) return;
    
    const missingCount = players.filter(p => !p.player_image).length;
    if (missingCount === 0) {
      toast({ title: "All players have images", description: "No missing images to fetch" });
      return;
    }

    setFetchingImages(true);
    try {
      toast({ title: "Fetching images...", description: `Looking up ${missingCount} players on TheSportsDB...` });
      
      const response = await supabase.functions.invoke('fetch-player-images', {
        body: { matchId },
      });

      if (response.error) throw new Error(response.error.message);

      const result = response.data;
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['playing_xi', matchId] });
        toast({ 
          title: "Images fetched!", 
          description: `${result.updated}/${result.total} missing images found` 
        });
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setFetchingImages(false);
    }
  };

  const renderPlayerCard = (player: Player, benchPlayers: Player[], isInXI: boolean) => {
    const effectiveBench = getEffectiveBench(player);
    const hasPendingChange = pendingChanges.hasOwnProperty(player.id);
    const isSelectedForSwap = selectedForSwap?.id === player.id;
    
    // Check if this player is a valid swap target
    const isSwapTarget = selectedForSwap && selectedForSwap.id !== player.id;
    const canSwapWithThis = isSwapTarget && (isInXI || !isInXI); // Can swap with any player
    
    return (
      <Card 
        key={player.id} 
        className={`hover:border-primary/30 transition-all touch-none select-none ${
          effectiveBench ? 'opacity-70' : ''
        } ${hasPendingChange ? 'ring-2 ring-yellow-500/50 bg-yellow-500/5' : ''} ${
          isSelectedForSwap ? 'ring-2 ring-primary bg-primary/10' : ''
        } ${canSwapWithThis ? 'cursor-pointer hover:bg-primary/20 border-primary/40' : ''}`}
        onTouchStart={() => handleTouchStart(player, isInXI)}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onClick={() => {
          // If we're in swap mode and clicking any other player, swap them
          if (canSwapWithThis) {
            handleTouchSwap(player, isInXI);
          }
        }}
      >
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Player Image */}
              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-muted/30">
                {player.player_image ? (
                  <img 
                    src={player.player_image} 
                    alt={player.player_name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      const fallback = (e.target as HTMLImageElement).nextElementSibling;
                      if (fallback) (fallback as HTMLElement).style.display = 'flex';
                    }}
                  />
                ) : null}
                <div className={`w-full h-full flex items-center justify-center ${player.player_image ? 'hidden' : ''}`}>
                  <User className="w-4 h-4 text-muted-foreground/50" />
                </div>
              </div>
              {/* IN/OUT Status Badge */}
              {player.change_status === 'in' && (
                <Badge className="text-[9px] px-1 py-0 bg-green-500/20 text-green-400 border-green-500/30 gap-0.5">
                  <UserPlus className="w-2.5 h-2.5" />
                  IN
                </Badge>
              )}
              {player.change_status === 'out' && (
                <Badge className="text-[9px] px-1 py-0 bg-red-500/20 text-red-400 border-red-500/30 gap-0.5">
                  <UserMinus className="w-2.5 h-2.5" />
                  OUT
                </Badge>
              )}
              {!effectiveBench && (
                <span className="text-xs text-muted-foreground font-mono w-5">
                  #{isInXI ? (benchPlayers.length > 0 ? (player.batting_order || '-') : '-') : '-'}
                </span>
              )}
              <span className={`font-medium text-sm ${isSelectedForSwap ? 'text-primary' : ''}`}>
                {player.player_name}
              </span>
              {player.is_captain && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/10">C</Badge>
              )}
              {player.is_vice_captain && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">VC</Badge>
              )}
              {player.is_wicket_keeper && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">WK</Badge>
              )}
              {player.player_role && (
                <span className="text-xs text-muted-foreground">• {player.player_role}</span>
              )}
              {hasPendingChange && (
                <Badge className="text-[9px] px-1 py-0 bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                  unsaved
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {/* Mark as IN/OUT dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className={`h-7 w-7 ${player.change_status ? 'text-primary' : 'text-muted-foreground'}`}
                    title="Mark as IN/OUT"
                  >
                    {player.change_status === 'in' ? (
                      <UserPlus className="w-3 h-3 text-green-500" />
                    ) : player.change_status === 'out' ? (
                      <UserMinus className="w-3 h-3 text-red-500" />
                    ) : (
                      <UserPlus className="w-3 h-3" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-background border">
                  <DropdownMenuItem 
                    onClick={() => handleMarkAsIn(player)}
                    className={player.change_status === 'in' ? 'bg-green-500/10' : ''}
                  >
                    <UserPlus className="w-4 h-4 mr-2 text-green-500" />
                    {player.change_status === 'in' ? 'Remove IN mark' : 'Mark as IN (নতুন)'}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => handleMarkAsOut(player)}
                    className={player.change_status === 'out' ? 'bg-red-500/10' : ''}
                  >
                    <UserMinus className="w-4 h-4 mr-2 text-red-500" />
                    {player.change_status === 'out' ? 'Remove OUT mark' : 'Mark as OUT (বাদ)'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {isInXI && benchPlayers.length > 0 && !selectedForSwap && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-blue-500 hover:text-blue-600"
                      title="Swap with bench player"
                    >
                      <ArrowUpDown className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-background border max-h-60 overflow-y-auto">
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      Swap with:
                    </div>
                    {benchPlayers.map(benchPlayer => (
                      <DropdownMenuItem 
                        key={benchPlayer.id}
                        onClick={() => {
                          setPendingChanges(prev => ({
                            ...prev,
                            [player.id]: true,
                            [benchPlayer.id]: false,
                          }));
                        }}
                      >
                        {benchPlayer.player_name}
                        {benchPlayer.player_role && (
                          <span className="text-muted-foreground ml-1">• {benchPlayer.player_role}</span>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {/* Move to XI / Bench toggle button */}
              <Button
                size="icon"
                variant="ghost"
                className={`h-7 w-7 ${effectiveBench ? 'text-green-500 hover:text-green-600' : 'text-orange-500 hover:text-orange-600'}`}
                onClick={() => handleToggleBenchLocal(player)}
                title={effectiveBench ? 'Move to Playing XI' : 'Move to Bench'}
              >
                {effectiveBench ? <Plus className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => handleOpenDialog(player)}
              >
                <Edit2 className="w-3 h-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => handleDelete(player)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderTeamSection = (team: Team, playingXI: Player[], bench: Player[]) => {
    const allTeamPlayers = team.id === teamA.id ? teamAPlayers : teamBPlayers;
    
    return (
      <div className="space-y-4">
        {/* Swap mode indicator */}
        {selectedForSwap && (
          <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/30 rounded-lg">
            <span className="text-sm">
              <strong>{selectedForSwap.player_name}</strong> selected. Tap any player to swap.
            </span>
            <Button size="sm" variant="ghost" onClick={cancelSwapSelection}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Playing XI Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              {team.logo_url && (
                <img src={team.logo_url} alt={team.name} className="w-6 h-6 object-contain" />
              )}
              <h4 className="font-medium text-sm text-primary">⚙️ Playing XI</h4>
              <Badge variant="default" className="text-[10px]">
                {playingXI.length}/11
              </Badge>
            </div>
            <div className="flex gap-2 flex-wrap">
              {/* Auto Select Button */}
              {allTeamPlayers.length > 0 && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleAutoSelect(team.id)}
                  className="gap-1"
                >
                  <Wand2 className="w-3 h-3" />
                  Auto
                </Button>
              )}
              {/* Only show Add to XI if not full */}
              {playingXI.length < 11 && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => {
                    setActiveTeam(team.id);
                    handleOpenDialog(undefined, false); // Add to Playing XI
                  }}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add to XI
                </Button>
              )}
            </div>
          </div>
          {playingXI.length > 0 ? (
            <div className="space-y-2">
              {playingXI.map(p => renderPlayerCard(p, bench, true))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
              No players in Playing XI
            </p>
          )}
        </div>

        {/* Full Squad / Bench Section - Always show with Add buttons */}
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-sm text-muted-foreground">
                🪑 {playingXI.length > 0 ? 'Bench / Squad' : 'Full Squad'}
              </h4>
              <Badge variant="secondary" className="text-[10px]">
                {bench.length}
              </Badge>
              {selectedForSwap && (
                <span className="text-xs text-primary animate-pulse">← Tap to swap</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => {
                  setActiveTeam(team.id);
                  handleOpenDialog(undefined, true); // Add to Bench
                }}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add to Bench
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => handleOpenBulkDialog(team.id)}
              >
                <Upload className="w-3 h-3 mr-1" />
                Bulk Add
              </Button>
            </div>
          </div>
          {bench.length > 0 ? (
            <div className="space-y-2 pl-2 border-l-2 border-border/50">
              {bench.map(p => renderPlayerCard(p, [], false))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-3 border border-dashed rounded-lg">
              No bench players. Add players to the squad first.
            </p>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Squad Action Buttons */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Save Button - Left side */}
        <div>
          {hasUnsavedChanges && (
            <Button
              variant="default"
              size="sm"
              onClick={handleSaveChanges}
              disabled={savingChanges}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              {savingChanges ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Changes
            </Button>
          )}
        </div>
        
        {/* Right side buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={fetchingSquad}
                className="gap-2"
              >
                {fetchingSquad ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CloudDownload className="w-4 h-4" />
                )}
                {players && players.length > 0 ? 'Refresh Squad' : 'Fetch Squad'}
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-background border">
              <DropdownMenuItem 
                onClick={() => handleFetchSquad('api_cricket', players && players.length > 0)}
                disabled={fetchingSquad}
              >
                <CloudDownload className="w-4 h-4 mr-2" />
                API Cricket Lineups (api-cricket.com)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleFetchSquad('sofascore', players && players.length > 0)}
                disabled={fetchingSquad}
              >
                <CloudDownload className="w-4 h-4 mr-2" />
                Sofascore Lineups + Images
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleFetchSquad('crex', players && players.length > 0)}
                disabled={fetchingSquad}
              >
                <CloudDownload className="w-4 h-4 mr-2" />
                Crex.live (Squad + Bench + Images)
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleFetchSquad('cricapi', players && players.length > 0)}
                disabled={fetchingSquad}
              >
                <CloudDownload className="w-4 h-4 mr-2" />
                CricAPI Squad (cricapi.com)
                {!cricapiMatchId && <span className="text-xs text-muted-foreground ml-1">- Auto detect</span>}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleFetchSquad('cricapi_xi', players && players.length > 0)}
                disabled={fetchingSquad}
              >
                <CloudDownload className="w-4 h-4 mr-2" />
                CricAPI Match XI (Playing 11)
                {!cricapiMatchId && <span className="text-xs text-muted-foreground ml-1">- Auto detect</span>}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleFetchSquad('rapidapi', players && players.length > 0)}
                disabled={fetchingSquad}
              >
                <CloudDownload className="w-4 h-4 mr-2" />
                RapidAPI Cricbuzz
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleFetchSquad('cricbuzz', players && players.length > 0)}
                disabled={fetchingSquad}
              >
                <CloudDownload className="w-4 h-4 mr-2" />
                From Cricbuzz (Free)
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleFetchSquad('espn', players && players.length > 0)}
                disabled={fetchingSquad}
              >
                <CloudDownload className="w-4 h-4 mr-2" />
                From ESPN Cricinfo
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleFetchSquad('scrape', players && players.length > 0)}
                disabled={fetchingSquad}
              >
                <CloudDownload className="w-4 h-4 mr-2" />
                Scrape from Cricbuzz
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Import from Previous Match Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportDialogOpen(true)}
            className="gap-2"
          >
            <History className="w-4 h-4" />
            Import from Match
          </Button>
          
          {/* Fetch Missing Images Button */}
          {players && players.length > 0 && players.some(p => !p.player_image) && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleFetchMissingImages}
              disabled={fetchingImages}
              className="gap-2"
            >
              {fetchingImages ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Image className="w-4 h-4" />
              )}
              Fetch Images ({players.filter(p => !p.player_image).length})
            </Button>
          )}

          {players && players.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClearSquad}
              disabled={clearingSquad}
              className="gap-2"
            >
              {clearingSquad ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <X className="w-4 h-4" />
              )}
              Clear All
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue={teamA.id} className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value={teamA.id} className="flex-1 gap-2">
            {teamA.logo_url && <img src={teamA.logo_url} alt="" className="w-4 h-4 object-contain" />}
            {teamA.short_name || teamA.name}
            <Badge variant="secondary" className="text-[10px]">{teamAPlayers.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value={teamB.id} className="flex-1 gap-2">
            {teamB.logo_url && <img src={teamB.logo_url} alt="" className="w-4 h-4 object-contain" />}
            {teamB.short_name || teamB.name}
            <Badge variant="secondary" className="text-[10px]">{teamBPlayers.length}</Badge>
          </TabsTrigger>
        </TabsList>
        <TabsContent value={teamA.id} className="mt-4">
          {renderTeamSection(teamA, teamAPlayingXI, teamABench)}
        </TabsContent>
        <TabsContent value={teamB.id} className="mt-4">
          {renderTeamSection(teamB, teamBPlayingXI, teamBBench)}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Player Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPlayer ? 'Edit Player' : 'Add Player'} - {activeTeam === teamA.id ? teamA.name : teamB.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Add to Playing XI or Squad selection */}
            {!editingPlayer && (
              <div className="space-y-2">
                <Label>Add to</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={!form.is_bench ? "default" : "outline"}
                    onClick={() => setForm({ ...form, is_bench: false })}
                    className="flex-1"
                  >
                    Playing XI
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={form.is_bench ? "default" : "outline"}
                    onClick={() => setForm({ ...form, is_bench: true })}
                    className="flex-1"
                  >
                    Full Squad / Bench
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Player Name *</Label>
              <Input
                placeholder="e.g., Virat Kohli"
                value={form.player_name}
                onChange={(e) => setForm({ ...form, player_name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={form.player_role}
                  onValueChange={(v) => setForm({ ...form, player_role: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAYER_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Batting Order</Label>
                <Input
                  type="number"
                  min="1"
                  max="11"
                  placeholder="1-11"
                  value={form.batting_order || ''}
                  onChange={(e) => setForm({ 
                    ...form, 
                    batting_order: e.target.value ? parseInt(e.target.value) : null 
                  })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_captain"
                  checked={form.is_captain}
                  onCheckedChange={(checked) => setForm({ 
                    ...form, 
                    is_captain: checked,
                    is_vice_captain: checked ? false : form.is_vice_captain
                  })}
                />
                <Label htmlFor="is_captain" className="text-sm">Captain</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_vice_captain"
                  checked={form.is_vice_captain}
                  onCheckedChange={(checked) => setForm({ 
                    ...form, 
                    is_vice_captain: checked,
                    is_captain: checked ? false : form.is_captain
                  })}
                />
                <Label htmlFor="is_vice_captain" className="text-sm">Vice Captain</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_wk"
                  checked={form.is_wicket_keeper}
                  onCheckedChange={(checked) => setForm({ ...form, is_wicket_keeper: checked })}
                />
                <Label htmlFor="is_wk" className="text-sm">WK</Label>
              </div>
            </div>

            {/* Player Image URL */}
            <div className="space-y-2 pt-2 border-t">
              <Label className="flex items-center gap-1.5">
                <Image className="w-3.5 h-3.5" />
                Player Image URL
              </Label>
              <div className="flex gap-2 items-start">
                {form.player_image && (
                  <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-muted/30 border">
                    <img 
                      src={form.player_image} 
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '';
                      }}
                    />
                  </div>
                )}
                <Input
                  placeholder="https://example.com/player-photo.jpg"
                  value={form.player_image}
                  onChange={(e) => setForm({ ...form, player_image: e.target.value })}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                কাস্টম প্লেয়ার ইমেজ URL দিন। CricAPI থেকে অটোমেটিক আসলেও চাইলে বদলাতে পারবেন।
              </p>
            </div>

            {/* Edit mode: Toggle Playing XI / Bench */}
            {editingPlayer && (
              <div className="flex items-center space-x-2 pt-2 border-t">
                <Switch
                  id="is_bench_edit"
                  checked={!form.is_bench}
                  onCheckedChange={(checked) => setForm({ ...form, is_bench: !checked })}
                />
                <Label htmlFor="is_bench_edit" className="text-sm">
                  {form.is_bench ? 'In Bench/Squad' : 'In Playing XI'}
                </Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={createPlayer.isPending || updatePlayer.isPending}
            >
              {(createPlayer.isPending || updatePlayer.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {editingPlayer ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Add Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={(open) => {
        setBulkDialogOpen(open);
        if (!open) {
          setBulkAddType('squad');
          setBulkText('');
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Bulk Add Players - {activeTeam === teamA.id ? teamA.name : teamB.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Add type selection */}
            <div className="space-y-2">
              <Label>Add to</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={bulkAddType === 'playing_xi' ? "default" : "outline"}
                  onClick={() => setBulkAddType('playing_xi')}
                  className="flex-1"
                >
                  Playing XI
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={bulkAddType === 'squad' ? "default" : "outline"}
                  onClick={() => setBulkAddType('squad')}
                  className="flex-1"
                >
                  Full Squad / Bench
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {bulkAddType === 'playing_xi' 
                  ? 'Players will be added directly to Playing XI (max 11)' 
                  : 'Players will be added to the squad (can be moved to XI later)'}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Player Names (one per line)</Label>
              <Textarea
                placeholder={`Virat Kohli (C)\nRohit Sharma (VC)\nRishabh Pant (WK)\nJasprit Bumrah\n...`}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={10}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Add (C) for captain, (VC) for vice-captain, (WK) for wicket-keeper
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleBulkAdd} 
              disabled={bulkCreatePlayers.isPending}
            >
              {bulkCreatePlayers.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Add to {bulkAddType === 'playing_xi' ? 'Playing XI' : 'Squad'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import from Previous Match Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => {
        setImportDialogOpen(open);
        if (!open) {
          setSelectedPreviousMatch(null);
          setImportForTeam(null);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Import Squad from Previous Match
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Import for Team</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={importForTeam === teamA.id ? "default" : "outline"}
                  className="w-full"
                  onClick={() => {
                    setImportForTeam(teamA.id);
                    setSelectedPreviousMatch(null); // Reset match selection when switching team
                  }}
                >
                  {teamA.short_name || teamA.name}
                </Button>
                <Button
                  variant={importForTeam === teamB.id ? "default" : "outline"}
                  className="w-full"
                  onClick={() => {
                    setImportForTeam(teamB.id);
                    setSelectedPreviousMatch(null); // Reset match selection when switching team
                  }}
                >
                  {teamB.short_name || teamB.name}
                </Button>
              </div>
            </div>

            {importForTeam && (
              <>
                {loadingPreviousMatches ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : previousMatches && previousMatches.length > 0 ? (
                  <div className="space-y-3">
                    <Label>Select Match</Label>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {previousMatches
                        .filter(match => 
                          match.team_a_id === importForTeam || match.team_b_id === importForTeam
                        )
                        .map(match => (
                        <Card 
                          key={match.id}
                          className={`cursor-pointer transition-all hover:border-primary/50 ${
                            selectedPreviousMatch === match.id ? 'ring-2 ring-primary border-primary' : ''
                          }`}
                          onClick={() => setSelectedPreviousMatch(match.id)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-sm">
                                  {match.team_a?.short_name || match.team_a?.name} vs {match.team_b?.short_name || match.team_b?.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {match.match_date} {match.tournament?.name ? `• ${match.tournament.name}` : ''}
                                </p>
                              </div>
                              {selectedPreviousMatch === match.id && (
                                <Check className="w-4 h-4 text-primary" />
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    
                    {selectedPreviousMatch && (
                      <div className="pt-2 border-t">
                        {loadingPreviousPlayers ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading players...
                          </div>
                        ) : previousMatchPlayers && previousMatchPlayers.length > 0 ? (
                          <div className="text-sm text-muted-foreground">
                            <span className="text-foreground font-medium">
                              {previousMatchPlayers.filter(p => p.team_id === importForTeam).length}
                            </span> players found for {importForTeam === teamA.id ? teamA.short_name : teamB.short_name}
                          </div>
                        ) : (
                          <div className="text-sm text-destructive">
                            No players found in this match
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No previous matches found for this team</p>
                  </div>
                )}
              </>
            )}

            {!importForTeam && (
              <div className="text-center py-6 text-muted-foreground text-sm">
                Select a team above to see their previous matches
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setImportDialogOpen(false);
              setSelectedPreviousMatch(null);
              setImportForTeam(null);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleImportFromPreviousMatch}
              disabled={!selectedPreviousMatch || !importForTeam || importingSquad || (previousMatchPlayers?.filter(p => p.team_id === importForTeam).length === 0)}
            >
              {importingSquad ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CloudDownload className="w-4 h-4 mr-2" />
              )}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CricAPI Match Browser */}
      <CricApiMatchBrowser
        open={cricapiBrowserOpen}
        onClose={() => {
          setCricapiBrowserOpen(false);
          setPendingCricapiSource(null);
        }}
        onSelectMatch={handleCricApiMatchSelected}
        teamAName={teamA.name}
        teamBName={teamB.name}
      />
    </div>
  );
};

export default PlayingXIManager;
