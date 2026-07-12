-- Preserve the exact private object for every document version.
ALTER TABLE "DocumentVersion"
ADD COLUMN "storageKey" TEXT;

-- Existing current versions can be mapped safely to the document's current object.
-- Older historical rows remain NULL because their original object was not tracked.
UPDATE "DocumentVersion" AS version
SET "storageKey" = document."storedFilename"
FROM "Document" AS document
WHERE version."documentId" = document."id"
  AND version."version" = document."version";
