-- Create sponsor_notices table for stream page notices
CREATE TABLE public.sponsor_notices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  position TEXT NOT NULL DEFAULT 'before_stream' CHECK (position IN ('before_stream', 'before_servers', 'before_scoreboard')),
  display_type TEXT NOT NULL DEFAULT 'static' CHECK (display_type IN ('static', 'marquee')),
  text_color TEXT DEFAULT '#ffffff',
  background_color TEXT DEFAULT '#1a1a2e',
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
  is_global BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sponsor_notices ENABLE ROW LEVEL SECURITY;

-- Public read policy
CREATE POLICY "Anyone can view active sponsor notices"
  ON public.sponsor_notices
  FOR SELECT
  USING (is_active = true);

-- Admin write policy
CREATE POLICY "Admins can manage sponsor notices"
  ON public.sponsor_notices
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Update trigger
CREATE TRIGGER update_sponsor_notices_updated_at
  BEFORE UPDATE ON public.sponsor_notices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.sponsor_notices;