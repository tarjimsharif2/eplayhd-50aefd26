-- Create table for storing OTP codes
CREATE TABLE public.admin_otp_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  otp_code text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  is_used boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_otp_codes ENABLE ROW LEVEL SECURITY;

-- Only service role can manage OTP codes (edge functions use service role)
CREATE POLICY "Service role can manage OTP codes"
ON public.admin_otp_codes
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_admin_otp_codes_user_id ON public.admin_otp_codes(user_id);
CREATE INDEX idx_admin_otp_codes_expires_at ON public.admin_otp_codes(expires_at);