-- Add SMTP configuration columns to site_settings
ALTER TABLE public.site_settings
ADD COLUMN IF NOT EXISTS smtp_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS smtp_host text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS smtp_port integer DEFAULT 587,
ADD COLUMN IF NOT EXISTS smtp_user text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS smtp_password text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS smtp_from_email text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS smtp_from_name text DEFAULT NULL;