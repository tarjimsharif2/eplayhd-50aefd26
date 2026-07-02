-- =====================================================================
-- CONSOLIDATED MIGRATION
-- Generated from live database schema (public schema only).
-- Combines all prior migrations into a single idempotent-friendly dump.
-- Includes: enums, tables, sequences, functions, triggers, RLS policies,
-- GRANTs. Auth / storage / realtime schemas are managed by Supabase.
-- =====================================================================

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- schema public already exists


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'moderator',
    'user'
);


--
-- Name: auto_calculate_football_score(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_calculate_football_score() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_sport_name TEXT;
  v_goals_a JSONB;
  v_goals_b JSONB;
  v_score_a INTEGER := 0;
  v_score_b INTEGER := 0;
  v_goal JSONB;
BEGIN
  -- Only process if goals changed
  IF (NEW.goals_team_a IS NOT DISTINCT FROM OLD.goals_team_a) 
     AND (NEW.goals_team_b IS NOT DISTINCT FROM OLD.goals_team_b) THEN
    RETURN NEW;
  END IF;

  -- Check if this is a football match
  IF NEW.sport_id IS NOT NULL THEN
    SELECT name INTO v_sport_name FROM sports WHERE id = NEW.sport_id;
    IF v_sport_name IS NULL OR v_sport_name NOT ILIKE '%football%' THEN
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  v_goals_a := COALESCE(NEW.goals_team_a, '[]'::jsonb);
  v_goals_b := COALESCE(NEW.goals_team_b, '[]'::jsonb);

  -- Count goals for team A: regular goals + own goals by team B
  FOR v_goal IN SELECT * FROM jsonb_array_elements(v_goals_a)
  LOOP
    IF (v_goal->>'type') != 'own_goal' THEN
      v_score_a := v_score_a + 1;
    ELSE
      v_score_b := v_score_b + 1;
    END IF;
  END LOOP;

  -- Count goals for team B: regular goals + own goals by team A
  FOR v_goal IN SELECT * FROM jsonb_array_elements(v_goals_b)
  LOOP
    IF (v_goal->>'type') != 'own_goal' THEN
      v_score_b := v_score_b + 1;
    ELSE
      v_score_a := v_score_a + 1;
    END IF;
  END LOOP;

  -- Update scores
  NEW.score_a := v_score_a::text;
  NEW.score_b := v_score_b::text;

  RETURN NEW;
END;
$$;


--
-- Name: auto_complete_expired_tournaments(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_complete_expired_tournaments() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.tournaments
  SET is_completed = true,
      updated_at = now()
  WHERE end_date IS NOT NULL
    AND end_date < CURRENT_DATE
    AND (is_completed IS NULL OR is_completed = false);
END;
$$;


--
-- Name: call_sync_api_scores(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.call_sync_api_scores() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://doqteforumjdugifxryl.supabase.co/functions/v1/sync-api-scores',
    body := '{}'::jsonb
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'sync-api-scores error: %', SQLERRM;
END;
$$;


--
-- Name: call_sync_streaming_from_json(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.call_sync_streaming_from_json() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://doqteforumjdugifxryl.supabase.co/functions/v1/sync-streaming-from-json',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'sync-streaming-from-json error: %', SQLERRM;
END;
$$;


--
-- Name: call_update_match_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.call_update_match_status() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://doqteforumjdugifxryl.supabase.co/functions/v1/update-match-status',
    body := '{}'::jsonb
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'update-match-status error: %', SQLERRM;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;


--
-- Name: has_custom_permission(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_custom_permission(_user_id uuid, _permission text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    -- Check user-specific permission override (granted = true)
    SELECT 1 FROM public.user_permissions
    WHERE user_id = _user_id AND permission = _permission AND granted = true
  )
  OR (
    -- Check if NOT denied by user-specific override
    NOT EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = _user_id AND permission = _permission AND granted = false
    )
    AND (
      -- Check original role-based permission (admin, moderator, user)
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.role_permissions rp ON ur.role = rp.role
        WHERE ur.user_id = _user_id AND rp.permission = _permission
      )
      OR
      -- Check custom role-based permission
      EXISTS (
        SELECT 1 FROM public.user_custom_roles ucr
        JOIN public.custom_role_permissions crp ON ucr.role_id = crp.role_id
        WHERE ucr.user_id = _user_id AND crp.permission = _permission
      )
    )
  )
$$;


--
-- Name: has_permission(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_permission(_user_id uuid, _permission text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    -- Check user-specific permission override (granted = true)
    SELECT 1 FROM public.user_permissions
    WHERE user_id = _user_id AND permission = _permission AND granted = true
  )
  OR (
    -- Check role-based permission (if no user-specific denial)
    NOT EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = _user_id AND permission = _permission AND granted = false
    )
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.role_permissions rp ON ur.role = rp.role
      WHERE ur.user_id = _user_id AND rp.permission = _permission
    )
  )
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: reassign_slug_on_match_complete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reassign_slug_on_match_complete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_base_slug TEXT;
  v_next_match_id UUID;
  v_next_match_slug TEXT;
  v_slug_number INTEGER;
BEGIN
  -- Only process if status changed to 'completed' and match has a slug
  IF NEW.status = 'completed' 
     AND (OLD.status IS NULL OR OLD.status != 'completed') 
     AND NEW.slug IS NOT NULL 
  THEN
    -- Check if this is a clean slug (ends with -live, not -live-N)
    IF NEW.slug ~ '^.+-live$' AND NEW.slug !~ '^.+-live-\d+$' THEN
      v_base_slug := NEW.slug;
      
      -- Find the next upcoming/live match with numbered slug (e.g., team-a-vs-team-b-live-2)
      SELECT id, slug INTO v_next_match_id, v_next_match_slug
      FROM matches
      WHERE slug ~ ('^' || regexp_replace(v_base_slug, '-', '\\-', 'g') || '-\d+$')
        AND status IN ('upcoming', 'live')
        AND id != NEW.id
      ORDER BY 
        CASE WHEN status = 'live' THEN 0 ELSE 1 END,
        match_start_time ASC NULLS LAST,
        match_date ASC,
        match_time ASC
      LIMIT 1;
      
      IF v_next_match_id IS NOT NULL THEN
        -- Extract the number from the next match's slug
        v_slug_number := (regexp_match(v_next_match_slug, '-(\d+)$'))[1]::INTEGER;
        
        -- Give the clean slug to the next match
        UPDATE matches SET slug = v_base_slug WHERE id = v_next_match_id;
        
        -- Give the completed match a numbered slug
        UPDATE matches SET slug = v_base_slug || '-' || v_slug_number WHERE id = NEW.id;
        
        -- Update NEW to reflect the change (for the trigger return)
        NEW.slug := v_base_slug || '-' || v_slug_number;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$_$;


--
-- Name: recalculate_tournament_positions(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recalculate_tournament_positions(p_tournament_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Only update NRR if we have the overs data to calculate it
  UPDATE tournament_points_table SET
    net_run_rate = CASE 
      WHEN COALESCE(overs_faced, 0) > 0 AND COALESCE(overs_bowled, 0) > 0 THEN
        ROUND(((COALESCE(runs_scored, 0)::numeric / overs_faced) - (COALESCE(runs_conceded, 0)::numeric / overs_bowled))::numeric, 3)
      ELSE 
        net_run_rate
    END
  WHERE tournament_id = p_tournament_id;
  
  -- Recalculate positions WITHIN each group separately
  WITH ranked_teams AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(group_name, '__no_group__')
        ORDER BY 
          COALESCE(points, 0) DESC,
          COALESCE(net_run_rate, 0) DESC,
          COALESCE(won, 0) DESC
      ) as new_position
    FROM tournament_points_table
    WHERE tournament_id = p_tournament_id
  )
  UPDATE tournament_points_table t
  SET position = r.new_position
  FROM ranked_teams r
  WHERE t.id = r.id;
END;
$$;


--
-- Name: sync_site_settings_public(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_site_settings_public() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.site_settings_public (
    id, site_name, site_title, site_description, site_keywords,
    logo_url, favicon_url, og_image_url, footer_text, google_analytics_id,
    created_at, updated_at, header_ad_code, sidebar_ad_code, footer_ad_code,
    in_article_ad_code, popup_ad_code, ads_enabled, google_adsense_id,
    canonical_url, robots_txt, schema_org_enabled, twitter_handle, facebook_app_id,
    telegram_link, social_links, cricket_api_enabled, ads_txt_content,
    custom_header_code, custom_footer_code, match_page_ad_positions,
    api_cricket_enabled, api_sync_interval_seconds, slider_duration_seconds,
    admin_slug, rapidapi_endpoints, maintenance_mode, maintenance_title,
    maintenance_subtitle, maintenance_description, maintenance_estimated_time,
    maintenance_show_countdown, maintenance_end_time, maintenance_contact_email,
    maintenance_social_message, disclaimer_text, show_disclaimer,
    homepage_completed_days, homepage_channels_limit, multiple_ad_codes,
    tournament_page_ad_positions, points_table_sync_time, points_table_auto_sync_enabled,
    ad_block_rules, rapidapi_enabled, auto_match_result_enabled, ad_click_protection,
    player_load_time_seconds, default_iframe_url, default_iframe_enabled
  ) VALUES (
    NEW.id, NEW.site_name, NEW.site_title, NEW.site_description, NEW.site_keywords,
    NEW.logo_url, NEW.favicon_url, NEW.og_image_url, NEW.footer_text, NEW.google_analytics_id,
    NEW.created_at, NEW.updated_at, NEW.header_ad_code, NEW.sidebar_ad_code, NEW.footer_ad_code,
    NEW.in_article_ad_code, NEW.popup_ad_code, NEW.ads_enabled, NEW.google_adsense_id,
    NEW.canonical_url, NEW.robots_txt, NEW.schema_org_enabled, NEW.twitter_handle, NEW.facebook_app_id,
    NEW.telegram_link, NEW.social_links, NEW.cricket_api_enabled, NEW.ads_txt_content,
    NEW.custom_header_code, NEW.custom_footer_code, NEW.match_page_ad_positions,
    NEW.api_cricket_enabled, NEW.api_sync_interval_seconds, NEW.slider_duration_seconds,
    NEW.admin_slug, NEW.rapidapi_endpoints, NEW.maintenance_mode, NEW.maintenance_title,
    NEW.maintenance_subtitle, NEW.maintenance_description, NEW.maintenance_estimated_time,
    NEW.maintenance_show_countdown, NEW.maintenance_end_time, NEW.maintenance_contact_email,
    NEW.maintenance_social_message, NEW.disclaimer_text, NEW.show_disclaimer,
    NEW.homepage_completed_days, NEW.homepage_channels_limit, NEW.multiple_ad_codes,
    NEW.tournament_page_ad_positions, NEW.points_table_sync_time, NEW.points_table_auto_sync_enabled,
    NEW.ad_block_rules, NEW.rapidapi_enabled, NEW.auto_match_result_enabled, NEW.ad_click_protection,
    NEW.player_load_time_seconds, NEW.default_iframe_url, NEW.default_iframe_enabled
  )
  ON CONFLICT (id) DO UPDATE SET
    site_name = EXCLUDED.site_name, site_title = EXCLUDED.site_title,
    site_description = EXCLUDED.site_description, site_keywords = EXCLUDED.site_keywords,
    logo_url = EXCLUDED.logo_url, favicon_url = EXCLUDED.favicon_url,
    og_image_url = EXCLUDED.og_image_url, footer_text = EXCLUDED.footer_text,
    google_analytics_id = EXCLUDED.google_analytics_id, created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at, header_ad_code = EXCLUDED.header_ad_code,
    sidebar_ad_code = EXCLUDED.sidebar_ad_code, footer_ad_code = EXCLUDED.footer_ad_code,
    in_article_ad_code = EXCLUDED.in_article_ad_code, popup_ad_code = EXCLUDED.popup_ad_code,
    ads_enabled = EXCLUDED.ads_enabled, google_adsense_id = EXCLUDED.google_adsense_id,
    canonical_url = EXCLUDED.canonical_url, robots_txt = EXCLUDED.robots_txt,
    schema_org_enabled = EXCLUDED.schema_org_enabled, twitter_handle = EXCLUDED.twitter_handle,
    facebook_app_id = EXCLUDED.facebook_app_id, telegram_link = EXCLUDED.telegram_link,
    social_links = EXCLUDED.social_links, cricket_api_enabled = EXCLUDED.cricket_api_enabled,
    ads_txt_content = EXCLUDED.ads_txt_content, custom_header_code = EXCLUDED.custom_header_code,
    custom_footer_code = EXCLUDED.custom_footer_code, match_page_ad_positions = EXCLUDED.match_page_ad_positions,
    api_cricket_enabled = EXCLUDED.api_cricket_enabled, api_sync_interval_seconds = EXCLUDED.api_sync_interval_seconds,
    slider_duration_seconds = EXCLUDED.slider_duration_seconds, admin_slug = EXCLUDED.admin_slug,
    rapidapi_endpoints = EXCLUDED.rapidapi_endpoints, maintenance_mode = EXCLUDED.maintenance_mode,
    maintenance_title = EXCLUDED.maintenance_title, maintenance_subtitle = EXCLUDED.maintenance_subtitle,
    maintenance_description = EXCLUDED.maintenance_description, maintenance_estimated_time = EXCLUDED.maintenance_estimated_time,
    maintenance_show_countdown = EXCLUDED.maintenance_show_countdown, maintenance_end_time = EXCLUDED.maintenance_end_time,
    maintenance_contact_email = EXCLUDED.maintenance_contact_email, maintenance_social_message = EXCLUDED.maintenance_social_message,
    disclaimer_text = EXCLUDED.disclaimer_text, show_disclaimer = EXCLUDED.show_disclaimer,
    homepage_completed_days = EXCLUDED.homepage_completed_days,
    homepage_channels_limit = EXCLUDED.homepage_channels_limit,
    multiple_ad_codes = EXCLUDED.multiple_ad_codes,
    tournament_page_ad_positions = EXCLUDED.tournament_page_ad_positions,
    points_table_sync_time = EXCLUDED.points_table_sync_time,
    points_table_auto_sync_enabled = EXCLUDED.points_table_auto_sync_enabled,
    ad_block_rules = EXCLUDED.ad_block_rules,
    rapidapi_enabled = EXCLUDED.rapidapi_enabled,
    auto_match_result_enabled = EXCLUDED.auto_match_result_enabled,
    ad_click_protection = EXCLUDED.ad_click_protection,
    player_load_time_seconds = EXCLUDED.player_load_time_seconds,
    default_iframe_url = EXCLUDED.default_iframe_url,
    default_iframe_enabled = EXCLUDED.default_iframe_enabled;
  RETURN NEW;
END;
$$;


--
-- Name: sync_site_settings_public_from_site_settings(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_site_settings_public_from_site_settings() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.site_settings_public (
    id, site_name, site_title, site_description, site_keywords,
    logo_url, favicon_url, og_image_url, footer_text, google_analytics_id,
    created_at, updated_at, header_ad_code, sidebar_ad_code, footer_ad_code,
    in_article_ad_code, popup_ad_code, ads_enabled, google_adsense_id,
    canonical_url, robots_txt, schema_org_enabled, twitter_handle, facebook_app_id,
    telegram_link, social_links, cricket_api_enabled, ads_txt_content,
    custom_header_code, custom_footer_code, match_page_ad_positions,
    api_cricket_enabled, api_sync_interval_seconds, slider_duration_seconds,
    admin_slug, rapidapi_endpoints, maintenance_mode, maintenance_title,
    maintenance_subtitle, maintenance_description, maintenance_estimated_time,
    maintenance_show_countdown, maintenance_end_time, maintenance_contact_email,
    maintenance_social_message, disclaimer_text, show_disclaimer,
    homepage_completed_days, homepage_channels_limit, multiple_ad_codes,
    tournament_page_ad_positions, points_table_sync_time, points_table_auto_sync_enabled,
    ad_block_rules, rapidapi_enabled, auto_match_result_enabled, ad_click_protection,
    playing_xi_auto_sync_source
  ) VALUES (
    NEW.id, NEW.site_name, NEW.site_title, NEW.site_description, NEW.site_keywords,
    NEW.logo_url, NEW.favicon_url, NEW.og_image_url, NEW.footer_text, NEW.google_analytics_id,
    NEW.created_at, NEW.updated_at, NEW.header_ad_code, NEW.sidebar_ad_code, NEW.footer_ad_code,
    NEW.in_article_ad_code, NEW.popup_ad_code, NEW.ads_enabled, NEW.google_adsense_id,
    NEW.canonical_url, NEW.robots_txt, NEW.schema_org_enabled, NEW.twitter_handle, NEW.facebook_app_id,
    NEW.telegram_link, NEW.social_links, NEW.cricket_api_enabled, NEW.ads_txt_content,
    NEW.custom_header_code, NEW.custom_footer_code, NEW.match_page_ad_positions,
    NEW.api_cricket_enabled, NEW.api_sync_interval_seconds, NEW.slider_duration_seconds,
    NEW.admin_slug, NEW.rapidapi_endpoints, NEW.maintenance_mode, NEW.maintenance_title,
    NEW.maintenance_subtitle, NEW.maintenance_description, NEW.maintenance_estimated_time,
    NEW.maintenance_show_countdown, NEW.maintenance_end_time, NEW.maintenance_contact_email,
    NEW.maintenance_social_message, NEW.disclaimer_text, NEW.show_disclaimer,
    NEW.homepage_completed_days, NEW.homepage_channels_limit, NEW.multiple_ad_codes,
    NEW.tournament_page_ad_positions, NEW.points_table_sync_time, NEW.points_table_auto_sync_enabled,
    NEW.ad_block_rules, NEW.rapidapi_enabled, NEW.auto_match_result_enabled, NEW.ad_click_protection,
    NEW.playing_xi_auto_sync_source
  )
  ON CONFLICT (id) DO UPDATE SET
    site_name = EXCLUDED.site_name, site_title = EXCLUDED.site_title,
    site_description = EXCLUDED.site_description, site_keywords = EXCLUDED.site_keywords,
    logo_url = EXCLUDED.logo_url, favicon_url = EXCLUDED.favicon_url,
    og_image_url = EXCLUDED.og_image_url, footer_text = EXCLUDED.footer_text,
    google_analytics_id = EXCLUDED.google_analytics_id, created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at, header_ad_code = EXCLUDED.header_ad_code,
    sidebar_ad_code = EXCLUDED.sidebar_ad_code, footer_ad_code = EXCLUDED.footer_ad_code,
    in_article_ad_code = EXCLUDED.in_article_ad_code, popup_ad_code = EXCLUDED.popup_ad_code,
    ads_enabled = EXCLUDED.ads_enabled, google_adsense_id = EXCLUDED.google_adsense_id,
    canonical_url = EXCLUDED.canonical_url, robots_txt = EXCLUDED.robots_txt,
    schema_org_enabled = EXCLUDED.schema_org_enabled, twitter_handle = EXCLUDED.twitter_handle,
    facebook_app_id = EXCLUDED.facebook_app_id, telegram_link = EXCLUDED.telegram_link,
    social_links = EXCLUDED.social_links, cricket_api_enabled = EXCLUDED.cricket_api_enabled,
    ads_txt_content = EXCLUDED.ads_txt_content, custom_header_code = EXCLUDED.custom_header_code,
    custom_footer_code = EXCLUDED.custom_footer_code, match_page_ad_positions = EXCLUDED.match_page_ad_positions,
    api_cricket_enabled = EXCLUDED.api_cricket_enabled, api_sync_interval_seconds = EXCLUDED.api_sync_interval_seconds,
    slider_duration_seconds = EXCLUDED.slider_duration_seconds, admin_slug = EXCLUDED.admin_slug,
    rapidapi_endpoints = EXCLUDED.rapidapi_endpoints, maintenance_mode = EXCLUDED.maintenance_mode,
    maintenance_title = EXCLUDED.maintenance_title, maintenance_subtitle = EXCLUDED.maintenance_subtitle,
    maintenance_description = EXCLUDED.maintenance_description, maintenance_estimated_time = EXCLUDED.maintenance_estimated_time,
    maintenance_show_countdown = EXCLUDED.maintenance_show_countdown, maintenance_end_time = EXCLUDED.maintenance_end_time,
    maintenance_contact_email = EXCLUDED.maintenance_contact_email, maintenance_social_message = EXCLUDED.maintenance_social_message,
    disclaimer_text = EXCLUDED.disclaimer_text, show_disclaimer = EXCLUDED.show_disclaimer,
    homepage_completed_days = EXCLUDED.homepage_completed_days,
    homepage_channels_limit = EXCLUDED.homepage_channels_limit,
    multiple_ad_codes = EXCLUDED.multiple_ad_codes,
    tournament_page_ad_positions = EXCLUDED.tournament_page_ad_positions,
    points_table_sync_time = EXCLUDED.points_table_sync_time,
    points_table_auto_sync_enabled = EXCLUDED.points_table_auto_sync_enabled,
    ad_block_rules = EXCLUDED.ad_block_rules,
    rapidapi_enabled = EXCLUDED.rapidapi_enabled,
    auto_match_result_enabled = EXCLUDED.auto_match_result_enabled,
    ad_click_protection = EXCLUDED.ad_click_protection,
    playing_xi_auto_sync_source = EXCLUDED.playing_xi_auto_sync_source;

  RETURN NEW;
END;
$$;


--
-- Name: update_points_on_match_complete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_points_on_match_complete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_tournament_id UUID;
  v_team_a_id UUID;
  v_team_b_id UUID;
  v_match_result TEXT;
  v_winner_id UUID;
  v_loser_id UUID;
  v_is_tied BOOLEAN := false;
  v_is_no_result BOOLEAN := false;
  v_is_draw BOOLEAN := false;
  v_team_a_runs INTEGER := 0;
  v_team_a_overs NUMERIC := 0;
  v_team_b_runs INTEGER := 0;
  v_team_b_overs NUMERIC := 0;
  v_innings_record RECORD;
  v_on_complete_sync BOOLEAN := false;
  v_has_valid_result BOOLEAN := false;
  v_group_name TEXT := NULL;
  v_existing_a_id UUID;
  v_existing_b_id UUID;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    v_tournament_id := NEW.tournament_id;
    v_team_a_id := NEW.team_a_id;
    v_team_b_id := NEW.team_b_id;
    v_match_result := NEW.match_result;
    
    IF v_tournament_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    SELECT points_table_on_complete_sync_enabled INTO v_on_complete_sync
    FROM tournaments WHERE id = v_tournament_id;
    
    -- Find the common group_name where BOTH teams exist in the points table
    -- This handles multiple stages (Group Stage, Super Eight, etc.)
    SELECT a.group_name INTO v_group_name
    FROM tournament_points_table a
    JOIN tournament_points_table b ON a.tournament_id = b.tournament_id AND a.group_name IS NOT DISTINCT FROM b.group_name
    WHERE a.tournament_id = v_tournament_id
      AND a.team_id = v_team_a_id
      AND b.team_id = v_team_b_id
    ORDER BY a.created_at DESC
    LIMIT 1;
    
    RAISE LOG 'update_points_on_match_complete: tournament=%, team_a=%, team_b=%, group=%', 
      v_tournament_id, v_team_a_id, v_team_b_id, COALESCE(v_group_name, 'NULL');
    
    CASE v_match_result
      WHEN 'team_a_won' THEN
        v_winner_id := v_team_a_id;
        v_loser_id := v_team_b_id;
        v_has_valid_result := true;
      WHEN 'team_b_won' THEN
        v_winner_id := v_team_b_id;
        v_loser_id := v_team_a_id;
        v_has_valid_result := true;
      WHEN 'tied' THEN
        v_is_tied := true;
        v_has_valid_result := true;
      WHEN 'no_result' THEN
        v_is_no_result := true;
        v_has_valid_result := true;
      WHEN 'draw' THEN
        v_is_draw := true;
        v_has_valid_result := true;
      ELSE
        v_has_valid_result := false;
    END CASE;
    
    IF v_has_valid_result THEN
      FOR v_innings_record IN 
        SELECT batting_team_id, COALESCE(runs, 0) as runs, COALESCE(overs, 0) as overs
        FROM match_innings 
        WHERE match_id = NEW.id
      LOOP
        IF v_innings_record.batting_team_id = v_team_a_id THEN
          v_team_a_runs := v_team_a_runs + v_innings_record.runs;
          v_team_a_overs := v_team_a_overs + v_innings_record.overs;
        ELSIF v_innings_record.batting_team_id = v_team_b_id THEN
          v_team_b_runs := v_team_b_runs + v_innings_record.runs;
          v_team_b_overs := v_team_b_overs + v_innings_record.overs;
        END IF;
      END LOOP;
      
      -- Team A: Check if entry exists for this group
      SELECT id INTO v_existing_a_id
      FROM tournament_points_table
      WHERE tournament_id = v_tournament_id AND team_id = v_team_a_id
        AND group_name IS NOT DISTINCT FROM v_group_name;
      
      IF v_existing_a_id IS NOT NULL THEN
        UPDATE tournament_points_table SET
          played = played + 1,
          won = won + CASE WHEN v_winner_id = v_team_a_id THEN 1 ELSE 0 END,
          lost = lost + CASE WHEN v_loser_id = v_team_a_id THEN 1 ELSE 0 END,
          tied = tied + CASE WHEN v_is_tied OR v_is_draw THEN 1 ELSE 0 END,
          no_result = no_result + CASE WHEN v_is_no_result THEN 1 ELSE 0 END,
          points = points + CASE WHEN v_winner_id = v_team_a_id THEN 2 WHEN v_is_tied OR v_is_draw OR v_is_no_result THEN 1 ELSE 0 END,
          runs_scored = COALESCE(runs_scored, 0) + v_team_a_runs,
          overs_faced = COALESCE(overs_faced, 0) + v_team_a_overs,
          runs_conceded = COALESCE(runs_conceded, 0) + v_team_b_runs,
          overs_bowled = COALESCE(overs_bowled, 0) + v_team_b_overs,
          head_to_head = CASE 
            WHEN v_winner_id = v_team_a_id THEN 
              jsonb_set(COALESCE(head_to_head, '{}'::jsonb), ARRAY[v_team_b_id::text],
                jsonb_build_object('won', COALESCE((head_to_head->v_team_b_id::text->>'won')::int, 0) + 1, 'lost', COALESCE((head_to_head->v_team_b_id::text->>'lost')::int, 0)))
            WHEN v_loser_id = v_team_a_id THEN 
              jsonb_set(COALESCE(head_to_head, '{}'::jsonb), ARRAY[v_team_b_id::text],
                jsonb_build_object('won', COALESCE((head_to_head->v_team_b_id::text->>'won')::int, 0), 'lost', COALESCE((head_to_head->v_team_b_id::text->>'lost')::int, 0) + 1))
            ELSE head_to_head
          END,
          updated_at = now()
        WHERE id = v_existing_a_id;
      ELSE
        INSERT INTO tournament_points_table (
          tournament_id, team_id, group_name, played, won, lost, tied, no_result, points, position,
          runs_scored, overs_faced, runs_conceded, overs_bowled, head_to_head
        ) VALUES (
          v_tournament_id, v_team_a_id, v_group_name, 1,
          CASE WHEN v_winner_id = v_team_a_id THEN 1 ELSE 0 END,
          CASE WHEN v_loser_id = v_team_a_id THEN 1 ELSE 0 END,
          CASE WHEN v_is_tied OR v_is_draw THEN 1 ELSE 0 END,
          CASE WHEN v_is_no_result THEN 1 ELSE 0 END,
          CASE WHEN v_winner_id = v_team_a_id THEN 2 WHEN v_is_tied OR v_is_draw OR v_is_no_result THEN 1 ELSE 0 END,
          0, v_team_a_runs, v_team_a_overs, v_team_b_runs, v_team_b_overs,
          CASE 
            WHEN v_winner_id = v_team_a_id THEN jsonb_build_object(v_team_b_id::text, jsonb_build_object('won', 1, 'lost', 0))
            WHEN v_loser_id = v_team_a_id THEN jsonb_build_object(v_team_b_id::text, jsonb_build_object('won', 0, 'lost', 1))
            ELSE '{}'::jsonb
          END
        );
      END IF;
      
      -- Team B: Check if entry exists for this group
      SELECT id INTO v_existing_b_id
      FROM tournament_points_table
      WHERE tournament_id = v_tournament_id AND team_id = v_team_b_id
        AND group_name IS NOT DISTINCT FROM v_group_name;
      
      IF v_existing_b_id IS NOT NULL THEN
        UPDATE tournament_points_table SET
          played = played + 1,
          won = won + CASE WHEN v_winner_id = v_team_b_id THEN 1 ELSE 0 END,
          lost = lost + CASE WHEN v_loser_id = v_team_b_id THEN 1 ELSE 0 END,
          tied = tied + CASE WHEN v_is_tied OR v_is_draw THEN 1 ELSE 0 END,
          no_result = no_result + CASE WHEN v_is_no_result THEN 1 ELSE 0 END,
          points = points + CASE WHEN v_winner_id = v_team_b_id THEN 2 WHEN v_is_tied OR v_is_draw OR v_is_no_result THEN 1 ELSE 0 END,
          runs_scored = COALESCE(runs_scored, 0) + v_team_b_runs,
          overs_faced = COALESCE(overs_faced, 0) + v_team_b_overs,
          runs_conceded = COALESCE(runs_conceded, 0) + v_team_a_runs,
          overs_bowled = COALESCE(overs_bowled, 0) + v_team_a_overs,
          head_to_head = CASE 
            WHEN v_winner_id = v_team_b_id THEN 
              jsonb_set(COALESCE(head_to_head, '{}'::jsonb), ARRAY[v_team_a_id::text],
                jsonb_build_object('won', COALESCE((head_to_head->v_team_a_id::text->>'won')::int, 0) + 1, 'lost', COALESCE((head_to_head->v_team_a_id::text->>'lost')::int, 0)))
            WHEN v_loser_id = v_team_b_id THEN 
              jsonb_set(COALESCE(head_to_head, '{}'::jsonb), ARRAY[v_team_a_id::text],
                jsonb_build_object('won', COALESCE((head_to_head->v_team_a_id::text->>'won')::int, 0), 'lost', COALESCE((head_to_head->v_team_a_id::text->>'lost')::int, 0) + 1))
            ELSE head_to_head
          END,
          updated_at = now()
        WHERE id = v_existing_b_id;
      ELSE
        INSERT INTO tournament_points_table (
          tournament_id, team_id, group_name, played, won, lost, tied, no_result, points, position,
          runs_scored, overs_faced, runs_conceded, overs_bowled, head_to_head
        ) VALUES (
          v_tournament_id, v_team_b_id, v_group_name, 1,
          CASE WHEN v_winner_id = v_team_b_id THEN 1 ELSE 0 END,
          CASE WHEN v_loser_id = v_team_b_id THEN 1 ELSE 0 END,
          CASE WHEN v_is_tied OR v_is_draw THEN 1 ELSE 0 END,
          CASE WHEN v_is_no_result THEN 1 ELSE 0 END,
          CASE WHEN v_winner_id = v_team_b_id THEN 2 WHEN v_is_tied OR v_is_draw OR v_is_no_result THEN 1 ELSE 0 END,
          0, v_team_b_runs, v_team_b_overs, v_team_a_runs, v_team_a_overs,
          CASE 
            WHEN v_winner_id = v_team_b_id THEN jsonb_build_object(v_team_a_id::text, jsonb_build_object('won', 1, 'lost', 0))
            WHEN v_loser_id = v_team_b_id THEN jsonb_build_object(v_team_a_id::text, jsonb_build_object('won', 0, 'lost', 1))
            ELSE '{}'::jsonb
          END
        );
      END IF;
      
      -- Update NRR for both teams in this group
      UPDATE tournament_points_table SET
        net_run_rate = CASE 
          WHEN COALESCE(overs_faced, 0) > 0 AND COALESCE(overs_bowled, 0) > 0 THEN
            ROUND(((COALESCE(runs_scored, 0)::numeric / NULLIF(overs_faced, 0)) - (COALESCE(runs_conceded, 0)::numeric / NULLIF(overs_bowled, 0)))::numeric, 3)
          ELSE 0
        END
      WHERE tournament_id = v_tournament_id 
        AND team_id IN (v_team_a_id, v_team_b_id)
        AND group_name IS NOT DISTINCT FROM v_group_name;
      
      PERFORM public.recalculate_tournament_positions(v_tournament_id);
    END IF;
    
    IF v_on_complete_sync THEN
      BEGIN
        PERFORM net.http_post(
          url := 'https://doqteforumjdugifxryl.supabase.co/functions/v1/sync-points-table',
          headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcXRlZm9ydW1qZHVnaWZ4cnlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1NDY5NjQsImV4cCI6MjA4MjEyMjk2NH0.TzRAPhPWC6WN_IR24qEWA8TznqlrqPirJBdDmWyT9n8"}'::jsonb,
          body := jsonb_build_object('tournamentId', v_tournament_id),
          timeout_milliseconds := 30000
        );
        RAISE LOG 'Points table on-complete sync triggered for tournament % (match_result: %)', v_tournament_id, COALESCE(v_match_result, 'NULL');
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'Failed to trigger on-complete sync for tournament %: %', v_tournament_id, SQLERRM;
      END;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ad_click_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ad_click_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    device_fingerprint text NOT NULL,
    click_count integer DEFAULT 1 NOT NULL,
    first_click_at timestamp with time zone DEFAULT now() NOT NULL,
    last_click_at timestamp with time zone DEFAULT now() NOT NULL,
    blocked_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_otp_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_otp_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    otp_code text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    is_used boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: banners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.banners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    image_url text NOT NULL,
    link_url text,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    banner_type text DEFAULT 'custom'::text,
    match_id uuid,
    tournament_id uuid,
    subtitle text,
    badge_type text DEFAULT 'none'::text,
    CONSTRAINT banners_badge_type_check CHECK ((badge_type = ANY (ARRAY['none'::text, 'live'::text, 'upcoming'::text, 'watch_now'::text]))),
    CONSTRAINT banners_banner_type_check CHECK ((banner_type = ANY (ARRAY['match'::text, 'tournament'::text, 'custom'::text])))
);


--
-- Name: bottom_nav_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bottom_nav_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    label text NOT NULL,
    url text NOT NULL,
    icon_name text DEFAULT 'Home'::text NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: channel_streaming_servers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_streaming_servers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    channel_id uuid NOT NULL,
    server_name text NOT NULL,
    server_url text NOT NULL,
    server_type text DEFAULT 'iframe'::text NOT NULL,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    referer_value text,
    origin_value text,
    cookie_value text,
    user_agent text,
    drm_license_url text,
    drm_scheme text,
    player_type text DEFAULT 'hls'::text,
    clearkey_key_id text,
    clearkey_key text,
    ad_block_enabled boolean DEFAULT false,
    is_working boolean DEFAULT true,
    original_display_order integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: channels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text,
    logo_url text,
    logo_background_color text DEFAULT '#1a1a2e'::text,
    description text,
    seo_title text,
    seo_description text,
    seo_keywords text,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cricket_series; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cricket_series (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    series_id text NOT NULL,
    series_name text NOT NULL,
    start_date date,
    end_date date,
    match_count integer DEFAULT 0,
    is_active boolean DEFAULT true,
    last_synced_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: custom_menus; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custom_menus (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    url text,
    icon_name text,
    parent_id uuid,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    open_in_new_tab boolean DEFAULT false,
    menu_type text DEFAULT 'link'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: custom_role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custom_role_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_id uuid NOT NULL,
    permission text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: dynamic_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dynamic_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    content text,
    content_type text DEFAULT 'html'::text NOT NULL,
    is_active boolean DEFAULT true,
    show_in_header boolean DEFAULT false,
    show_in_footer boolean DEFAULT true,
    display_order integer DEFAULT 0,
    seo_title text,
    seo_description text,
    seo_keywords text,
    og_image_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: event_streaming_servers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_streaming_servers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    server_name text NOT NULL,
    server_url text NOT NULL,
    server_type text DEFAULT 'iframe'::text NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    referer_value text,
    origin_value text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    logo_url text,
    location text,
    year integer,
    description text,
    event_start_time timestamp with time zone NOT NULL,
    event_end_time timestamp with time zone,
    status text DEFAULT 'upcoming'::text NOT NULL,
    tournament_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    is_priority boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: football_leagues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.football_leagues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    league_code text NOT NULL,
    league_name text NOT NULL,
    is_active boolean DEFAULT true,
    last_synced_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: match_api_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.match_api_scores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    match_id uuid NOT NULL,
    home_team text,
    away_team text,
    home_score text,
    away_score text,
    home_overs text,
    away_overs text,
    status text,
    status_info text,
    event_live boolean DEFAULT false,
    venue text,
    toss text,
    batsmen jsonb DEFAULT '[]'::jsonb,
    bowlers jsonb DEFAULT '[]'::jsonb,
    extras jsonb DEFAULT '[]'::jsonb,
    scorecard jsonb DEFAULT '[]'::jsonb,
    api_event_key text,
    last_synced_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: match_innings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.match_innings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    match_id uuid NOT NULL,
    innings_number integer NOT NULL,
    batting_team_id uuid NOT NULL,
    runs integer DEFAULT 0,
    wickets integer DEFAULT 0,
    overs numeric(4,1) DEFAULT 0,
    declared boolean DEFAULT false,
    is_current boolean DEFAULT false,
    extras integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT match_innings_innings_number_check CHECK (((innings_number >= 1) AND (innings_number <= 4))),
    CONSTRAINT match_innings_wickets_check CHECK (((wickets >= 0) AND (wickets <= 10)))
);


--
-- Name: match_playing_xi; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.match_playing_xi (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    match_id uuid NOT NULL,
    team_id uuid NOT NULL,
    player_name text NOT NULL,
    player_role text,
    is_captain boolean DEFAULT false,
    is_vice_captain boolean DEFAULT false,
    is_wicket_keeper boolean DEFAULT false,
    batting_order integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_bench boolean DEFAULT false,
    change_status text,
    player_image text,
    sofascore_player_id text,
    jersey_number integer,
    formation text,
    formation_place integer
);


--
-- Name: match_substitutions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.match_substitutions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    match_id uuid NOT NULL,
    team_id uuid NOT NULL,
    player_out text NOT NULL,
    player_in text NOT NULL,
    minute text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: matches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tournament_id uuid,
    team_a_id uuid NOT NULL,
    team_b_id uuid NOT NULL,
    match_number text,
    match_date text NOT NULL,
    match_time text NOT NULL,
    status text DEFAULT 'upcoming'::text NOT NULL,
    venue text,
    score_a text,
    score_b text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    match_link text,
    match_duration_minutes integer DEFAULT 180,
    match_start_time timestamp with time zone,
    is_priority boolean DEFAULT false,
    match_label text,
    sport_id uuid,
    slug text,
    page_type text DEFAULT 'redirect'::text,
    seo_title text,
    seo_description text,
    seo_keywords text,
    match_minute integer,
    match_format text,
    test_day integer,
    is_stumps boolean DEFAULT false,
    stumps_time timestamp with time zone,
    day_start_time time without time zone,
    next_day_start timestamp with time zone,
    match_result text,
    api_score_enabled boolean DEFAULT false,
    cricbuzz_match_id text,
    match_end_time timestamp with time zone,
    auto_sync_enabled boolean DEFAULT false,
    last_api_sync timestamp with time zone,
    is_active boolean DEFAULT true,
    result_margin text,
    manual_status_override boolean DEFAULT false,
    goals_team_a jsonb DEFAULT '[]'::jsonb,
    goals_team_b jsonb DEFAULT '[]'::jsonb,
    score_source text DEFAULT 'manual'::text,
    espn_event_id text,
    show_playing_xi boolean DEFAULT false,
    toss_winner_id uuid,
    toss_decision text,
    cricapi_match_id text,
    auto_match_result_enabled boolean DEFAULT true,
    sofascore_event_id text,
    crex_match_fkey text,
    auto_streaming_enabled boolean DEFAULT true NOT NULL,
    manual_scoreboard_enabled boolean DEFAULT false NOT NULL,
    head_coach_a text,
    head_coach_b text,
    lineup_announced boolean DEFAULT false NOT NULL,
    CONSTRAINT matches_status_check CHECK ((status = ANY (ARRAY['upcoming'::text, 'live'::text, 'completed'::text, 'cancelled'::text, 'abandoned'::text, 'postponed'::text, 'delayed'::text, 'interrupted'::text]))),
    CONSTRAINT matches_toss_decision_check CHECK ((toss_decision = ANY (ARRAY['bat'::text, 'bowl'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email text,
    full_name text,
    is_admin boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role public.app_role NOT NULL,
    permission text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    display_name text NOT NULL,
    description text,
    is_system boolean DEFAULT false,
    color text DEFAULT '#6b7280'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: saved_streaming_servers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saved_streaming_servers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    server_name text NOT NULL,
    server_url text NOT NULL,
    server_type text DEFAULT 'iframe'::text NOT NULL,
    referer_value text,
    origin_value text,
    cookie_value text,
    user_agent text,
    drm_license_url text,
    drm_scheme text,
    player_type text DEFAULT 'hls'::text,
    ad_block_enabled boolean DEFAULT false,
    clearkey_key_id text,
    clearkey_key text,
    tags text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    CONSTRAINT saved_streaming_servers_player_type_check CHECK (((player_type IS NULL) OR (player_type = ANY (ARRAY['hls'::text, 'clappr'::text, 'hlsjs_proxy'::text]))))
);


--
-- Name: site_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_name text DEFAULT 'Live Sports'::text NOT NULL,
    site_title text DEFAULT 'Live Sports - Watch Live Matches'::text NOT NULL,
    site_description text DEFAULT 'Watch live sports matches online. Get live scores, schedules and streaming links for Cricket, Football, Tennis and more.'::text,
    site_keywords text DEFAULT 'live sports, live streaming, cricket, football, tennis, live scores'::text,
    logo_url text,
    favicon_url text,
    og_image_url text,
    footer_text text DEFAULT 'All rights reserved.'::text,
    google_analytics_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    header_ad_code text,
    sidebar_ad_code text,
    footer_ad_code text,
    in_article_ad_code text,
    popup_ad_code text,
    ads_enabled boolean DEFAULT false,
    google_adsense_id text,
    canonical_url text,
    robots_txt text DEFAULT 'User-agent: *\nAllow: /'::text,
    schema_org_enabled boolean DEFAULT true,
    twitter_handle text,
    facebook_app_id text,
    telegram_link text,
    social_links jsonb DEFAULT '{}'::jsonb,
    cricket_api_key text,
    cricket_api_enabled boolean DEFAULT false,
    smtp_enabled boolean DEFAULT false,
    smtp_host text,
    smtp_port integer DEFAULT 587,
    smtp_user text,
    smtp_password text,
    smtp_from_email text,
    smtp_from_name text,
    ads_txt_content text,
    custom_header_code text,
    custom_footer_code text,
    match_page_ad_positions jsonb DEFAULT '{"sidebar": true, "below_info": true, "after_player": true, "before_player": true}'::jsonb,
    ad_block_rules jsonb DEFAULT '{"blockPopups": true, "blockNewTabs": true, "cssSelectors": [".ad", ".ads", ".advert", ".advertisement", ".ad-container", ".ad-wrapper", ".banner-ad", ".top-ad", ".bottom-ad", ".sidebar-ad", ".popup", ".popunder", ".overlay-ad", ".interstitial", ".sticky-ad", ".fixed-ad", ".floating-ad", ".modal-backdrop", ".modal-overlay"]}'::jsonb,
    api_cricket_key text,
    api_cricket_enabled boolean DEFAULT false,
    api_sync_interval_seconds integer DEFAULT 120,
    rapidapi_key text,
    rapidapi_enabled boolean DEFAULT false,
    slider_duration_seconds integer DEFAULT 6,
    admin_slug text DEFAULT 'admin'::text,
    rapidapi_endpoints jsonb DEFAULT '{"cricbuzz_host": "cricbuzz-cricket.p.rapidapi.com", "squad_endpoint": "/mcenter/v1/{match_id}/hsquad", "scorecard_endpoint": "/mcenter/v1/{match_id}/scard", "cricketapi_live_host": "cricketapi-live.p.rapidapi.com", "match_squad_endpoint": "/squad/{match_id}", "live_matches_endpoint": "/matches/live", "points_table_endpoint": "/series/v1/{series_id}/points-table"}'::jsonb,
    maintenance_mode boolean DEFAULT false,
    maintenance_title text DEFAULT 'We''ll Be Right Back'::text,
    maintenance_subtitle text DEFAULT 'Our site is currently undergoing scheduled maintenance.'::text,
    maintenance_description text DEFAULT 'We''re working hard to improve your experience. Thank you for your patience.'::text,
    maintenance_estimated_time text,
    maintenance_show_countdown boolean DEFAULT false,
    maintenance_end_time timestamp with time zone,
    maintenance_contact_email text,
    maintenance_social_message text DEFAULT 'Follow us for updates'::text,
    disclaimer_text text DEFAULT 'All content displayed here is from publicly available sources on the internet. We do not own or claim ownership of any cricket matches, streams, or highlights. This platform is for informational purposes only.'::text,
    show_disclaimer boolean DEFAULT true,
    homepage_completed_days integer DEFAULT 2,
    homepage_channels_limit integer DEFAULT 8,
    multiple_ad_codes jsonb DEFAULT '{}'::jsonb,
    tournament_page_ad_positions jsonb DEFAULT '{"sidebar": true, "after_matches": true, "before_matches": true, "after_points_table": true, "before_points_table": true}'::jsonb,
    points_table_sync_time text DEFAULT '03:00'::text,
    points_table_auto_sync_enabled boolean DEFAULT false,
    auto_match_result_enabled boolean DEFAULT true,
    ad_click_protection jsonb DEFAULT '{"enabled": false, "max_clicks": 10, "time_window_days": 1, "block_duration_hours": 24}'::jsonb,
    playing_xi_auto_sync_source text DEFAULT 'api_cricket'::text NOT NULL,
    player_load_time_seconds integer DEFAULT 0 NOT NULL,
    default_iframe_url text,
    default_iframe_enabled boolean DEFAULT false NOT NULL,
    CONSTRAINT site_settings_playing_xi_auto_sync_source_check CHECK ((playing_xi_auto_sync_source = ANY (ARRAY['api_cricket'::text, 'espn'::text, 'sofascore'::text, 'crex'::text])))
);


--
-- Name: site_settings_public; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_settings_public (
    id uuid NOT NULL,
    site_name text,
    site_title text,
    site_description text,
    site_keywords text,
    logo_url text,
    favicon_url text,
    og_image_url text,
    footer_text text,
    google_analytics_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    header_ad_code text,
    sidebar_ad_code text,
    footer_ad_code text,
    in_article_ad_code text,
    popup_ad_code text,
    ads_enabled boolean,
    google_adsense_id text,
    canonical_url text,
    robots_txt text,
    schema_org_enabled boolean,
    twitter_handle text,
    facebook_app_id text,
    telegram_link text,
    social_links jsonb,
    cricket_api_enabled boolean,
    ads_txt_content text,
    custom_header_code text,
    custom_footer_code text,
    match_page_ad_positions jsonb DEFAULT '{"sidebar": true, "below_info": true, "after_player": true, "before_player": true}'::jsonb,
    ad_block_rules jsonb DEFAULT '{"blockPopups": true, "blockNewTabs": true, "cssSelectors": [".ad", ".ads", ".advert", ".advertisement", ".ad-container", ".ad-wrapper", ".banner-ad", ".top-ad", ".bottom-ad", ".sidebar-ad", ".popup", ".popunder", ".overlay-ad", ".interstitial", ".sticky-ad", ".fixed-ad", ".floating-ad", ".modal-backdrop", ".modal-overlay"]}'::jsonb,
    api_cricket_enabled boolean DEFAULT false,
    api_sync_interval_seconds integer DEFAULT 120,
    rapidapi_enabled boolean DEFAULT false,
    slider_duration_seconds integer DEFAULT 6,
    admin_slug text DEFAULT 'admin'::text,
    rapidapi_endpoints jsonb DEFAULT '{"cricbuzz_host": "cricbuzz-cricket.p.rapidapi.com", "squad_endpoint": "/mcenter/v1/{match_id}/hsquad", "scorecard_endpoint": "/mcenter/v1/{match_id}/scard", "cricketapi_live_host": "cricketapi-live.p.rapidapi.com", "match_squad_endpoint": "/squad/{match_id}", "live_matches_endpoint": "/matches/live", "points_table_endpoint": "/series/v1/{series_id}/points-table"}'::jsonb,
    maintenance_mode boolean DEFAULT false,
    maintenance_title text DEFAULT 'We''ll Be Right Back'::text,
    maintenance_subtitle text DEFAULT 'Our site is currently undergoing scheduled maintenance.'::text,
    maintenance_description text DEFAULT 'We''re working hard to improve your experience. Thank you for your patience.'::text,
    maintenance_estimated_time text,
    maintenance_show_countdown boolean DEFAULT false,
    maintenance_end_time timestamp with time zone,
    maintenance_contact_email text,
    maintenance_social_message text DEFAULT 'Follow us for updates'::text,
    disclaimer_text text DEFAULT 'All content displayed here is from publicly available sources on the internet. We do not own or claim ownership of any cricket matches, streams, or highlights. This platform is for informational purposes only.'::text,
    show_disclaimer boolean DEFAULT true,
    homepage_completed_days integer DEFAULT 2,
    homepage_channels_limit integer DEFAULT 8,
    tournament_page_ad_positions jsonb DEFAULT '{"sidebar": true, "after_matches": true, "before_matches": true, "after_points_table": true, "before_points_table": true}'::jsonb,
    multiple_ad_codes jsonb DEFAULT '{}'::jsonb,
    points_table_sync_time text DEFAULT '03:00'::text,
    points_table_auto_sync_enabled boolean DEFAULT false,
    auto_match_result_enabled boolean DEFAULT true,
    ad_click_protection jsonb DEFAULT '{"enabled": false, "max_clicks": 10, "time_window_days": 1, "block_duration_hours": 24}'::jsonb,
    playing_xi_auto_sync_source text DEFAULT 'api_cricket'::text,
    player_load_time_seconds integer DEFAULT 0 NOT NULL,
    default_iframe_url text,
    default_iframe_enabled boolean DEFAULT false NOT NULL,
    CONSTRAINT site_settings_public_playing_xi_auto_sync_source_check CHECK ((playing_xi_auto_sync_source = ANY (ARRAY['api_cricket'::text, 'espn'::text, 'sofascore'::text, 'crex'::text])))
);


--
-- Name: sitemap_ping_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sitemap_ping_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ping_type text DEFAULT 'manual'::text NOT NULL,
    triggered_by text,
    sitemap_url text NOT NULL,
    results jsonb DEFAULT '[]'::jsonb,
    success_count integer DEFAULT 0,
    total_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sponsor_notices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sponsor_notices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    "position" text DEFAULT 'before_stream'::text NOT NULL,
    display_type text DEFAULT 'static'::text NOT NULL,
    text_color text DEFAULT '#ffffff'::text,
    background_color text DEFAULT '#1a1a2e'::text,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    match_id uuid,
    is_global boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sponsor_notices_display_type_check CHECK ((display_type = ANY (ARRAY['static'::text, 'marquee'::text]))),
    CONSTRAINT sponsor_notices_position_check CHECK (("position" = ANY (ARRAY['before_stream'::text, 'before_servers'::text, 'before_scoreboard'::text])))
);


--
-- Name: sports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    icon_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    display_order integer DEFAULT 0
);


--
-- Name: streaming_json_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.streaming_json_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    url text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_synced_at timestamp with time zone,
    last_sync_status text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    url_field text DEFAULT 'playerUrl'::text NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    use_entry_name boolean DEFAULT false NOT NULL,
    backup_of_source_id uuid,
    sync_interval_minutes integer DEFAULT 2 NOT NULL,
    last_sync_attempted_at timestamp with time zone
);


--
-- Name: streaming_servers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.streaming_servers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    match_id uuid NOT NULL,
    server_name text NOT NULL,
    server_url text NOT NULL,
    server_type text DEFAULT 'iframe'::text NOT NULL,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    referer_value text,
    origin_value text,
    cookie_value text,
    user_agent text,
    drm_license_url text,
    drm_scheme text,
    player_type text DEFAULT 'hls'::text,
    ad_block_enabled boolean DEFAULT false,
    clearkey_key_id text,
    clearkey_key text,
    is_working boolean DEFAULT true,
    original_display_order integer,
    not_working_reports integer DEFAULT 0,
    last_reported_at timestamp with time zone,
    auto_source_id text,
    backup_locked boolean DEFAULT false NOT NULL,
    name_locked boolean DEFAULT false NOT NULL,
    CONSTRAINT streaming_servers_player_type_check CHECK (((player_type IS NULL) OR (player_type = ANY (ARRAY['hls'::text, 'clappr'::text, 'hlsjs_proxy'::text])))),
    CONSTRAINT valid_url_protocol CHECK (((server_url ~~ 'https://%'::text) OR (server_url ~~ 'http://%'::text)))
);


--
-- Name: streaming_servers_public; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.streaming_servers_public AS
 SELECT id,
    match_id,
    server_name,
    server_url,
    server_type,
    display_order,
    is_active,
    player_type,
    created_at,
    updated_at
   FROM public.streaming_servers
  WHERE (is_active = true);


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    short_name text NOT NULL,
    logo_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    logo_background_color text DEFAULT '#1a1a2e'::text,
    aliases text[] DEFAULT '{}'::text[] NOT NULL
);


--
-- Name: tournament_points_table; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_points_table (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tournament_id uuid NOT NULL,
    team_id uuid NOT NULL,
    "position" integer DEFAULT 0,
    played integer DEFAULT 0,
    won integer DEFAULT 0,
    lost integer DEFAULT 0,
    tied integer DEFAULT 0,
    no_result integer DEFAULT 0,
    net_run_rate numeric(6,3) DEFAULT 0.000,
    points integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    runs_scored integer DEFAULT 0,
    overs_faced numeric DEFAULT 0,
    runs_conceded integer DEFAULT 0,
    overs_bowled numeric DEFAULT 0,
    head_to_head jsonb DEFAULT '{}'::jsonb,
    group_name text
);


--
-- Name: tournament_venues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_venues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tournament_id uuid NOT NULL,
    venue_name text NOT NULL,
    city text,
    country text,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tournaments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournaments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    sport text DEFAULT 'Cricket'::text NOT NULL,
    season text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    logo_url text,
    slug text,
    is_active boolean DEFAULT true,
    seo_title text,
    seo_description text,
    seo_keywords text,
    show_in_menu boolean DEFAULT true,
    series_id text,
    show_in_homepage boolean DEFAULT true,
    total_matches integer,
    start_date date,
    end_date date,
    description text,
    is_completed boolean DEFAULT false,
    total_teams integer,
    total_venues integer,
    show_participating_teams boolean DEFAULT true,
    participating_teams_position text DEFAULT 'before_matches'::text,
    custom_participating_teams jsonb,
    logo_background_color text DEFAULT '#1a1a2e'::text,
    show_points_table boolean DEFAULT true,
    points_table_sync_time text,
    points_table_daily_sync_enabled boolean DEFAULT false,
    points_table_on_complete_sync_enabled boolean DEFAULT false
);


