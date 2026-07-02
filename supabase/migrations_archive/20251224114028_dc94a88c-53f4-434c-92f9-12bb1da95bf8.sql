-- Add DRM fields to streaming_servers table
ALTER TABLE public.streaming_servers
ADD COLUMN drm_license_url TEXT,
ADD COLUMN drm_scheme TEXT DEFAULT NULL;