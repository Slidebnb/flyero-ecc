UPDATE "Warehouse"
SET "isDemoData" = true
WHERE "id" ILIKE 'demo-%'
   OR COALESCE("notes", '') ILIKE '%demo%'
   OR COALESCE("notes", '') ILIKE '%seed%';