--
-- Name: user_custom_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_custom_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    permission text NOT NULL,
    granted boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ad_click_logs ad_click_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_click_logs
    ADD CONSTRAINT ad_click_logs_pkey PRIMARY KEY (id);


--
-- Name: admin_otp_codes admin_otp_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_otp_codes
    ADD CONSTRAINT admin_otp_codes_pkey PRIMARY KEY (id);


--
-- Name: banners banners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banners
    ADD CONSTRAINT banners_pkey PRIMARY KEY (id);


--
-- Name: bottom_nav_items bottom_nav_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bottom_nav_items
    ADD CONSTRAINT bottom_nav_items_pkey PRIMARY KEY (id);


--
-- Name: channel_streaming_servers channel_streaming_servers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_streaming_servers
    ADD CONSTRAINT channel_streaming_servers_pkey PRIMARY KEY (id);


--
-- Name: channels channels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_pkey PRIMARY KEY (id);


--
-- Name: channels channels_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_slug_key UNIQUE (slug);


--
-- Name: cricket_series cricket_series_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cricket_series
    ADD CONSTRAINT cricket_series_pkey PRIMARY KEY (id);


--
-- Name: cricket_series cricket_series_series_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cricket_series
    ADD CONSTRAINT cricket_series_series_id_key UNIQUE (series_id);


