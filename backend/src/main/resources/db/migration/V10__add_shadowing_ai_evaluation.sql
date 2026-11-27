-- Backward-compatible column to persist structured local AI Shadowing evaluations
-- Existing rows remain untouched with evaluation_json = NULL
ALTER TABLE shadowing_attempts
    ADD COLUMN IF NOT EXISTS evaluation_json TEXT;
