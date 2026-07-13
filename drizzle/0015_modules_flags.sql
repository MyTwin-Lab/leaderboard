ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS modules_meetings_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS modules_onboarding_enabled boolean NOT NULL DEFAULT true;