--
-- Name: custom_menus custom_menus_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_menus
    ADD CONSTRAINT custom_menus_pkey PRIMARY KEY (id);


--
-- Name: custom_role_permissions custom_role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_role_permissions
    ADD CONSTRAINT custom_role_permissions_pkey PRIMARY KEY (id);


--
-- Name: custom_role_permissions custom_role_permissions_role_id_permission_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_role_permissions
    ADD CONSTRAINT custom_role_permissions_role_id_permission_key UNIQUE (role_id, permission);


--
-- Name: dynamic_pages dynamic_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_pages
    ADD CONSTRAINT dynamic_pages_pkey PRIMARY KEY (id);


--
-- Name: dynamic_pages dynamic_pages_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_pages
    ADD CONSTRAINT dynamic_pages_slug_key UNIQUE (slug);


--
-- Name: event_streaming_servers event_streaming_servers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_streaming_servers
    ADD CONSTRAINT event_streaming_servers_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: events events_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_slug_key UNIQUE (slug);


--
-- Name: football_leagues football_leagues_league_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.football_leagues
    ADD CONSTRAINT football_leagues_league_code_key UNIQUE (league_code);


--
-- Name: football_leagues football_leagues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.football_leagues
    ADD CONSTRAINT football_leagues_pkey PRIMARY KEY (id);


