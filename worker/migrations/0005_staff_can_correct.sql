-- Owner-managed correction permission only. Existing staff get no elevated rights.
ALTER TABLE staff_access ADD COLUMN can_correct INTEGER NOT NULL DEFAULT 0 CHECK (can_correct IN (0, 1));
