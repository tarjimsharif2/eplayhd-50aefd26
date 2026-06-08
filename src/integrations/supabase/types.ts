export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ad_click_logs: {
        Row: {
          blocked_until: string | null
          click_count: number
          created_at: string
          device_fingerprint: string
          first_click_at: string
          id: string
          last_click_at: string
          updated_at: string
        }
        Insert: {
          blocked_until?: string | null
          click_count?: number
          created_at?: string
          device_fingerprint: string
          first_click_at?: string
          id?: string
          last_click_at?: string
          updated_at?: string
        }
        Update: {
          blocked_until?: string | null
          click_count?: number
          created_at?: string
          device_fingerprint?: string
          first_click_at?: string
          id?: string
          last_click_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_otp_codes: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          is_used: boolean
          otp_code: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          is_used?: boolean
          otp_code: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          is_used?: boolean
          otp_code?: string
          user_id?: string
        }
        Relationships: []
      }
      banners: {
        Row: {
          badge_type: string | null
          banner_type: string | null
          created_at: string
          display_order: number | null
          id: string
          image_url: string
          is_active: boolean | null
          link_url: string | null
          match_id: string | null
          subtitle: string | null
          title: string
          tournament_id: string | null
          updated_at: string
        }
        Insert: {
          badge_type?: string | null
          banner_type?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          image_url: string
          is_active?: boolean | null
          link_url?: string | null
          match_id?: string | null
          subtitle?: string | null
          title: string
          tournament_id?: string | null
          updated_at?: string
        }
        Update: {
          badge_type?: string | null
          banner_type?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          image_url?: string
          is_active?: boolean | null
          link_url?: string | null
          match_id?: string | null
          subtitle?: string | null
          title?: string
          tournament_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "banners_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banners_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_streaming_servers: {
        Row: {
          ad_block_enabled: boolean | null
          channel_id: string
          clearkey_key: string | null
          clearkey_key_id: string | null
          cookie_value: string | null
          created_at: string
          display_order: number | null
          drm_license_url: string | null
          drm_scheme: string | null
          id: string
          is_active: boolean | null
          is_working: boolean | null
          origin_value: string | null
          original_display_order: number | null
          player_type: string | null
          referer_value: string | null
          server_name: string
          server_type: string
          server_url: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          ad_block_enabled?: boolean | null
          channel_id: string
          clearkey_key?: string | null
          clearkey_key_id?: string | null
          cookie_value?: string | null
          created_at?: string
          display_order?: number | null
          drm_license_url?: string | null
          drm_scheme?: string | null
          id?: string
          is_active?: boolean | null
          is_working?: boolean | null
          origin_value?: string | null
          original_display_order?: number | null
          player_type?: string | null
          referer_value?: string | null
          server_name: string
          server_type?: string
          server_url: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          ad_block_enabled?: boolean | null
          channel_id?: string
          clearkey_key?: string | null
          clearkey_key_id?: string | null
          cookie_value?: string | null
          created_at?: string
          display_order?: number | null
          drm_license_url?: string | null
          drm_scheme?: string | null
          id?: string
          is_active?: boolean | null
          is_working?: boolean | null
          origin_value?: string | null
          original_display_order?: number | null
          player_type?: string | null
          referer_value?: string | null
          server_name?: string
          server_type?: string
          server_url?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_streaming_servers_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          logo_background_color: string | null
          logo_url: string | null
          name: string
          seo_description: string | null
          seo_keywords: string | null
          seo_title: string | null
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          logo_background_color?: string | null
          logo_url?: string | null
          name: string
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          logo_background_color?: string | null
          logo_url?: string | null
          name?: string
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cricket_series: {
        Row: {
          created_at: string | null
          end_date: string | null
          id: string
          is_active: boolean | null
          last_synced_at: string | null
          match_count: number | null
          series_id: string
          series_name: string
          start_date: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          last_synced_at?: string | null
          match_count?: number | null
          series_id: string
          series_name: string
          start_date?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          last_synced_at?: string | null
          match_count?: number | null
          series_id?: string
          series_name?: string
          start_date?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      custom_menus: {
        Row: {
          created_at: string
          display_order: number | null
          icon_name: string | null
          id: string
          is_active: boolean | null
          menu_type: string | null
          open_in_new_tab: boolean | null
          parent_id: string | null
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          menu_type?: string | null
          open_in_new_tab?: boolean | null
          parent_id?: string | null
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          display_order?: number | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          menu_type?: string | null
          open_in_new_tab?: boolean | null
          parent_id?: string | null
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_menus_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "custom_menus"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_role_permissions: {
        Row: {
          created_at: string | null
          id: string
          permission: string
          role_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission: string
          role_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          permission?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      dynamic_pages: {
        Row: {
          content: string | null
          content_type: string
          created_at: string
          display_order: number | null
          id: string
          is_active: boolean | null
          og_image_url: string | null
          seo_description: string | null
          seo_keywords: string | null
          seo_title: string | null
          show_in_footer: boolean | null
          show_in_header: boolean | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          content_type?: string
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          og_image_url?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          show_in_footer?: boolean | null
          show_in_header?: boolean | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          content_type?: string
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          og_image_url?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          show_in_footer?: boolean | null
          show_in_header?: boolean | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      football_leagues: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          last_synced_at: string | null
          league_code: string
          league_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_synced_at?: string | null
          league_code: string
          league_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_synced_at?: string | null
          league_code?: string
          league_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      match_api_scores: {
        Row: {
          api_event_key: string | null
          away_overs: string | null
          away_score: string | null
          away_team: string | null
          batsmen: Json | null
          bowlers: Json | null
          created_at: string
          event_live: boolean | null
          extras: Json | null
          home_overs: string | null
          home_score: string | null
          home_team: string | null
          id: string
          last_synced_at: string
          match_id: string
          scorecard: Json | null
          status: string | null
          status_info: string | null
          toss: string | null
          updated_at: string
          venue: string | null
        }
        Insert: {
          api_event_key?: string | null
          away_overs?: string | null
          away_score?: string | null
          away_team?: string | null
          batsmen?: Json | null
          bowlers?: Json | null
          created_at?: string
          event_live?: boolean | null
          extras?: Json | null
          home_overs?: string | null
          home_score?: string | null
          home_team?: string | null
          id?: string
          last_synced_at?: string
          match_id: string
          scorecard?: Json | null
          status?: string | null
          status_info?: string | null
          toss?: string | null
          updated_at?: string
          venue?: string | null
        }
        Update: {
          api_event_key?: string | null
          away_overs?: string | null
          away_score?: string | null
          away_team?: string | null
          batsmen?: Json | null
          bowlers?: Json | null
          created_at?: string
          event_live?: boolean | null
          extras?: Json | null
          home_overs?: string | null
          home_score?: string | null
          home_team?: string | null
          id?: string
          last_synced_at?: string
          match_id?: string
          scorecard?: Json | null
          status?: string | null
          status_info?: string | null
          toss?: string | null
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_api_scores_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_innings: {
        Row: {
          batting_team_id: string
          created_at: string
          declared: boolean | null
          extras: number | null
          id: string
          innings_number: number
          is_current: boolean | null
          match_id: string
          overs: number | null
          runs: number | null
          updated_at: string
          wickets: number | null
        }
        Insert: {
          batting_team_id: string
          created_at?: string
          declared?: boolean | null
          extras?: number | null
          id?: string
          innings_number: number
          is_current?: boolean | null
          match_id: string
          overs?: number | null
          runs?: number | null
          updated_at?: string
          wickets?: number | null
        }
        Update: {
          batting_team_id?: string
          created_at?: string
          declared?: boolean | null
          extras?: number | null
          id?: string
          innings_number?: number
          is_current?: boolean | null
          match_id?: string
          overs?: number | null
          runs?: number | null
          updated_at?: string
          wickets?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "match_innings_batting_team_id_fkey"
            columns: ["batting_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_innings_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_playing_xi: {
        Row: {
          batting_order: number | null
          change_status: string | null
          created_at: string
          id: string
          is_bench: boolean | null
          is_captain: boolean | null
          is_vice_captain: boolean | null
          is_wicket_keeper: boolean | null
          match_id: string
          player_image: string | null
          player_name: string
          player_role: string | null
          sofascore_player_id: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          batting_order?: number | null
          change_status?: string | null
          created_at?: string
          id?: string
          is_bench?: boolean | null
          is_captain?: boolean | null
          is_vice_captain?: boolean | null
          is_wicket_keeper?: boolean | null
          match_id: string
          player_image?: string | null
          player_name: string
          player_role?: string | null
          sofascore_player_id?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          batting_order?: number | null
          change_status?: string | null
          created_at?: string
          id?: string
          is_bench?: boolean | null
          is_captain?: boolean | null
          is_vice_captain?: boolean | null
          is_wicket_keeper?: boolean | null
          match_id?: string
          player_image?: string | null
          player_name?: string
          player_role?: string | null
          sofascore_player_id?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_playing_xi_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_playing_xi_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_substitutions: {
        Row: {
          created_at: string
          id: string
          match_id: string
          minute: string
          player_in: string
          player_out: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          minute: string
          player_in: string
          player_out: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          minute?: string
          player_in?: string
          player_out?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_substitutions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_substitutions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          api_score_enabled: boolean | null
          auto_match_result_enabled: boolean | null
          auto_streaming_enabled: boolean
          auto_sync_enabled: boolean | null
          created_at: string
          crex_match_fkey: string | null
          cricapi_match_id: string | null
          cricbuzz_match_id: string | null
          day_start_time: string | null
          espn_event_id: string | null
          goals_team_a: Json | null
          goals_team_b: Json | null
          id: string
          is_active: boolean | null
          is_priority: boolean | null
          is_stumps: boolean | null
          last_api_sync: string | null
          manual_scoreboard_enabled: boolean
          manual_status_override: boolean | null
          match_date: string
          match_duration_minutes: number | null
          match_end_time: string | null
          match_format: string | null
          match_label: string | null
          match_link: string | null
          match_minute: number | null
          match_number: string | null
          match_result: string | null
          match_start_time: string | null
          match_time: string
          next_day_start: string | null
          page_type: string | null
          result_margin: string | null
          score_a: string | null
          score_b: string | null
          score_source: string | null
          seo_description: string | null
          seo_keywords: string | null
          seo_title: string | null
          show_playing_xi: boolean | null
          slug: string | null
          sofascore_event_id: string | null
          sport_id: string | null
          status: string
          stumps_time: string | null
          team_a_id: string
          team_b_id: string
          test_day: number | null
          toss_decision: string | null
          toss_winner_id: string | null
          tournament_id: string | null
          updated_at: string
          venue: string | null
        }
        Insert: {
          api_score_enabled?: boolean | null
          auto_match_result_enabled?: boolean | null
          auto_streaming_enabled?: boolean
          auto_sync_enabled?: boolean | null
          created_at?: string
          crex_match_fkey?: string | null
          cricapi_match_id?: string | null
          cricbuzz_match_id?: string | null
          day_start_time?: string | null
          espn_event_id?: string | null
          goals_team_a?: Json | null
          goals_team_b?: Json | null
          id?: string
          is_active?: boolean | null
          is_priority?: boolean | null
          is_stumps?: boolean | null
          last_api_sync?: string | null
          manual_scoreboard_enabled?: boolean
          manual_status_override?: boolean | null
          match_date: string
          match_duration_minutes?: number | null
          match_end_time?: string | null
          match_format?: string | null
          match_label?: string | null
          match_link?: string | null
          match_minute?: number | null
          match_number?: string | null
          match_result?: string | null
          match_start_time?: string | null
          match_time: string
          next_day_start?: string | null
          page_type?: string | null
          result_margin?: string | null
          score_a?: string | null
          score_b?: string | null
          score_source?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          show_playing_xi?: boolean | null
          slug?: string | null
          sofascore_event_id?: string | null
          sport_id?: string | null
          status?: string
          stumps_time?: string | null
          team_a_id: string
          team_b_id: string
          test_day?: number | null
          toss_decision?: string | null
          toss_winner_id?: string | null
          tournament_id?: string | null
          updated_at?: string
          venue?: string | null
        }
        Update: {
          api_score_enabled?: boolean | null
          auto_match_result_enabled?: boolean | null
          auto_streaming_enabled?: boolean
          auto_sync_enabled?: boolean | null
          created_at?: string
          crex_match_fkey?: string | null
          cricapi_match_id?: string | null
          cricbuzz_match_id?: string | null
          day_start_time?: string | null
          espn_event_id?: string | null
          goals_team_a?: Json | null
          goals_team_b?: Json | null
          id?: string
          is_active?: boolean | null
          is_priority?: boolean | null
          is_stumps?: boolean | null
          last_api_sync?: string | null
          manual_scoreboard_enabled?: boolean
          manual_status_override?: boolean | null
          match_date?: string
          match_duration_minutes?: number | null
          match_end_time?: string | null
          match_format?: string | null
          match_label?: string | null
          match_link?: string | null
          match_minute?: number | null
          match_number?: string | null
          match_result?: string | null
          match_start_time?: string | null
          match_time?: string
          next_day_start?: string | null
          page_type?: string | null
          result_margin?: string | null
          score_a?: string | null
          score_b?: string | null
          score_source?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          show_playing_xi?: boolean | null
          slug?: string | null
          sofascore_event_id?: string | null
          sport_id?: string | null
          status?: string
          stumps_time?: string | null
          team_a_id?: string
          team_b_id?: string
          test_day?: number | null
          toss_decision?: string | null
          toss_winner_id?: string | null
          tournament_id?: string | null
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team_a_id_fkey"
            columns: ["team_a_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team_b_id_fkey"
            columns: ["team_b_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_toss_winner_id_fkey"
            columns: ["toss_winner_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_admin: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          id?: string
          permission?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      roles: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          display_name: string
          id: string
          is_system: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_name: string
          id?: string
          is_system?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_name?: string
          id?: string
          is_system?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      saved_streaming_servers: {
        Row: {
          ad_block_enabled: boolean | null
          clearkey_key: string | null
          clearkey_key_id: string | null
          cookie_value: string | null
          created_at: string
          drm_license_url: string | null
          drm_scheme: string | null
          id: string
          notes: string | null
          origin_value: string | null
          player_type: string | null
          referer_value: string | null
          server_name: string
          server_type: string
          server_url: string
          tags: string[] | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          ad_block_enabled?: boolean | null
          clearkey_key?: string | null
          clearkey_key_id?: string | null
          cookie_value?: string | null
          created_at?: string
          drm_license_url?: string | null
          drm_scheme?: string | null
          id?: string
          notes?: string | null
          origin_value?: string | null
          player_type?: string | null
          referer_value?: string | null
          server_name: string
          server_type?: string
          server_url: string
          tags?: string[] | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          ad_block_enabled?: boolean | null
          clearkey_key?: string | null
          clearkey_key_id?: string | null
          cookie_value?: string | null
          created_at?: string
          drm_license_url?: string | null
          drm_scheme?: string | null
          id?: string
          notes?: string | null
          origin_value?: string | null
          player_type?: string | null
          referer_value?: string | null
          server_name?: string
          server_type?: string
          server_url?: string
          tags?: string[] | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          ad_block_rules: Json | null
          ad_click_protection: Json | null
          admin_slug: string | null
          ads_enabled: boolean | null
          ads_txt_content: string | null
          api_cricket_enabled: boolean | null
          api_cricket_key: string | null
          api_sync_interval_seconds: number | null
          auto_match_result_enabled: boolean | null
          canonical_url: string | null
          created_at: string
          cricket_api_enabled: boolean | null
          cricket_api_key: string | null
          custom_footer_code: string | null
          custom_header_code: string | null
          disclaimer_text: string | null
          facebook_app_id: string | null
          favicon_url: string | null
          footer_ad_code: string | null
          footer_text: string | null
          google_adsense_id: string | null
          google_analytics_id: string | null
          header_ad_code: string | null
          homepage_channels_limit: number | null
          homepage_completed_days: number | null
          id: string
          in_article_ad_code: string | null
          logo_url: string | null
          maintenance_contact_email: string | null
          maintenance_description: string | null
          maintenance_end_time: string | null
          maintenance_estimated_time: string | null
          maintenance_mode: boolean | null
          maintenance_show_countdown: boolean | null
          maintenance_social_message: string | null
          maintenance_subtitle: string | null
          maintenance_title: string | null
          match_page_ad_positions: Json | null
          multiple_ad_codes: Json | null
          og_image_url: string | null
          playing_xi_auto_sync_source: string
          points_table_auto_sync_enabled: boolean | null
          points_table_sync_time: string | null
          popup_ad_code: string | null
          rapidapi_enabled: boolean | null
          rapidapi_endpoints: Json | null
          rapidapi_key: string | null
          robots_txt: string | null
          schema_org_enabled: boolean | null
          show_disclaimer: boolean | null
          sidebar_ad_code: string | null
          site_description: string | null
          site_keywords: string | null
          site_name: string
          site_title: string
          slider_duration_seconds: number | null
          smtp_enabled: boolean | null
          smtp_from_email: string | null
          smtp_from_name: string | null
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_user: string | null
          social_links: Json | null
          telegram_link: string | null
          tournament_page_ad_positions: Json | null
          twitter_handle: string | null
          updated_at: string
        }
        Insert: {
          ad_block_rules?: Json | null
          ad_click_protection?: Json | null
          admin_slug?: string | null
          ads_enabled?: boolean | null
          ads_txt_content?: string | null
          api_cricket_enabled?: boolean | null
          api_cricket_key?: string | null
          api_sync_interval_seconds?: number | null
          auto_match_result_enabled?: boolean | null
          canonical_url?: string | null
          created_at?: string
          cricket_api_enabled?: boolean | null
          cricket_api_key?: string | null
          custom_footer_code?: string | null
          custom_header_code?: string | null
          disclaimer_text?: string | null
          facebook_app_id?: string | null
          favicon_url?: string | null
          footer_ad_code?: string | null
          footer_text?: string | null
          google_adsense_id?: string | null
          google_analytics_id?: string | null
          header_ad_code?: string | null
          homepage_channels_limit?: number | null
          homepage_completed_days?: number | null
          id?: string
          in_article_ad_code?: string | null
          logo_url?: string | null
          maintenance_contact_email?: string | null
          maintenance_description?: string | null
          maintenance_end_time?: string | null
          maintenance_estimated_time?: string | null
          maintenance_mode?: boolean | null
          maintenance_show_countdown?: boolean | null
          maintenance_social_message?: string | null
          maintenance_subtitle?: string | null
          maintenance_title?: string | null
          match_page_ad_positions?: Json | null
          multiple_ad_codes?: Json | null
          og_image_url?: string | null
          playing_xi_auto_sync_source?: string
          points_table_auto_sync_enabled?: boolean | null
          points_table_sync_time?: string | null
          popup_ad_code?: string | null
          rapidapi_enabled?: boolean | null
          rapidapi_endpoints?: Json | null
          rapidapi_key?: string | null
          robots_txt?: string | null
          schema_org_enabled?: boolean | null
          show_disclaimer?: boolean | null
          sidebar_ad_code?: string | null
          site_description?: string | null
          site_keywords?: string | null
          site_name?: string
          site_title?: string
          slider_duration_seconds?: number | null
          smtp_enabled?: boolean | null
          smtp_from_email?: string | null
          smtp_from_name?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          social_links?: Json | null
          telegram_link?: string | null
          tournament_page_ad_positions?: Json | null
          twitter_handle?: string | null
          updated_at?: string
        }
        Update: {
          ad_block_rules?: Json | null
          ad_click_protection?: Json | null
          admin_slug?: string | null
          ads_enabled?: boolean | null
          ads_txt_content?: string | null
          api_cricket_enabled?: boolean | null
          api_cricket_key?: string | null
          api_sync_interval_seconds?: number | null
          auto_match_result_enabled?: boolean | null
          canonical_url?: string | null
          created_at?: string
          cricket_api_enabled?: boolean | null
          cricket_api_key?: string | null
          custom_footer_code?: string | null
          custom_header_code?: string | null
          disclaimer_text?: string | null
          facebook_app_id?: string | null
          favicon_url?: string | null
          footer_ad_code?: string | null
          footer_text?: string | null
          google_adsense_id?: string | null
          google_analytics_id?: string | null
          header_ad_code?: string | null
          homepage_channels_limit?: number | null
          homepage_completed_days?: number | null
          id?: string
          in_article_ad_code?: string | null
          logo_url?: string | null
          maintenance_contact_email?: string | null
          maintenance_description?: string | null
          maintenance_end_time?: string | null
          maintenance_estimated_time?: string | null
          maintenance_mode?: boolean | null
          maintenance_show_countdown?: boolean | null
          maintenance_social_message?: string | null
          maintenance_subtitle?: string | null
          maintenance_title?: string | null
          match_page_ad_positions?: Json | null
          multiple_ad_codes?: Json | null
          og_image_url?: string | null
          playing_xi_auto_sync_source?: string
          points_table_auto_sync_enabled?: boolean | null
          points_table_sync_time?: string | null
          popup_ad_code?: string | null
          rapidapi_enabled?: boolean | null
          rapidapi_endpoints?: Json | null
          rapidapi_key?: string | null
          robots_txt?: string | null
          schema_org_enabled?: boolean | null
          show_disclaimer?: boolean | null
          sidebar_ad_code?: string | null
          site_description?: string | null
          site_keywords?: string | null
          site_name?: string
          site_title?: string
          slider_duration_seconds?: number | null
          smtp_enabled?: boolean | null
          smtp_from_email?: string | null
          smtp_from_name?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          social_links?: Json | null
          telegram_link?: string | null
          tournament_page_ad_positions?: Json | null
          twitter_handle?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      site_settings_public: {
        Row: {
          ad_block_rules: Json | null
          ad_click_protection: Json | null
          admin_slug: string | null
          ads_enabled: boolean | null
          ads_txt_content: string | null
          api_cricket_enabled: boolean | null
          api_sync_interval_seconds: number | null
          auto_match_result_enabled: boolean | null
          canonical_url: string | null
          created_at: string | null
          cricket_api_enabled: boolean | null
          custom_footer_code: string | null
          custom_header_code: string | null
          disclaimer_text: string | null
          facebook_app_id: string | null
          favicon_url: string | null
          footer_ad_code: string | null
          footer_text: string | null
          google_adsense_id: string | null
          google_analytics_id: string | null
          header_ad_code: string | null
          homepage_channels_limit: number | null
          homepage_completed_days: number | null
          id: string
          in_article_ad_code: string | null
          logo_url: string | null
          maintenance_contact_email: string | null
          maintenance_description: string | null
          maintenance_end_time: string | null
          maintenance_estimated_time: string | null
          maintenance_mode: boolean | null
          maintenance_show_countdown: boolean | null
          maintenance_social_message: string | null
          maintenance_subtitle: string | null
          maintenance_title: string | null
          match_page_ad_positions: Json | null
          multiple_ad_codes: Json | null
          og_image_url: string | null
          playing_xi_auto_sync_source: string | null
          points_table_auto_sync_enabled: boolean | null
          points_table_sync_time: string | null
          popup_ad_code: string | null
          rapidapi_enabled: boolean | null
          rapidapi_endpoints: Json | null
          robots_txt: string | null
          schema_org_enabled: boolean | null
          show_disclaimer: boolean | null
          sidebar_ad_code: string | null
          site_description: string | null
          site_keywords: string | null
          site_name: string | null
          site_title: string | null
          slider_duration_seconds: number | null
          social_links: Json | null
          telegram_link: string | null
          tournament_page_ad_positions: Json | null
          twitter_handle: string | null
          updated_at: string | null
        }
        Insert: {
          ad_block_rules?: Json | null
          ad_click_protection?: Json | null
          admin_slug?: string | null
          ads_enabled?: boolean | null
          ads_txt_content?: string | null
          api_cricket_enabled?: boolean | null
          api_sync_interval_seconds?: number | null
          auto_match_result_enabled?: boolean | null
          canonical_url?: string | null
          created_at?: string | null
          cricket_api_enabled?: boolean | null
          custom_footer_code?: string | null
          custom_header_code?: string | null
          disclaimer_text?: string | null
          facebook_app_id?: string | null
          favicon_url?: string | null
          footer_ad_code?: string | null
          footer_text?: string | null
          google_adsense_id?: string | null
          google_analytics_id?: string | null
          header_ad_code?: string | null
          homepage_channels_limit?: number | null
          homepage_completed_days?: number | null
          id: string
          in_article_ad_code?: string | null
          logo_url?: string | null
          maintenance_contact_email?: string | null
          maintenance_description?: string | null
          maintenance_end_time?: string | null
          maintenance_estimated_time?: string | null
          maintenance_mode?: boolean | null
          maintenance_show_countdown?: boolean | null
          maintenance_social_message?: string | null
          maintenance_subtitle?: string | null
          maintenance_title?: string | null
          match_page_ad_positions?: Json | null
          multiple_ad_codes?: Json | null
          og_image_url?: string | null
          playing_xi_auto_sync_source?: string | null
          points_table_auto_sync_enabled?: boolean | null
          points_table_sync_time?: string | null
          popup_ad_code?: string | null
          rapidapi_enabled?: boolean | null
          rapidapi_endpoints?: Json | null
          robots_txt?: string | null
          schema_org_enabled?: boolean | null
          show_disclaimer?: boolean | null
          sidebar_ad_code?: string | null
          site_description?: string | null
          site_keywords?: string | null
          site_name?: string | null
          site_title?: string | null
          slider_duration_seconds?: number | null
          social_links?: Json | null
          telegram_link?: string | null
          tournament_page_ad_positions?: Json | null
          twitter_handle?: string | null
          updated_at?: string | null
        }
        Update: {
          ad_block_rules?: Json | null
          ad_click_protection?: Json | null
          admin_slug?: string | null
          ads_enabled?: boolean | null
          ads_txt_content?: string | null
          api_cricket_enabled?: boolean | null
          api_sync_interval_seconds?: number | null
          auto_match_result_enabled?: boolean | null
          canonical_url?: string | null
          created_at?: string | null
          cricket_api_enabled?: boolean | null
          custom_footer_code?: string | null
          custom_header_code?: string | null
          disclaimer_text?: string | null
          facebook_app_id?: string | null
          favicon_url?: string | null
          footer_ad_code?: string | null
          footer_text?: string | null
          google_adsense_id?: string | null
          google_analytics_id?: string | null
          header_ad_code?: string | null
          homepage_channels_limit?: number | null
          homepage_completed_days?: number | null
          id?: string
          in_article_ad_code?: string | null
          logo_url?: string | null
          maintenance_contact_email?: string | null
          maintenance_description?: string | null
          maintenance_end_time?: string | null
          maintenance_estimated_time?: string | null
          maintenance_mode?: boolean | null
          maintenance_show_countdown?: boolean | null
          maintenance_social_message?: string | null
          maintenance_subtitle?: string | null
          maintenance_title?: string | null
          match_page_ad_positions?: Json | null
          multiple_ad_codes?: Json | null
          og_image_url?: string | null
          playing_xi_auto_sync_source?: string | null
          points_table_auto_sync_enabled?: boolean | null
          points_table_sync_time?: string | null
          popup_ad_code?: string | null
          rapidapi_enabled?: boolean | null
          rapidapi_endpoints?: Json | null
          robots_txt?: string | null
          schema_org_enabled?: boolean | null
          show_disclaimer?: boolean | null
          sidebar_ad_code?: string | null
          site_description?: string | null
          site_keywords?: string | null
          site_name?: string | null
          site_title?: string | null
          slider_duration_seconds?: number | null
          social_links?: Json | null
          telegram_link?: string | null
          tournament_page_ad_positions?: Json | null
          twitter_handle?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sitemap_ping_history: {
        Row: {
          created_at: string
          id: string
          ping_type: string
          results: Json | null
          sitemap_url: string
          success_count: number | null
          total_count: number | null
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ping_type?: string
          results?: Json | null
          sitemap_url: string
          success_count?: number | null
          total_count?: number | null
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ping_type?: string
          results?: Json | null
          sitemap_url?: string
          success_count?: number | null
          total_count?: number | null
          triggered_by?: string | null
        }
        Relationships: []
      }
      sponsor_notices: {
        Row: {
          background_color: string | null
          content: string
          created_at: string
          display_order: number | null
          display_type: string
          id: string
          is_active: boolean | null
          is_global: boolean | null
          match_id: string | null
          position: string
          text_color: string | null
          title: string
          updated_at: string
        }
        Insert: {
          background_color?: string | null
          content: string
          created_at?: string
          display_order?: number | null
          display_type?: string
          id?: string
          is_active?: boolean | null
          is_global?: boolean | null
          match_id?: string | null
          position?: string
          text_color?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          background_color?: string | null
          content?: string
          created_at?: string
          display_order?: number | null
          display_type?: string
          id?: string
          is_active?: boolean | null
          is_global?: boolean | null
          match_id?: string | null
          position?: string
          text_color?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_notices_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      sports: {
        Row: {
          created_at: string
          display_order: number | null
          icon_url: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          icon_url?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          icon_url?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      streaming_json_sources: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          last_sync_status: string | null
          last_synced_at: string | null
          name: string
          updated_at: string
          url: string
          url_field: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          last_sync_status?: string | null
          last_synced_at?: string | null
          name: string
          updated_at?: string
          url: string
          url_field?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          last_sync_status?: string | null
          last_synced_at?: string | null
          name?: string
          updated_at?: string
          url?: string
          url_field?: string
        }
        Relationships: []
      }
      streaming_servers: {
        Row: {
          ad_block_enabled: boolean | null
          auto_source_id: string | null
          clearkey_key: string | null
          clearkey_key_id: string | null
          cookie_value: string | null
          created_at: string
          display_order: number | null
          drm_license_url: string | null
          drm_scheme: string | null
          id: string
          is_active: boolean | null
          is_working: boolean | null
          last_reported_at: string | null
          match_id: string
          not_working_reports: number | null
          origin_value: string | null
          original_display_order: number | null
          player_type: string | null
          referer_value: string | null
          server_name: string
          server_type: string
          server_url: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          ad_block_enabled?: boolean | null
          auto_source_id?: string | null
          clearkey_key?: string | null
          clearkey_key_id?: string | null
          cookie_value?: string | null
          created_at?: string
          display_order?: number | null
          drm_license_url?: string | null
          drm_scheme?: string | null
          id?: string
          is_active?: boolean | null
          is_working?: boolean | null
          last_reported_at?: string | null
          match_id: string
          not_working_reports?: number | null
          origin_value?: string | null
          original_display_order?: number | null
          player_type?: string | null
          referer_value?: string | null
          server_name: string
          server_type?: string
          server_url: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          ad_block_enabled?: boolean | null
          auto_source_id?: string | null
          clearkey_key?: string | null
          clearkey_key_id?: string | null
          cookie_value?: string | null
          created_at?: string
          display_order?: number | null
          drm_license_url?: string | null
          drm_scheme?: string | null
          id?: string
          is_active?: boolean | null
          is_working?: boolean | null
          last_reported_at?: string | null
          match_id?: string
          not_working_reports?: number | null
          origin_value?: string | null
          original_display_order?: number | null
          player_type?: string | null
          referer_value?: string | null
          server_name?: string
          server_type?: string
          server_url?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "streaming_servers_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          logo_background_color: string | null
          logo_url: string | null
          name: string
          short_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_background_color?: string | null
          logo_url?: string | null
          name: string
          short_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_background_color?: string | null
          logo_url?: string | null
          name?: string
          short_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      tournament_points_table: {
        Row: {
          created_at: string
          group_name: string | null
          head_to_head: Json | null
          id: string
          lost: number | null
          net_run_rate: number | null
          no_result: number | null
          overs_bowled: number | null
          overs_faced: number | null
          played: number | null
          points: number | null
          position: number | null
          runs_conceded: number | null
          runs_scored: number | null
          team_id: string
          tied: number | null
          tournament_id: string
          updated_at: string
          won: number | null
        }
        Insert: {
          created_at?: string
          group_name?: string | null
          head_to_head?: Json | null
          id?: string
          lost?: number | null
          net_run_rate?: number | null
          no_result?: number | null
          overs_bowled?: number | null
          overs_faced?: number | null
          played?: number | null
          points?: number | null
          position?: number | null
          runs_conceded?: number | null
          runs_scored?: number | null
          team_id: string
          tied?: number | null
          tournament_id: string
          updated_at?: string
          won?: number | null
        }
        Update: {
          created_at?: string
          group_name?: string | null
          head_to_head?: Json | null
          id?: string
          lost?: number | null
          net_run_rate?: number | null
          no_result?: number | null
          overs_bowled?: number | null
          overs_faced?: number | null
          played?: number | null
          points?: number | null
          position?: number | null
          runs_conceded?: number | null
          runs_scored?: number | null
          team_id?: string
          tied?: number | null
          tournament_id?: string
          updated_at?: string
          won?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_points_table_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_points_table_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_venues: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          display_order: number | null
          id: string
          tournament_id: string
          updated_at: string
          venue_name: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          tournament_id: string
          updated_at?: string
          venue_name: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          tournament_id?: string
          updated_at?: string
          venue_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_venues_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          created_at: string
          custom_participating_teams: Json | null
          description: string | null
          end_date: string | null
          id: string
          is_active: boolean | null
          is_completed: boolean | null
          logo_background_color: string | null
          logo_url: string | null
          name: string
          participating_teams_position: string | null
          points_table_daily_sync_enabled: boolean | null
          points_table_on_complete_sync_enabled: boolean | null
          points_table_sync_time: string | null
          season: string
          seo_description: string | null
          seo_keywords: string | null
          seo_title: string | null
          series_id: string | null
          show_in_homepage: boolean | null
          show_in_menu: boolean | null
          show_participating_teams: boolean | null
          show_points_table: boolean | null
          slug: string | null
          sport: string
          start_date: string | null
          total_matches: number | null
          total_teams: number | null
          total_venues: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_participating_teams?: Json | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          is_completed?: boolean | null
          logo_background_color?: string | null
          logo_url?: string | null
          name: string
          participating_teams_position?: string | null
          points_table_daily_sync_enabled?: boolean | null
          points_table_on_complete_sync_enabled?: boolean | null
          points_table_sync_time?: string | null
          season: string
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          series_id?: string | null
          show_in_homepage?: boolean | null
          show_in_menu?: boolean | null
          show_participating_teams?: boolean | null
          show_points_table?: boolean | null
          slug?: string | null
          sport?: string
          start_date?: string | null
          total_matches?: number | null
          total_teams?: number | null
          total_venues?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_participating_teams?: Json | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          is_completed?: boolean | null
          logo_background_color?: string | null
          logo_url?: string | null
          name?: string
          participating_teams_position?: string | null
          points_table_daily_sync_enabled?: boolean | null
          points_table_on_complete_sync_enabled?: boolean | null
          points_table_sync_time?: string | null
          season?: string
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          series_id?: string | null
          show_in_homepage?: boolean | null
          show_in_menu?: boolean | null
          show_participating_teams?: boolean | null
          show_points_table?: boolean | null
          slug?: string | null
          sport?: string
          start_date?: string | null
          total_matches?: number | null
          total_teams?: number | null
          total_venues?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      user_custom_roles: {
        Row: {
          created_at: string | null
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_custom_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string
          granted: boolean
          id: string
          permission: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted?: boolean
          id?: string
          permission: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted?: boolean
          id?: string
          permission?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      streaming_servers_public: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string | null
          is_active: boolean | null
          match_id: string | null
          player_type: string | null
          server_name: string | null
          server_type: string | null
          server_url: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string | null
          is_active?: boolean | null
          match_id?: string | null
          player_type?: string | null
          server_name?: string | null
          server_type?: string | null
          server_url?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string | null
          is_active?: boolean | null
          match_id?: string | null
          player_type?: string | null
          server_name?: string | null
          server_type?: string | null
          server_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "streaming_servers_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      call_sync_api_scores: { Args: never; Returns: undefined }
      call_sync_streaming_from_json: { Args: never; Returns: undefined }
      call_update_match_status: { Args: never; Returns: undefined }
      has_custom_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      recalculate_tournament_positions: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