--
-- Name: match_api_scores match_api_scores_match_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_api_scores
    ADD CONSTRAINT match_api_scores_match_id_key UNIQUE (match_id);


--
-- Name: match_api_scores match_api_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_api_scores
    ADD CONSTRAINT match_api_scores_pkey PRIMARY KEY (id);


--
-- Name: match_innings match_innings_match_id_innings_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_innings
    ADD CONSTRAINT match_innings_match_id_innings_number_key UNIQUE (match_id, innings_number);


--
-- Name: match_innings match_innings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_innings
    ADD CONSTRAINT match_innings_pkey PRIMARY KEY (id);


--
-- Name: match_playing_xi match_playing_xi_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_playing_xi
    ADD CONSTRAINT match_playing_xi_pkey PRIMARY KEY (id);


--
-- Name: match_substitutions match_substitutions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_substitutions
    ADD CONSTRAINT match_substitutions_pkey PRIMARY KEY (id);


--
-- Name: matches matches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_pkey PRIMARY KEY (id);


--
-- Name: matches matches_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_slug_key UNIQUE (slug);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_role_permission_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_permission_key UNIQUE (role, permission);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: saved_streaming_servers saved_streaming_servers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_streaming_servers
    ADD CONSTRAINT saved_streaming_servers_pkey PRIMARY KEY (id);


