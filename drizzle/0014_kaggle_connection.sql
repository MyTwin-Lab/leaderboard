ALTER TABLE "app_settings"
  ADD COLUMN IF NOT EXISTS "kaggle_username"      varchar(255),
  ADD COLUMN IF NOT EXISTS "kaggle_key_enc"        text,
  ADD COLUMN IF NOT EXISTS "kaggle_key_iv"         varchar(64),
  ADD COLUMN IF NOT EXISTS "kaggle_connected_at"   timestamp,
  ADD COLUMN IF NOT EXISTS "kaggle_connected_by"   uuid REFERENCES "users"("uuid");
