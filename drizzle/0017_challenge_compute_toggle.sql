ALTER TABLE "challenges"
  ADD COLUMN IF NOT EXISTS "compute_enabled" boolean NOT NULL DEFAULT false;