--
-- Name: site_settings site_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_pkey PRIMARY KEY (id);


--
-- Name: site_settings_public site_settings_public_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_settings_public
    ADD CONSTRAINT site_settings_public_pkey PRIMARY KEY (id);


--
-- Name: sitemap_ping_history sitemap_ping_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sitemap_ping_history
    ADD CONSTRAINT sitemap_ping_history_pkey PRIMARY KEY (id);


--
-- Name: sponsor_notices sponsor_notices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sponsor_notices
    ADD CONSTRAINT sponsor_notices_pkey PRIMARY KEY (id);


--
-- Name: sports sports_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sports
    ADD CONSTRAINT sports_name_key UNIQUE (name);


--
-- Name: sports sports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sports
    ADD CONSTRAINT sports_pkey PRIMARY KEY (id);


--
-- Name: streaming_json_sources streaming_json_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streaming_json_sources
    ADD CONSTRAINT streaming_json_sources_pkey PRIMARY KEY (id);


--
-- Name: streaming_servers streaming_servers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streaming_servers
    ADD CONSTRAINT streaming_servers_pkey PRIMARY KEY (id);


--
-- Name: teams teams_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_name_unique UNIQUE (name);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: tournament_points_table tournament_points_table_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_points_table
    ADD CONSTRAINT tournament_points_table_pkey PRIMARY KEY (id);


--
-- Name: tournament_venues tournament_venues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_venues
    ADD CONSTRAINT tournament_venues_pkey PRIMARY KEY (id);


--
-- Name: tournaments tournaments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_pkey PRIMARY KEY (id);


--
-- Name: tournaments tournaments_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_slug_key UNIQUE (slug);


--
-- Name: user_custom_roles user_custom_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_custom_roles
    ADD CONSTRAINT user_custom_roles_pkey PRIMARY KEY (id);


--
-- Name: user_custom_roles user_custom_roles_user_id_role_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_custom_roles
    ADD CONSTRAINT user_custom_roles_user_id_role_id_key UNIQUE (user_id, role_id);


--
-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (id);


--
-- Name: user_permissions user_permissions_user_id_permission_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_permission_key UNIQUE (user_id, permission);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: idx_ad_click_logs_blocked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_click_logs_blocked ON public.ad_click_logs USING btree (blocked_until) WHERE (blocked_until IS NOT NULL);


--
-- Name: idx_ad_click_logs_fingerprint; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_click_logs_fingerprint ON public.ad_click_logs USING btree (device_fingerprint);


--
-- Name: idx_admin_otp_codes_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_otp_codes_expires_at ON public.admin_otp_codes USING btree (expires_at);


--
-- Name: idx_admin_otp_codes_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_otp_codes_user_id ON public.admin_otp_codes USING btree (user_id);


--
-- Name: idx_banners_match_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_banners_match_id ON public.banners USING btree (match_id);


--
-- Name: idx_banners_tournament_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_banners_tournament_id ON public.banners USING btree (tournament_id);


--
-- Name: idx_channel_servers_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_servers_channel_id ON public.channel_streaming_servers USING btree (channel_id);


--
-- Name: idx_channel_servers_display_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_servers_display_order ON public.channel_streaming_servers USING btree (display_order);


--
-- Name: idx_channels_display_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_display_order ON public.channels USING btree (display_order);


