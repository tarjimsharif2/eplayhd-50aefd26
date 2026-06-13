import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Sport {
  id: string;
  name: string;
  icon_url: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  name: string;
  short_name: string;
  logo_url: string | null;
  logo_background_color: string | null;
  aliases?: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface Tournament {
  id: string;
  name: string;
  sport: string;
  season: string;
  logo_url: string | null;
  slug: string | null;
  is_active: boolean;
  show_in_menu: boolean;
  show_in_homepage: boolean;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  total_matches: number | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  is_completed: boolean;
  total_teams: number | null;
  total_venues: number | null;
  show_participating_teams: boolean | null;
  participating_teams_position: string | null;
  custom_participating_teams: unknown; // JSON type from database
  series_id: string | null; // Cricbuzz/API series ID for syncing
  logo_background_color: string | null;
  created_at: string;
  updated_at: string;
}

export type MatchResult = 'team_a_won' | 'team_b_won' | 'tied' | 'no_result' | 'draw' | null;

export interface GoalEvent {
  player: string;
  minute: string;
  assist?: string;
  type: 'goal' | 'penalty' | 'own_goal';
}

export interface Match {
  id: string;
  tournament_id: string | null;
  team_a_id: string;
  team_b_id: string;
  match_number: string | null;
  match_date: string;
  match_time: string;
  status: 'upcoming' | 'live' | 'completed' | 'abandoned' | 'postponed';
  venue: string | null;
  score_a: string | null;
  score_b: string | null;
  match_link: string | null;
  match_duration_minutes: number | null;
  match_start_time: string | null;
  match_end_time: string | null;
  is_priority: boolean;
  match_label: string | null;
  sport_id: string | null;
  slug: string | null;
  page_type: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  match_minute: number | null;
  match_format: string | null;
  test_day: number | null;
  is_stumps: boolean;
  stumps_time: string | null;
  day_start_time: string | null;
  next_day_start: string | null;
  match_result: MatchResult;
  result_margin: string | null;
  api_score_enabled: boolean;
  cricbuzz_match_id: string | null;
  manual_status_override: boolean;
  is_active: boolean;
  goals_team_a: GoalEvent[] | unknown;
  goals_team_b: GoalEvent[] | unknown;
  created_at: string;
  updated_at: string;
  tournament?: Tournament;
  team_a?: Team;
  team_b?: Team;
  sport?: Sport;
}

export interface Banner {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  is_active: boolean;
  display_order: number;
  banner_type: 'match' | 'tournament' | 'custom';
  match_id: string | null;
  tournament_id: string | null;
  subtitle: string | null;
  badge_type: 'none' | 'live' | 'upcoming' | 'watch_now';
  created_at: string;
  updated_at: string;
  // Joined relations
  match?: Match;
  tournament?: Tournament;
}

export interface Innings {
  id: string;
  match_id: string;
  innings_number: number;
  batting_team_id: string;
  runs: number;
  wickets: number;
  overs: number;
  declared: boolean;
  is_current: boolean;
  extras: number;
  created_at: string;
  updated_at: string;
  batting_team?: Team;
}
// Sports hooks
export const useSports = () => {
  return useQuery({
    queryKey: ['sports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sports')
        .select('*')
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data as Sport[];
    },
  });
};

export const useCreateSport = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (sport: Omit<Sport, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('sports')
        .insert(sport)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sports'] });
    },
  });
};

export const useUpdateSport = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...sport }: Partial<Sport> & { id: string }) => {
      const { data, error } = await supabase
        .from('sports')
        .update(sport)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sports'] });
    },
  });
};

export const useDeleteSport = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sports')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sports'] });
    },
  });
};

// Teams hooks
export const useTeams = () => {
  return useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Team[];
    },
  });
};

export const useCreateTeam = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (team: Omit<Team, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('teams')
        .insert(team)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });
};

export const useUpdateTeam = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...team }: Partial<Team> & { id: string }) => {
      const { data, error } = await supabase
        .from('teams')
        .update(team)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });
};

export const useDeleteTeam = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });
};

// Tournaments hooks
export const useTournaments = () => {
  return useQuery({
    queryKey: ['tournaments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Tournament[];
    },
  });
};

export const useCreateTournament = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (tournament: Record<string, unknown>) => {
      const { data, error } = await supabase
        .from('tournaments')
        .insert(tournament as any)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
    },
  });
};

export const useUpdateTournament = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...tournament }: { id: string } & Record<string, unknown>) => {
      const { data, error } = await supabase
        .from('tournaments')
        .update(tournament as any)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
    },
  });
};

export const useDeleteTournament = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
    },
  });
};

