-- Add new columns to matches table
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS match_link text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS match_duration_minutes integer DEFAULT 180,
ADD COLUMN IF NOT EXISTS match_start_time timestamp with time zone DEFAULT NULL;

-- Add logo_url to tournaments table
ALTER TABLE public.tournaments 
ADD COLUMN IF NOT EXISTS logo_url text DEFAULT NULL;

-- Create banners table
CREATE TABLE IF NOT EXISTS public.banners (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  image_url text NOT NULL,
  link_url text,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS for banners
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

-- Public can view active banners
CREATE POLICY "Active banners are viewable by everyone" 
ON public.banners 
FOR SELECT 
USING (is_active = true);

-- Authenticated users can manage banners
CREATE POLICY "Authenticated users can insert banners" 
ON public.banners 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update banners" 
ON public.banners 
FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated users can delete banners" 
ON public.banners 
FOR DELETE 
USING (true);

-- Create trigger for banners updated_at
CREATE TRIGGER update_banners_updated_at
BEFORE UPDATE ON public.banners
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();