--
-- Name: idx_channels_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_slug ON public.channels USING btree (slug);


--
-- Name: idx_cricket_series_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cricket_series_is_active ON public.cricket_series USING btree (is_active);


--
-- Name: idx_cricket_series_series_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cricket_series_series_id ON public.cricket_series USING btree (series_id);


--
-- Name: idx_custom_menus_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_menus_order ON public.custom_menus USING btree (display_order);


--
-- Name: idx_custom_menus_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_menus_parent ON public.custom_menus USING btree (parent_id);


--
-- Name: idx_event_streaming_servers_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_streaming_servers_event_id ON public.event_streaming_servers USING btree (event_id);


--
-- Name: idx_events_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_slug ON public.events USING btree (slug);


--
-- Name: idx_events_start_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_start_time ON public.events USING btree (event_start_time);


--
-- Name: idx_match_api_scores_match_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_match_api_scores_match_id ON public.match_api_scores USING btree (match_id);


--
-- Name: idx_match_innings_batting_team; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_match_innings_batting_team ON public.match_innings USING btree (batting_team_id);


--
-- Name: idx_match_innings_match_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_match_innings_match_id ON public.match_innings USING btree (match_id);


--
-- Name: idx_matches_cricapi_match_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matches_cricapi_match_id ON public.matches USING btree (cricapi_match_id) WHERE (cricapi_match_id IS NOT NULL);


--
-- Name: idx_matches_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matches_status ON public.matches USING btree (status);


--
-- Name: idx_matches_team_a_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matches_team_a_id ON public.matches USING btree (team_a_id);


--
-- Name: idx_matches_team_b_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matches_team_b_id ON public.matches USING btree (team_b_id);


--
-- Name: idx_matches_toss_winner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matches_toss_winner ON public.matches USING btree (toss_winner_id) WHERE (toss_winner_id IS NOT NULL);


--
-- Name: idx_matches_tournament_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matches_tournament_id ON public.matches USING btree (tournament_id);


--
-- Name: idx_profiles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_user_id ON public.profiles USING btree (user_id);


--
-- Name: idx_saved_streaming_servers_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_saved_streaming_servers_name ON public.saved_streaming_servers USING btree (server_name);


--
-- Name: idx_saved_streaming_servers_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_saved_streaming_servers_tags ON public.saved_streaming_servers USING gin (tags);


--
-- Name: idx_sitemap_ping_history_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sitemap_ping_history_created_at ON public.sitemap_ping_history USING btree (created_at DESC);


--
-- Name: idx_sitemap_ping_history_ping_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sitemap_ping_history_ping_type ON public.sitemap_ping_history USING btree (ping_type);


--
-- Name: idx_streaming_json_sources_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_streaming_json_sources_order ON public.streaming_json_sources USING btree (display_order, created_at);


--
-- Name: streaming_servers_auto_source_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX streaming_servers_auto_source_unique ON public.streaming_servers USING btree (match_id, auto_source_id) WHERE (auto_source_id IS NOT NULL);


--
-- Name: tournament_points_table_tournament_team_group_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tournament_points_table_tournament_team_group_key ON public.tournament_points_table USING btree (tournament_id, team_id, COALESCE(group_name, '__none__'::text));


--
-- Name: matches auto_calculate_football_score_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER auto_calculate_football_score_trigger BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.auto_calculate_football_score();


--
-- Name: site_settings sync_site_settings_public_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_site_settings_public_trigger AFTER INSERT OR UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.sync_site_settings_public_from_site_settings();


--
-- Name: site_settings sync_site_settings_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_site_settings_trigger AFTER INSERT OR UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.sync_site_settings_public_from_site_settings();


--
-- Name: bottom_nav_items trg_bottom_nav_items_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bottom_nav_items_updated BEFORE UPDATE ON public.bottom_nav_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: streaming_json_sources trg_json_sources_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_json_sources_updated BEFORE UPDATE ON public.streaming_json_sources FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: matches trigger_reassign_slug_on_complete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_reassign_slug_on_complete BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.reassign_slug_on_match_complete();


--
-- Name: matches trigger_update_points_on_match_complete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_points_on_match_complete AFTER UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.update_points_on_match_complete();


--
-- Name: banners update_banners_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_banners_updated_at BEFORE UPDATE ON public.banners FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: channel_streaming_servers update_channel_streaming_servers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_channel_streaming_servers_updated_at BEFORE UPDATE ON public.channel_streaming_servers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: channels update_channels_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_channels_updated_at BEFORE UPDATE ON public.channels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: dynamic_pages update_dynamic_pages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_dynamic_pages_updated_at BEFORE UPDATE ON public.dynamic_pages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: event_streaming_servers update_event_streaming_servers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_event_streaming_servers_updated_at BEFORE UPDATE ON public.event_streaming_servers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: events update_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: match_api_scores update_match_api_scores_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_match_api_scores_updated_at BEFORE UPDATE ON public.match_api_scores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: match_innings update_match_innings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_match_innings_updated_at BEFORE UPDATE ON public.match_innings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: match_playing_xi update_match_playing_xi_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_match_playing_xi_updated_at BEFORE UPDATE ON public.match_playing_xi FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: match_substitutions update_match_substitutions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_match_substitutions_updated_at BEFORE UPDATE ON public.match_substitutions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: matches update_matches_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: roles update_roles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: saved_streaming_servers update_saved_streaming_servers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_saved_streaming_servers_updated_at BEFORE UPDATE ON public.saved_streaming_servers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: site_settings update_site_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_site_settings_updated_at BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sponsor_notices update_sponsor_notices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_sponsor_notices_updated_at BEFORE UPDATE ON public.sponsor_notices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sports update_sports_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_sports_updated_at BEFORE UPDATE ON public.sports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: streaming_servers update_streaming_servers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_streaming_servers_updated_at BEFORE UPDATE ON public.streaming_servers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: teams update_teams_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tournament_points_table update_tournament_points_table_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tournament_points_table_updated_at BEFORE UPDATE ON public.tournament_points_table FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tournaments update_tournaments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tournaments_updated_at BEFORE UPDATE ON public.tournaments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: banners banners_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banners
    ADD CONSTRAINT banners_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE SET NULL;


--
-- Name: banners banners_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banners
    ADD CONSTRAINT banners_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE SET NULL;


--
-- Name: channel_streaming_servers channel_streaming_servers_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_streaming_servers
    ADD CONSTRAINT channel_streaming_servers_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;


--
-- Name: custom_menus custom_menus_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_menus
    ADD CONSTRAINT custom_menus_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.custom_menus(id) ON DELETE CASCADE;


--
-- Name: custom_role_permissions custom_role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_role_permissions
    ADD CONSTRAINT custom_role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: event_streaming_servers event_streaming_servers_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_streaming_servers
    ADD CONSTRAINT event_streaming_servers_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: events events_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE SET NULL;


--
-- Name: match_api_scores match_api_scores_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_api_scores
    ADD CONSTRAINT match_api_scores_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;


--
-- Name: match_innings match_innings_batting_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_innings
    ADD CONSTRAINT match_innings_batting_team_id_fkey FOREIGN KEY (batting_team_id) REFERENCES public.teams(id);


--
-- Name: match_innings match_innings_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_innings
    ADD CONSTRAINT match_innings_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;


--
-- Name: match_playing_xi match_playing_xi_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_playing_xi
    ADD CONSTRAINT match_playing_xi_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;


--
-- Name: match_playing_xi match_playing_xi_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_playing_xi
    ADD CONSTRAINT match_playing_xi_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: match_substitutions match_substitutions_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_substitutions
    ADD CONSTRAINT match_substitutions_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;


--
-- Name: match_substitutions match_substitutions_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_substitutions
    ADD CONSTRAINT match_substitutions_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: matches matches_sport_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_sport_id_fkey FOREIGN KEY (sport_id) REFERENCES public.sports(id);


