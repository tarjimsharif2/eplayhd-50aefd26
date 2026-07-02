-- Create custom_menus table for menu management
CREATE TABLE public.custom_menus (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT,
  icon_name TEXT,
  parent_id UUID REFERENCES public.custom_menus(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  open_in_new_tab BOOLEAN DEFAULT false,
  menu_type TEXT DEFAULT 'link',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.custom_menus ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Custom menus are viewable by everyone"
ON public.custom_menus
FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage custom menus"
ON public.custom_menus
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster queries
CREATE INDEX idx_custom_menus_parent ON public.custom_menus(parent_id);
CREATE INDEX idx_custom_menus_order ON public.custom_menus(display_order);