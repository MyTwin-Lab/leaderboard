-- contributions.reward is a cache of SUM(reward_entries.points) for that
-- contribution. It was being resynced by hand in application code
-- (RewardEntryRepository.createManyAndSyncRewards), which only covers one
-- write path: a single-row insert (RewardEntryRepository.create, used
-- nowhere today but part of the public API) silently left the cache stale,
-- and any future write path would have the same footgun. Moving the sync
-- into a trigger makes it impossible to write reward_entries without the
-- cache following, regardless of which code (or future code, or a manual
-- SQL fix) does the write.

CREATE OR REPLACE FUNCTION sync_contribution_reward() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.contribution_id IS NOT NULL THEN
      UPDATE contributions
      SET reward = COALESCE(
        (SELECT SUM(points) FROM reward_entries WHERE contribution_id = OLD.contribution_id), 0
      )
      WHERE uuid = OLD.contribution_id;
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.contribution_id IS NOT NULL THEN
    UPDATE contributions
    SET reward = COALESCE(
      (SELECT SUM(points) FROM reward_entries WHERE contribution_id = NEW.contribution_id), 0
    )
    WHERE uuid = NEW.contribution_id;
  END IF;

  -- An UPDATE that moves a row to a different contribution_id leaves the
  -- previous one's cache stale otherwise. Ledger rows are append-only in
  -- practice (see RewardEntryRepository docstring), but this keeps the
  -- trigger correct rather than relying on that convention holding forever.
  IF TG_OP = 'UPDATE' AND OLD.contribution_id IS DISTINCT FROM NEW.contribution_id
     AND OLD.contribution_id IS NOT NULL THEN
    UPDATE contributions
    SET reward = COALESCE(
      (SELECT SUM(points) FROM reward_entries WHERE contribution_id = OLD.contribution_id), 0
    )
    WHERE uuid = OLD.contribution_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_contribution_reward ON reward_entries;

CREATE TRIGGER trg_sync_contribution_reward
AFTER INSERT OR UPDATE OR DELETE ON reward_entries
FOR EACH ROW
EXECUTE FUNCTION sync_contribution_reward();

-- One-time backfill: contributions whose cache had already drifted from the
-- ledger before this trigger existed (e.g. the three 'dataset' rows —
-- 240 / 277 / 86 CP — sitting on contributions still showing 0).
UPDATE contributions c
SET reward = COALESCE(
  (SELECT SUM(re.points) FROM reward_entries re WHERE re.contribution_id = c.uuid), 0
)
WHERE c.uuid IN (SELECT DISTINCT contribution_id FROM reward_entries WHERE contribution_id IS NOT NULL);
