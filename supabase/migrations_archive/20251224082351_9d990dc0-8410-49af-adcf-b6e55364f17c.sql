-- Create sports table for managing sport types with icons
CREATE TABLE public.sports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  icon_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on sports
ALTER TABLE public.sports ENABLE ROW LEVEL SECURITY;

-- Sports are viewable by everyone
CREATE POLICY "Sports are viewable by everyone" 
ON public.sports 
FOR SELECT 
USING (true);

-- Only admins can manage sports (will use has_role function)
CREATE POLICY "Admins can insert sports" 
ON public.sports 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Admins can update sports" 
ON public.sports 
FOR UPDATE 
USING (true);

CREATE POLICY "Admins can delete sports" 
ON public.sports 
FOR DELETE 
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_sports_updated_at
BEFORE UPDATE ON public.sports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add new columns to matches table
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS is_priority BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS match_label TEXT,
ADD COLUMN IF NOT EXISTS sport_id UUID REFERENCES public.sports(id);

-- Make tournament_id nullable (optional)
ALTER TABLE public.matches 
ALTER COLUMN tournament_id DROP NOT NULL;

-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table for secure role management
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Insert some default sports
INSERT INTO public.sports (name, icon_url) VALUES 
  ('Cricket', NULL),
  ('Football', NULL),
  ('Tennis', NULL),
  ('Basketball', NULL),
  ('Hockey', NULL)
ON CONFLICT (name) DO NOTHING;