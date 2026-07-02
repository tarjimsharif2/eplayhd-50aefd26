-- Create roles table for custom roles
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  is_system boolean DEFAULT false,
  color text DEFAULT '#6b7280',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for roles table
CREATE POLICY "Roles are viewable by everyone"
ON public.roles FOR SELECT
USING (true);

CREATE POLICY "Only admins can manage roles"
ON public.roles FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert default system roles
INSERT INTO public.roles (name, display_name, description, is_system, color) VALUES
('admin', 'Admin', 'Full system access with all permissions', true, '#ef4444'),
('moderator', 'Moderator', 'Can manage content and moderate users', true, '#f59e0b'),
('user', 'User', 'Basic user access', true, '#22c55e')
ON CONFLICT (name) DO NOTHING;

-- Create custom_role_permissions table for custom roles
CREATE TABLE IF NOT EXISTS public.custom_role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid REFERENCES public.roles(id) ON DELETE CASCADE NOT NULL,
  permission text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(role_id, permission)
);

-- Enable RLS
ALTER TABLE public.custom_role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Custom role permissions viewable by authenticated"
ON public.custom_role_permissions FOR SELECT
USING (true);

CREATE POLICY "Only admins can manage custom role permissions"
ON public.custom_role_permissions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create user_custom_roles table for assigning custom roles to users
CREATE TABLE IF NOT EXISTS public.user_custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role_id uuid REFERENCES public.roles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, role_id)
);

-- Enable RLS
ALTER TABLE public.user_custom_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own custom roles"
ON public.user_custom_roles FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can manage user custom roles"
ON public.user_custom_roles FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create function to check custom role permission
CREATE OR REPLACE FUNCTION public.has_custom_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

-- Add trigger for updated_at
CREATE TRIGGER update_roles_updated_at
BEFORE UPDATE ON public.roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();