-- Fix the security definer view by setting security_invoker
ALTER VIEW public.site_settings_public SET (security_invoker = on);