// Matches hooks
export const useMatches = () => {
  const queryClient = useQueryClient();
  
  // Set up real-time subscription for matches
  useEffect(() => {
    const channel = supabase
      .channel('matches-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
        },
        (payload) => {
          console.log('Match realtime update:', payload);
          // Invalidate and refetch matches when any change occurs
          queryClient.invalidateQueries({ queryKey: ['matches'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
  
  return useQuery({
    queryKey: ['matches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          tournament:tournaments(*),
          team_a:teams!matches_team_a_id_fkey(*),
          team_b:teams!matches_team_b_id_fkey(*),
          sport:sports(*)
        `)
        .order('is_priority', { ascending: false })
        .order('match_date')
        .order('match_time');
      
      if (error) throw error;
      return data as Match[];
    },
    staleTime: 0, // Data is immediately stale - allows invalidation to trigger refetch
    gcTime: 0, // Don't cache old data at all
    refetchInterval: 30000, // Backup polling every 30 seconds in case realtime misses
    refetchOnWindowFocus: true, // Refetch fresh data on window focus
    refetchOnMount: 'always' as const, // Always fetch fresh data on mount
    refetchOnReconnect: 'always' as const, // Always refetch when network reconnects
  });
};

export const useCreateMatch = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (match: Omit<Match, 'id' | 'created_at' | 'updated_at' | 'tournament' | 'team_a' | 'team_b' | 'sport' | 'goals_team_a' | 'goals_team_b'> & { goals_team_a?: unknown; goals_team_b?: unknown }) => {
      const { data, error } = await supabase
        .from('matches')
        .insert(match as any)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
  });
};

export const useUpdateMatch = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...match }: Partial<Omit<Match, 'goals_team_a' | 'goals_team_b'>> & { id: string; goals_team_a?: unknown; goals_team_b?: unknown }) => {
      const { data, error } = await supabase
        .from('matches')
        .update(match as any)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
  });
};

export const useDeleteMatch = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('matches')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
  });
};

// Banners hooks
export const useBanners = () => {
  return useQuery({
    queryKey: ['banners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('banners')
        .select(`
          *,
          match:matches(id, slug, team_a_id, team_b_id, status, match_date, match_time, venue, tournament_id, 
            team_a:teams!matches_team_a_id_fkey(id, name, short_name, logo_url),
            team_b:teams!matches_team_b_id_fkey(id, name, short_name, logo_url),
            tournament:tournaments(id, name, sport)
          ),
          tournament:tournaments(id, slug, name, sport, logo_url, season)
        `)
        .order('display_order');
      
      if (error) throw error;
      return data as Banner[];
    },
  });
};

export const useActiveBanners = () => {
  return useQuery({
    queryKey: ['banners', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('banners')
        .select(`
          *,
          match:matches(id, slug, team_a_id, team_b_id, status, match_date, match_time, venue, tournament_id, match_format,
            team_a:teams!matches_team_a_id_fkey(id, name, short_name, logo_url),
            team_b:teams!matches_team_b_id_fkey(id, name, short_name, logo_url),
            tournament:tournaments(id, name, sport)
          ),
          tournament:tournaments(id, slug, name, sport, logo_url, season)
        `)
        .eq('is_active', true)
        .order('display_order');
      
      if (error) throw error;
      return data as Banner[];
    },
  });
};

export const useCreateBanner = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (banner: Omit<Banner, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('banners')
        .insert(banner)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banners'] });
    },
  });
};

export const useUpdateBanner = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...banner }: Partial<Banner> & { id: string }) => {
      const { data, error } = await supabase
        .from('banners')
        .update(banner)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banners'] });
    },
  });
};

export const useDeleteBanner = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('banners')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banners'] });
    },
  });
};

// Innings hooks
export const useMatchInnings = (matchId: string | undefined) => {
  return useQuery({
    queryKey: ['match_innings', matchId],
    queryFn: async () => {
      if (!matchId) return [];
      
      const { data, error } = await supabase
        .from('match_innings')
        .select(`
          *,
          batting_team:teams(*)
        `)
        .eq('match_id', matchId)
        .order('innings_number');
      
      if (error) throw error;
      return data as Innings[];
    },
    enabled: !!matchId,
  });
};

export const useCreateInnings = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (innings: Omit<Innings, 'id' | 'created_at' | 'updated_at' | 'batting_team'>) => {
      const { data, error } = await supabase
        .from('match_innings')
        .insert(innings)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['match_innings', variables.match_id] });
    },
  });
};

export const useUpdateInnings = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, match_id, ...innings }: Partial<Innings> & { id: string; match_id: string }) => {
      const { data, error } = await supabase
        .from('match_innings')
        .update(innings)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return { ...data, match_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['match_innings', data.match_id] });
    },
  });
};

export const useDeleteInnings = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, match_id }: { id: string; match_id: string }) => {
      const { error } = await supabase
        .from('match_innings')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { match_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['match_innings', data.match_id] });
    },
  });
};

// User roles hooks
export const useIsAdmin = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['user_roles', userId],
    queryFn: async () => {
      if (!userId) return false;
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
      
      if (error) throw error;
      return !!data;
    },
    enabled: !!userId,
  });
};
