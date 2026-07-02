import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BottomNavItem {
  id: string;
  label: string;
  url: string;
  icon_name: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useBottomNavItems = (activeOnly = false) => {
  return useQuery({
    queryKey: ['bottom_nav_items', activeOnly],
    queryFn: async (): Promise<BottomNavItem[]> => {
      let q = (supabase as any).from('bottom_nav_items').select('*').order('display_order');
      if (activeOnly) q = q.eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
};

export const useUpsertBottomNav = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: Partial<BottomNavItem>) => {
      if (item.id) {
        const { error } = await (supabase as any).from('bottom_nav_items').update(item).eq('id', item.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('bottom_nav_items').insert(item);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bottom_nav_items'] });
    },
  });
};

export const useDeleteBottomNav = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('bottom_nav_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bottom_nav_items'] }),
  });
};