--
-- Name: matches matches_team_a_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_team_a_id_fkey FOREIGN KEY (team_a_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: matches matches_team_b_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_team_b_id_fkey FOREIGN KEY (team_b_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: matches matches_toss_winner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_toss_winner_id_fkey FOREIGN KEY (toss_winner_id) REFERENCES public.teams(id);


--
-- Name: matches matches_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sponsor_notices sponsor_notices_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sponsor_notices
    ADD CONSTRAINT sponsor_notices_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;


--
-- Name: streaming_json_sources streaming_json_sources_backup_of_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streaming_json_sources
    ADD CONSTRAINT streaming_json_sources_backup_of_source_id_fkey FOREIGN KEY (backup_of_source_id) REFERENCES public.streaming_json_sources(id) ON DELETE SET NULL;


--
-- Name: streaming_servers streaming_servers_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streaming_servers
    ADD CONSTRAINT streaming_servers_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;


--
-- Name: tournament_points_table tournament_points_table_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_points_table
    ADD CONSTRAINT tournament_points_table_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: tournament_points_table tournament_points_table_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_points_table
    ADD CONSTRAINT tournament_points_table_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- Name: tournament_venues tournament_venues_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_venues
    ADD CONSTRAINT tournament_venues_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- Name: user_custom_roles user_custom_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_custom_roles
    ADD CONSTRAINT user_custom_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_permissions user_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: banners Active banners are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Active banners are viewable by everyone" ON public.banners FOR SELECT USING ((is_active = true));


--
-- Name: channel_streaming_servers Active channel servers are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Active channel servers are viewable by everyone" ON public.channel_streaming_servers FOR SELECT USING ((is_active = true));


--
-- Name: streaming_json_sources Active json sources viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Active json sources viewable by everyone" ON public.streaming_json_sources FOR SELECT USING (true);


--
-- Name: dynamic_pages Active pages are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Active pages are viewable by everyone" ON public.dynamic_pages FOR SELECT USING ((is_active = true));


--
-- Name: ad_click_logs Admins can delete ad click logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete ad click logs" ON public.ad_click_logs FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: banners Admins can delete banners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete banners" ON public.banners FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: events Admins can delete events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete events" ON public.events FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: match_innings Admins can delete innings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete innings" ON public.match_innings FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: matches Admins can delete matches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete matches" ON public.matches FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: dynamic_pages Admins can delete pages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete pages" ON public.dynamic_pages FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: match_playing_xi Admins can delete playing XI; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete playing XI" ON public.match_playing_xi FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: tournament_points_table Admins can delete points table; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete points table" ON public.tournament_points_table FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: sports Admins can delete sports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete sports" ON public.sports FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: match_substitutions Admins can delete substitutions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete substitutions" ON public.match_substitutions FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: teams Admins can delete teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete teams" ON public.teams FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: tournaments Admins can delete tournaments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete tournaments" ON public.tournaments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can delete user roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete user roles" ON public.user_roles FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: banners Admins can insert banners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert banners" ON public.banners FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: events Admins can insert events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert events" ON public.events FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: match_innings Admins can insert innings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert innings" ON public.match_innings FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: matches Admins can insert matches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert matches" ON public.matches FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: dynamic_pages Admins can insert pages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert pages" ON public.dynamic_pages FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: match_playing_xi Admins can insert playing XI; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert playing XI" ON public.match_playing_xi FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: tournament_points_table Admins can insert points table; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert points table" ON public.tournament_points_table FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: site_settings Admins can insert site settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert site settings" ON public.site_settings FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: sports Admins can insert sports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert sports" ON public.sports FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: match_substitutions Admins can insert substitutions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert substitutions" ON public.match_substitutions FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: teams Admins can insert teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert teams" ON public.teams FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: tournaments Admins can insert tournaments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert tournaments" ON public.tournaments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can insert user roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert user roles" ON public.user_roles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: channel_streaming_servers Admins can manage channel servers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage channel servers" ON public.channel_streaming_servers USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: channels Admins can manage channels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage channels" ON public.channels USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: cricket_series Admins can manage cricket series; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage cricket series" ON public.cricket_series USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: custom_menus Admins can manage custom menus; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage custom menus" ON public.custom_menus USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: football_leagues Admins can manage football leagues; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage football leagues" ON public.football_leagues USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: match_api_scores Admins can manage match API scores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage match API scores" ON public.match_api_scores USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: sitemap_ping_history Admins can manage ping history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage ping history" ON public.sitemap_ping_history USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: site_settings_public Admins can manage public site settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage public site settings" ON public.site_settings_public USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: saved_streaming_servers Admins can manage saved streaming servers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage saved streaming servers" ON public.saved_streaming_servers USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: sponsor_notices Admins can manage sponsor notices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage sponsor notices" ON public.sponsor_notices USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: streaming_servers Admins can manage streaming servers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage streaming servers" ON public.streaming_servers USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: tournament_venues Admins can manage tournament venues; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage tournament venues" ON public.tournament_venues USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: site_settings Admins can read all site settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read all site settings" ON public.site_settings FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: banners Admins can update banners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update banners" ON public.banners FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: events Admins can update events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update events" ON public.events FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: match_innings Admins can update innings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update innings" ON public.match_innings FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: matches Admins can update matches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update matches" ON public.matches FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: dynamic_pages Admins can update pages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update pages" ON public.dynamic_pages FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: match_playing_xi Admins can update playing XI; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update playing XI" ON public.match_playing_xi FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: tournament_points_table Admins can update points table; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update points table" ON public.tournament_points_table FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: site_settings Admins can update site settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update site settings" ON public.site_settings FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: sports Admins can update sports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update sports" ON public.sports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: match_substitutions Admins can update substitutions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update substitutions" ON public.match_substitutions FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: teams Admins can update teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update teams" ON public.teams FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: tournaments Admins can update tournaments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update tournaments" ON public.tournaments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can update user roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update user roles" ON public.user_roles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can view all user roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all user roles" ON public.user_roles FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: bottom_nav_items Admins manage bottom nav; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage bottom nav" ON public.bottom_nav_items TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: event_streaming_servers Admins manage event servers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage event servers" ON public.event_streaming_servers TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: streaming_json_sources Admins manage json sources; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage json sources" ON public.streaming_json_sources USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: ad_click_logs Anyone can insert ad click logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert ad click logs" ON public.ad_click_logs FOR INSERT WITH CHECK (true);


--
-- Name: ad_click_logs Anyone can read ad click logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read ad click logs" ON public.ad_click_logs FOR SELECT USING (true);


--
-- Name: ad_click_logs Anyone can update ad click logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can update ad click logs" ON public.ad_click_logs FOR UPDATE USING (true);


--
-- Name: sponsor_notices Anyone can view active sponsor notices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active sponsor notices" ON public.sponsor_notices FOR SELECT USING ((is_active = true));


--
-- Name: streaming_servers Anyone can view active streaming servers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active streaming servers" ON public.streaming_servers FOR SELECT USING ((is_active = true));


--
-- Name: bottom_nav_items Bottom nav readable by all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Bottom nav readable by all" ON public.bottom_nav_items FOR SELECT USING (true);


--
-- Name: channels Channels are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Channels are viewable by everyone" ON public.channels FOR SELECT USING ((is_active = true));


--
-- Name: cricket_series Cricket series viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cricket series viewable by everyone" ON public.cricket_series FOR SELECT USING (true);


--
-- Name: custom_menus Custom menus are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Custom menus are viewable by everyone" ON public.custom_menus FOR SELECT USING ((is_active = true));


--
-- Name: custom_role_permissions Custom role permissions viewable by authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Custom role permissions viewable by authenticated" ON public.custom_role_permissions FOR SELECT USING (true);


--
-- Name: football_leagues Football leagues viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Football leagues viewable by everyone" ON public.football_leagues FOR SELECT USING (true);


--
-- Name: match_innings Innings are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Innings are viewable by everyone" ON public.match_innings FOR SELECT USING (true);


--
-- Name: match_api_scores Match API scores are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Match API scores are viewable by everyone" ON public.match_api_scores FOR SELECT USING (true);


--
-- Name: matches Matches are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Matches are viewable by everyone" ON public.matches FOR SELECT USING (true);


--
-- Name: custom_role_permissions Only admins can manage custom role permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can manage custom role permissions" ON public.custom_role_permissions USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: roles Only admins can manage roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can manage roles" ON public.roles USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_custom_roles Only admins can manage user custom roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can manage user custom roles" ON public.user_custom_roles USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_permissions Only admins can manage user permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can manage user permissions" ON public.user_permissions USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: role_permissions Only super admins can manage role permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only super admins can manage role permissions" ON public.role_permissions USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: sitemap_ping_history Ping history is viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Ping history is viewable by everyone" ON public.sitemap_ping_history FOR SELECT USING (true);


--
-- Name: match_playing_xi Playing XI is viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Playing XI is viewable by everyone" ON public.match_playing_xi FOR SELECT USING (true);


--
-- Name: tournament_points_table Points table is viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Points table is viewable by everyone" ON public.tournament_points_table FOR SELECT USING (true);


--
-- Name: profiles Profiles viewable by owner and admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profiles viewable by owner and admins" ON public.profiles FOR SELECT USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: event_streaming_servers Public can view active event servers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view active event servers" ON public.event_streaming_servers FOR SELECT USING (((is_active = true) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: events Public can view active events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view active events" ON public.events FOR SELECT USING (((is_active = true) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: site_settings_public Public site settings are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public site settings are viewable by everyone" ON public.site_settings_public FOR SELECT USING (true);


--
-- Name: role_permissions Role permissions are viewable by authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Role permissions are viewable by authenticated users" ON public.role_permissions FOR SELECT TO authenticated USING (true);


--
-- Name: roles Roles are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Roles are viewable by everyone" ON public.roles FOR SELECT USING (true);


--
-- Name: admin_otp_codes Service role can manage OTP codes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage OTP codes" ON public.admin_otp_codes USING (true) WITH CHECK (true);


--
-- Name: cricket_series Service role can manage cricket series; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage cricket series" ON public.cricket_series USING (true) WITH CHECK (true);


--
-- Name: football_leagues Service role can manage football leagues; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage football leagues" ON public.football_leagues USING (true) WITH CHECK (true);


--
-- Name: match_api_scores Service role can manage match API scores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage match API scores" ON public.match_api_scores USING (true) WITH CHECK (true);


--
-- Name: sitemap_ping_history Service role can manage ping history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage ping history" ON public.sitemap_ping_history USING (true) WITH CHECK (true);


--
-- Name: profiles Service role can manage profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage profiles" ON public.profiles USING (true) WITH CHECK (true);


--
-- Name: sports Sports are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sports are viewable by everyone" ON public.sports FOR SELECT USING (true);


--
-- Name: match_substitutions Substitutions are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Substitutions are viewable by everyone" ON public.match_substitutions FOR SELECT USING (true);


--
-- Name: teams Teams are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teams are viewable by everyone" ON public.teams FOR SELECT USING (true);


--
-- Name: tournament_venues Tournament venues are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tournament venues are viewable by everyone" ON public.tournament_venues FOR SELECT USING (true);


--
-- Name: tournaments Tournaments are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tournaments are viewable by everyone" ON public.tournaments FOR SELECT USING (true);


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: user_custom_roles Users can view their own custom roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own custom roles" ON public.user_custom_roles FOR SELECT USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: user_permissions Users can view their own permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own permissions" ON public.user_permissions FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: ad_click_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ad_click_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_otp_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_otp_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: banners; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

--
-- Name: bottom_nav_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bottom_nav_items ENABLE ROW LEVEL SECURITY;

--
-- Name: channel_streaming_servers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.channel_streaming_servers ENABLE ROW LEVEL SECURITY;

--
-- Name: channels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

--
-- Name: cricket_series; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cricket_series ENABLE ROW LEVEL SECURITY;

--
-- Name: custom_menus; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.custom_menus ENABLE ROW LEVEL SECURITY;

--
-- Name: custom_role_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.custom_role_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: dynamic_pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dynamic_pages ENABLE ROW LEVEL SECURITY;

--
-- Name: event_streaming_servers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.event_streaming_servers ENABLE ROW LEVEL SECURITY;

--
-- Name: events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

--
-- Name: football_leagues; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.football_leagues ENABLE ROW LEVEL SECURITY;

--
-- Name: match_api_scores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.match_api_scores ENABLE ROW LEVEL SECURITY;

--
-- Name: match_innings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.match_innings ENABLE ROW LEVEL SECURITY;

--
-- Name: match_playing_xi; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.match_playing_xi ENABLE ROW LEVEL SECURITY;

--
-- Name: match_substitutions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.match_substitutions ENABLE ROW LEVEL SECURITY;

--
-- Name: matches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: role_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

--
-- Name: saved_streaming_servers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.saved_streaming_servers ENABLE ROW LEVEL SECURITY;

--
-- Name: site_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: site_settings_public; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_settings_public ENABLE ROW LEVEL SECURITY;

--
-- Name: sitemap_ping_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sitemap_ping_history ENABLE ROW LEVEL SECURITY;

--
-- Name: sponsor_notices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sponsor_notices ENABLE ROW LEVEL SECURITY;

--
-- Name: sports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sports ENABLE ROW LEVEL SECURITY;

--
-- Name: streaming_json_sources; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.streaming_json_sources ENABLE ROW LEVEL SECURITY;

--
-- Name: streaming_servers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.streaming_servers ENABLE ROW LEVEL SECURITY;

--
-- Name: teams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

--
-- Name: tournament_points_table; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tournament_points_table ENABLE ROW LEVEL SECURITY;

--
-- Name: tournament_venues; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tournament_venues ENABLE ROW LEVEL SECURITY;

--
-- Name: tournaments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

--
-- Name: user_custom_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_custom_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO sandbox_exec;


--
-- Name: FUNCTION auto_calculate_football_score(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.auto_calculate_football_score() TO anon;
GRANT ALL ON FUNCTION public.auto_calculate_football_score() TO authenticated;
GRANT ALL ON FUNCTION public.auto_calculate_football_score() TO service_role;
GRANT ALL ON FUNCTION public.auto_calculate_football_score() TO sandbox_exec;


--
-- Name: FUNCTION auto_complete_expired_tournaments(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.auto_complete_expired_tournaments() TO anon;
GRANT ALL ON FUNCTION public.auto_complete_expired_tournaments() TO authenticated;
GRANT ALL ON FUNCTION public.auto_complete_expired_tournaments() TO service_role;
GRANT ALL ON FUNCTION public.auto_complete_expired_tournaments() TO sandbox_exec;


--
-- Name: FUNCTION call_sync_api_scores(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.call_sync_api_scores() TO anon;
GRANT ALL ON FUNCTION public.call_sync_api_scores() TO authenticated;
GRANT ALL ON FUNCTION public.call_sync_api_scores() TO service_role;
GRANT ALL ON FUNCTION public.call_sync_api_scores() TO sandbox_exec;


--
-- Name: FUNCTION call_sync_streaming_from_json(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.call_sync_streaming_from_json() TO anon;
GRANT ALL ON FUNCTION public.call_sync_streaming_from_json() TO authenticated;
GRANT ALL ON FUNCTION public.call_sync_streaming_from_json() TO service_role;
GRANT ALL ON FUNCTION public.call_sync_streaming_from_json() TO sandbox_exec;


--
-- Name: FUNCTION call_update_match_status(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.call_update_match_status() TO anon;
GRANT ALL ON FUNCTION public.call_update_match_status() TO authenticated;
GRANT ALL ON FUNCTION public.call_update_match_status() TO service_role;
GRANT ALL ON FUNCTION public.call_update_match_status() TO sandbox_exec;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;
GRANT ALL ON FUNCTION public.handle_new_user() TO sandbox_exec;


--
-- Name: FUNCTION has_custom_permission(_user_id uuid, _permission text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.has_custom_permission(_user_id uuid, _permission text) TO anon;
GRANT ALL ON FUNCTION public.has_custom_permission(_user_id uuid, _permission text) TO authenticated;
GRANT ALL ON FUNCTION public.has_custom_permission(_user_id uuid, _permission text) TO service_role;
GRANT ALL ON FUNCTION public.has_custom_permission(_user_id uuid, _permission text) TO sandbox_exec;


--
-- Name: FUNCTION has_permission(_user_id uuid, _permission text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.has_permission(_user_id uuid, _permission text) TO anon;
GRANT ALL ON FUNCTION public.has_permission(_user_id uuid, _permission text) TO authenticated;
GRANT ALL ON FUNCTION public.has_permission(_user_id uuid, _permission text) TO service_role;
GRANT ALL ON FUNCTION public.has_permission(_user_id uuid, _permission text) TO sandbox_exec;


--
-- Name: FUNCTION has_role(_user_id uuid, _role public.app_role); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO anon;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO authenticated;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO service_role;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO sandbox_exec;


--
-- Name: FUNCTION reassign_slug_on_match_complete(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.reassign_slug_on_match_complete() TO anon;
GRANT ALL ON FUNCTION public.reassign_slug_on_match_complete() TO authenticated;
GRANT ALL ON FUNCTION public.reassign_slug_on_match_complete() TO service_role;
GRANT ALL ON FUNCTION public.reassign_slug_on_match_complete() TO sandbox_exec;


--
-- Name: FUNCTION recalculate_tournament_positions(p_tournament_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.recalculate_tournament_positions(p_tournament_id uuid) TO anon;
GRANT ALL ON FUNCTION public.recalculate_tournament_positions(p_tournament_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.recalculate_tournament_positions(p_tournament_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.recalculate_tournament_positions(p_tournament_id uuid) TO sandbox_exec;


--
-- Name: FUNCTION sync_site_settings_public(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.sync_site_settings_public() TO anon;
GRANT ALL ON FUNCTION public.sync_site_settings_public() TO authenticated;
GRANT ALL ON FUNCTION public.sync_site_settings_public() TO service_role;
GRANT ALL ON FUNCTION public.sync_site_settings_public() TO sandbox_exec;


--
-- Name: FUNCTION sync_site_settings_public_from_site_settings(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.sync_site_settings_public_from_site_settings() TO anon;
GRANT ALL ON FUNCTION public.sync_site_settings_public_from_site_settings() TO authenticated;
GRANT ALL ON FUNCTION public.sync_site_settings_public_from_site_settings() TO service_role;
GRANT ALL ON FUNCTION public.sync_site_settings_public_from_site_settings() TO sandbox_exec;


--
-- Name: FUNCTION update_points_on_match_complete(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_points_on_match_complete() TO anon;
GRANT ALL ON FUNCTION public.update_points_on_match_complete() TO authenticated;
GRANT ALL ON FUNCTION public.update_points_on_match_complete() TO service_role;
GRANT ALL ON FUNCTION public.update_points_on_match_complete() TO sandbox_exec;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_updated_at_column() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO sandbox_exec;


--
-- Name: TABLE ad_click_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ad_click_logs TO anon;
GRANT ALL ON TABLE public.ad_click_logs TO authenticated;
GRANT ALL ON TABLE public.ad_click_logs TO service_role;
GRANT SELECT,INSERT ON TABLE public.ad_click_logs TO sandbox_exec;


--
-- Name: TABLE admin_otp_codes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.admin_otp_codes TO anon;
GRANT ALL ON TABLE public.admin_otp_codes TO authenticated;
GRANT ALL ON TABLE public.admin_otp_codes TO service_role;
GRANT SELECT,INSERT ON TABLE public.admin_otp_codes TO sandbox_exec;


--
-- Name: TABLE banners; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.banners TO anon;
GRANT ALL ON TABLE public.banners TO authenticated;
GRANT ALL ON TABLE public.banners TO service_role;
GRANT SELECT,INSERT ON TABLE public.banners TO sandbox_exec;


--
-- Name: TABLE bottom_nav_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.bottom_nav_items TO anon;
GRANT ALL ON TABLE public.bottom_nav_items TO authenticated;
GRANT ALL ON TABLE public.bottom_nav_items TO service_role;
GRANT SELECT,INSERT ON TABLE public.bottom_nav_items TO sandbox_exec;


--
-- Name: TABLE channel_streaming_servers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.channel_streaming_servers TO anon;
GRANT ALL ON TABLE public.channel_streaming_servers TO authenticated;
GRANT ALL ON TABLE public.channel_streaming_servers TO service_role;
GRANT SELECT,INSERT ON TABLE public.channel_streaming_servers TO sandbox_exec;


--
-- Name: TABLE channels; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.channels TO anon;
GRANT ALL ON TABLE public.channels TO authenticated;
GRANT ALL ON TABLE public.channels TO service_role;
GRANT SELECT,INSERT ON TABLE public.channels TO sandbox_exec;


--
-- Name: TABLE cricket_series; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cricket_series TO anon;
GRANT ALL ON TABLE public.cricket_series TO authenticated;
GRANT ALL ON TABLE public.cricket_series TO service_role;
GRANT SELECT,INSERT ON TABLE public.cricket_series TO sandbox_exec;


--
-- Name: TABLE custom_menus; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.custom_menus TO anon;
GRANT ALL ON TABLE public.custom_menus TO authenticated;
GRANT ALL ON TABLE public.custom_menus TO service_role;
GRANT SELECT,INSERT ON TABLE public.custom_menus TO sandbox_exec;


--
-- Name: TABLE custom_role_permissions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.custom_role_permissions TO anon;
GRANT ALL ON TABLE public.custom_role_permissions TO authenticated;
GRANT ALL ON TABLE public.custom_role_permissions TO service_role;
GRANT SELECT,INSERT ON TABLE public.custom_role_permissions TO sandbox_exec;


--
-- Name: TABLE dynamic_pages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.dynamic_pages TO anon;
GRANT ALL ON TABLE public.dynamic_pages TO authenticated;
GRANT ALL ON TABLE public.dynamic_pages TO service_role;
GRANT SELECT,INSERT ON TABLE public.dynamic_pages TO sandbox_exec;


--
-- Name: TABLE event_streaming_servers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.event_streaming_servers TO anon;
GRANT ALL ON TABLE public.event_streaming_servers TO authenticated;
GRANT ALL ON TABLE public.event_streaming_servers TO service_role;
GRANT SELECT,INSERT ON TABLE public.event_streaming_servers TO sandbox_exec;


--
-- Name: TABLE events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.events TO anon;
GRANT ALL ON TABLE public.events TO authenticated;
GRANT ALL ON TABLE public.events TO service_role;
GRANT SELECT,INSERT ON TABLE public.events TO sandbox_exec;


--
-- Name: TABLE football_leagues; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.football_leagues TO anon;
GRANT ALL ON TABLE public.football_leagues TO authenticated;
GRANT ALL ON TABLE public.football_leagues TO service_role;
GRANT SELECT,INSERT ON TABLE public.football_leagues TO sandbox_exec;


--
-- Name: TABLE match_api_scores; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.match_api_scores TO anon;
GRANT ALL ON TABLE public.match_api_scores TO authenticated;
GRANT ALL ON TABLE public.match_api_scores TO service_role;
GRANT SELECT,INSERT ON TABLE public.match_api_scores TO sandbox_exec;


--
-- Name: TABLE match_innings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.match_innings TO anon;
GRANT ALL ON TABLE public.match_innings TO authenticated;
GRANT ALL ON TABLE public.match_innings TO service_role;
GRANT SELECT,INSERT ON TABLE public.match_innings TO sandbox_exec;


--
-- Name: TABLE match_playing_xi; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.match_playing_xi TO anon;
GRANT ALL ON TABLE public.match_playing_xi TO authenticated;
GRANT ALL ON TABLE public.match_playing_xi TO service_role;
GRANT SELECT,INSERT ON TABLE public.match_playing_xi TO sandbox_exec;


--
-- Name: TABLE match_substitutions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.match_substitutions TO anon;
GRANT ALL ON TABLE public.match_substitutions TO authenticated;
GRANT ALL ON TABLE public.match_substitutions TO service_role;
GRANT SELECT,INSERT ON TABLE public.match_substitutions TO sandbox_exec;


--
-- Name: TABLE matches; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.matches TO anon;
GRANT ALL ON TABLE public.matches TO authenticated;
GRANT ALL ON TABLE public.matches TO service_role;
GRANT SELECT,INSERT ON TABLE public.matches TO sandbox_exec;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;
GRANT SELECT,INSERT ON TABLE public.profiles TO sandbox_exec;


--
-- Name: TABLE role_permissions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.role_permissions TO anon;
GRANT ALL ON TABLE public.role_permissions TO authenticated;
GRANT ALL ON TABLE public.role_permissions TO service_role;
GRANT SELECT,INSERT ON TABLE public.role_permissions TO sandbox_exec;


--
-- Name: TABLE roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.roles TO anon;
GRANT ALL ON TABLE public.roles TO authenticated;
GRANT ALL ON TABLE public.roles TO service_role;
GRANT SELECT,INSERT ON TABLE public.roles TO sandbox_exec;


--
-- Name: TABLE saved_streaming_servers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.saved_streaming_servers TO anon;
GRANT ALL ON TABLE public.saved_streaming_servers TO authenticated;
GRANT ALL ON TABLE public.saved_streaming_servers TO service_role;
GRANT SELECT,INSERT ON TABLE public.saved_streaming_servers TO sandbox_exec;


--
-- Name: TABLE site_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.site_settings TO anon;
GRANT ALL ON TABLE public.site_settings TO authenticated;
GRANT ALL ON TABLE public.site_settings TO service_role;
GRANT SELECT,INSERT ON TABLE public.site_settings TO sandbox_exec;


--
-- Name: TABLE site_settings_public; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.site_settings_public TO service_role;
GRANT SELECT ON TABLE public.site_settings_public TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.site_settings_public TO authenticated;
GRANT SELECT,INSERT ON TABLE public.site_settings_public TO sandbox_exec;


--
-- Name: TABLE sitemap_ping_history; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sitemap_ping_history TO anon;
GRANT ALL ON TABLE public.sitemap_ping_history TO authenticated;
GRANT ALL ON TABLE public.sitemap_ping_history TO service_role;
GRANT SELECT,INSERT ON TABLE public.sitemap_ping_history TO sandbox_exec;


--
-- Name: TABLE sponsor_notices; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sponsor_notices TO anon;
GRANT ALL ON TABLE public.sponsor_notices TO authenticated;
GRANT ALL ON TABLE public.sponsor_notices TO service_role;
GRANT SELECT,INSERT ON TABLE public.sponsor_notices TO sandbox_exec;


--
-- Name: TABLE sports; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sports TO anon;
GRANT ALL ON TABLE public.sports TO authenticated;
GRANT ALL ON TABLE public.sports TO service_role;
GRANT SELECT,INSERT ON TABLE public.sports TO sandbox_exec;


--
-- Name: TABLE streaming_json_sources; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.streaming_json_sources TO anon;
GRANT ALL ON TABLE public.streaming_json_sources TO authenticated;
GRANT ALL ON TABLE public.streaming_json_sources TO service_role;
GRANT SELECT,INSERT ON TABLE public.streaming_json_sources TO sandbox_exec;


--
-- Name: TABLE streaming_servers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.streaming_servers TO anon;
GRANT ALL ON TABLE public.streaming_servers TO authenticated;
GRANT ALL ON TABLE public.streaming_servers TO service_role;
GRANT SELECT,INSERT ON TABLE public.streaming_servers TO sandbox_exec;


--
-- Name: TABLE streaming_servers_public; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.streaming_servers_public TO anon;
GRANT ALL ON TABLE public.streaming_servers_public TO authenticated;
GRANT ALL ON TABLE public.streaming_servers_public TO service_role;
GRANT SELECT,INSERT ON TABLE public.streaming_servers_public TO sandbox_exec;


--
-- Name: TABLE teams; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.teams TO anon;
GRANT ALL ON TABLE public.teams TO authenticated;
GRANT ALL ON TABLE public.teams TO service_role;
GRANT SELECT,INSERT ON TABLE public.teams TO sandbox_exec;


--
-- Name: TABLE tournament_points_table; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tournament_points_table TO anon;
GRANT ALL ON TABLE public.tournament_points_table TO authenticated;
GRANT ALL ON TABLE public.tournament_points_table TO service_role;
GRANT SELECT,INSERT ON TABLE public.tournament_points_table TO sandbox_exec;


--
-- Name: TABLE tournament_venues; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tournament_venues TO anon;
GRANT ALL ON TABLE public.tournament_venues TO authenticated;
GRANT ALL ON TABLE public.tournament_venues TO service_role;
GRANT SELECT,INSERT ON TABLE public.tournament_venues TO sandbox_exec;


--
-- Name: TABLE tournaments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tournaments TO anon;
GRANT ALL ON TABLE public.tournaments TO authenticated;
GRANT ALL ON TABLE public.tournaments TO service_role;
GRANT SELECT,INSERT ON TABLE public.tournaments TO sandbox_exec;


--
-- Name: TABLE user_custom_roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_custom_roles TO anon;
GRANT ALL ON TABLE public.user_custom_roles TO authenticated;
GRANT ALL ON TABLE public.user_custom_roles TO service_role;
GRANT SELECT,INSERT ON TABLE public.user_custom_roles TO sandbox_exec;


--
-- Name: TABLE user_permissions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_permissions TO anon;
GRANT ALL ON TABLE public.user_permissions TO authenticated;
GRANT ALL ON TABLE public.user_permissions TO service_role;
GRANT SELECT,INSERT ON TABLE public.user_permissions TO sandbox_exec;


--
-- Name: TABLE user_roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_roles TO anon;
GRANT ALL ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;
GRANT SELECT,INSERT ON TABLE public.user_roles TO sandbox_exec;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,USAGE ON SEQUENCES TO sandbox_exec;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO sandbox_exec;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT ON TABLES TO sandbox_exec;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

