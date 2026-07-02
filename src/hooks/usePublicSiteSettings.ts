import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

// Public site settings (excludes sensitive fields like cricket_api_key)
export interface PublicSiteSettings {
  id: string;
  site_name: string;
  site_title: string;
  site_description: string | null;
  site_keywords: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  og_image_url: string | null;
  footer_text: string | null;
  google_analytics_id: string | null;
  created_at: string;
  updated_at: string;
  // Ad settings
  header_ad_code: string | null;
  sidebar_ad_code: string | null;
  footer_ad_code: string | null;
  in_article_ad_code: string | null;
  popup_ad_code: string | null;
  ads_enabled: boolean;
  google_adsense_id: string | null;
  // Additional SEO
  canonical_url: string | null;
  robots_txt: string | null;
  schema_org_enabled: boolean;
  twitter_handle: string | null;
  facebook_app_id: string | null;
  telegram_link: string | null;
  social_links: Record<string, string>;
  // Cricket API enabled flag (but NOT the key)
  cricket_api_enabled: boolean;
  // API Cricket enabled flag (api-cricket.com)
  api_cricket_enabled: boolean;
  // RapidAPI enabled flag (for Cricbuzz)
  rapidapi_enabled: boolean;
  // Custom code injection
  custom_header_code: string | null;
  custom_footer_code: string | null;
  // Banner slider settings
  slider_duration_seconds: number | null;
  // Video player load countdown (seconds)
  player_load_time_seconds: number | null;
  // Admin slug
  admin_slug: string | null;
  // Maintenance mode settings
  maintenance_mode: boolean;
  maintenance_title: string | null;
  maintenance_subtitle: string | null;
  maintenance_description: string | null;
  maintenance_estimated_time: string | null;
  maintenance_show_countdown: boolean;
  maintenance_end_time: string | null;
  maintenance_contact_email: string | null;
  maintenance_social_message: string | null;
  // Homepage settings
  homepage_completed_days: number | null;
  homepage_channels_limit: number | null;
  // Page-specific ad positions
  match_page_ad_positions: {
    before_player: boolean;
    after_player: boolean;
    sidebar: boolean;
    below_info: boolean;
  } | null;
  tournament_page_ad_positions: {
    before_matches: boolean;
    after_matches: boolean;
    sidebar: boolean;
    before_points_table: boolean;
    after_points_table: boolean;
  } | null;
  // Multiple ad codes
  multiple_ad_codes: Record<string, any[]> | null;
}

export const usePublicSiteSettings = () => {
  const queryClient = useQueryClient();

  // Subscribe to realtime changes on site_settings_public
  useEffect(() => {
    const channel = supabase
      .channel('site_settings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'site_settings_public',
        },
        () => {
          // Invalidate and refetch when settings change
          queryClient.invalidateQueries({ queryKey: ['site_settings_public'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['site_settings_public'],
    queryFn: async (): Promise<PublicSiteSettings | null> => {
      // Access the public view using type assertion
      const { data, error } = await (supabase as any)
        .from('site_settings_public')
        .select('*')
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as PublicSiteSettings | null;
    },
    staleTime: 1000 * 60, // Consider fresh for 1 minute
    refetchOnWindowFocus: true,
  });
};
