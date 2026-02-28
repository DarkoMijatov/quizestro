
-- Add new branding columns for full customization (Pro feature)
ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS branding_bg_color text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS branding_text_color text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS branding_header_color text DEFAULT NULL;
