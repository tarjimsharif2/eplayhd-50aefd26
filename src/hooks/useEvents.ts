import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EventItem {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  location: string | null;
  year: number | null;
  description: string | null;
  event_start_time: string;
  event_end_time: string | null;
  status: string;
  tournament_id: string | null;
  is_active: boolean;
  is_priority: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventStreamingServer {
  id: string;
  event_id: string;
  server_name: string;
  server_url: string;
  server_type: 'iframe' | 'm3u8' | 'embed' | 'iframe_to_m3u8';
  display_order: number;
  is_active: boolean;
  referer_value: string | null;
  origin_value: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
}

export const useEvents = () => {
  return useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('is_active', true)
        .order('event_start_time', { ascending: true });
      if (error) throw error;
      return (data ?? []) as EventItem[];
    },
  });
};

export const useAllEvents = () => {
  return useQuery({
    queryKey: ['events', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('event_start_time', { ascending: false });
      if (error) throw error;
      return (data ?? []) as EventItem[];
    },
  });
};

export const useEventBySlug = (slug: string | undefined) => {
  return useQuery({
    queryKey: ['event', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('slug', slug!)
        .maybeSingle();
      if (error) throw error;
      return data as EventItem | null;
    },
    enabled: !!slug,
  });
};

export const useEventStreamingServers = (eventId: string | undefined) => {
  return useQuery({
    queryKey: ['event_streaming_servers', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_streaming_servers')
        .select('*')
        .eq('event_id', eventId!)
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      return (data ?? []) as EventStreamingServer[];
    },
    enabled: !!eventId,
  });
};

export const useSaveEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<EventItem> & { id?: string }) => {
      if (payload.id) {
        const { id, created_at, updated_at, ...rest } = payload as any;
        const { data, error } = await supabase.from('events').update(rest).eq('id', id).select().single();
        if (error) throw error;
        return data;
      }
      const { created_at, updated_at, id, ...rest } = payload as any;
      const { data, error } = await supabase.from('events').insert(rest).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
    },
  });
};

export const useDeleteEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
};

export const useSaveEventServer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<EventStreamingServer> & { id?: string; event_id: string }) => {
      if (payload.id) {
        const { id, created_at, updated_at, ...rest } = payload as any;
        const { data, error } = await supabase.from('event_streaming_servers').update(rest).eq('id', id).select().single();
        if (error) throw error;
        return data;
      }
      const { id, created_at, updated_at, ...rest } = payload as any;
      const { data, error } = await supabase.from('event_streaming_servers').insert(rest).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['event_streaming_servers', v.event_id] }),
  });
};

export const useDeleteEventServer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; event_id: string }) => {
      const { error } = await supabase.from('event_streaming_servers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['event_streaming_servers', v.event_id] }),
  });
};

// Compute effective status of an event based on time
export const getEffectiveEventStatus = (e: EventItem): 'upcoming' | 'live' | 'completed' => {
  const now = Date.now();
  const start = new Date(e.event_start_time).getTime();
  const end = e.event_end_time ? new Date(e.event_end_time).getTime() : start + 3 * 60 * 60 * 1000; // default 3h
  if (now < start) return 'upcoming';
  if (now >= start && now < end) return 'live';
  return 'completed';
};