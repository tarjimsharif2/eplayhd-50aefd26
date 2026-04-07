import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// RapidAPI Endpoints configuration
export interface RapidApiEndpoints {
  // Hosts
  cricbuzz_host: string;
  cricketapi_live_host: string;
  cricbuzz_image_host?: string;
  // Series list endpoints
  series_international_endpoint?: string;
  series_league_endpoint?: string;
  series_domestic_endpoint?: string;
  series_matches_endpoint?: string;
  // Match endpoints
  points_table_endpoint: string;
  squad_endpoint: string;
  scorecard_endpoint: string;
  live_matches_endpoint: string;
  match_squad_endpoint: string;
  match_info_endpoint?: string;
  match_commentary_endpoint?: string;
  team_squad_endpoint?: string;
  recent_matches_endpoint?: string;
  schedule_endpoint?: string;
  series_squads_endpoint?: string;
  series_squad_endpoint?: string;
}

// Full site settings (only accessible by admins)
export interface SiteSettings {
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
  // Cricket API settings (legacy - cricketdata.org)
  cricket_api_key: string | null;
  cricket_api_enabled: boolean;
  // API Cricket settings (api-cricket.com)
  api_cricket_key: string | null;
  api_cricket_enabled: boolean;
  // RapidAPI settings
  rapidapi_key: string | null;
  rapidapi_enabled: boolean;
  rapidapi_endpoints: RapidApiEndpoints | null;
  // SMTP settings
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_password: string | null;
  smtp_from_email: string | null;
  smtp_from_name: string | null;
  smtp_enabled: boolean;
  // Ads.txt
  ads_txt_content: string | null;
  // Custom code injection
  custom_header_code: string | null;
  custom_footer_code: string | null;
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
  playing_xi_auto_sync_source?: 'api_cricket' | 'espn' | null;
}

// Admin-only hook for full site settings (requires admin role)
export const useSiteSettings = () => {
  return useQuery({
    queryKey: ['site_settings_admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      
      if (error) {
        // If RLS blocks access, return null instead of throwing
        if (error.code === 'PGRST116' || error.message.includes('row-level security')) {
          console.warn('Access to full site settings denied - admin role required');
          return null;
        }
        throw error;
      }
      // Cast with unknown first to handle JSON type conversion
      return data as unknown as SiteSettings | null;
    },
  });
};

export const useUpdateSiteSettings = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...settings }: Partial<SiteSettings> & { id: string }) => {
      // Cast settings to unknown first to handle JSON type conversion
      const { data, error } = await supabase
        .from('site_settings')
        .update(settings as unknown as Record<string, unknown>)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site_settings'] });
      queryClient.invalidateQueries({ queryKey: ['site_settings_admin'] });
    },
  });
};
