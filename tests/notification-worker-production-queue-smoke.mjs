import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const worker = read("src/lib/notificationWorker.ts");
const notifications = read("src/lib/notifications.ts");

assert.match(
  worker,
  /const regularQueues = remaining > 0[\s\S]*?where:\s*\{\s*AND:\s*\[[\s\S]*?queueFilter[\s\S]*?OR:/,
  "Die reguläre Queue-Abfrage muss den Produktionsfilter und den Empfängerfilter gemeinsam anwenden.",
);
assert.match(
  notifications,
  /select:\s*\{\s*email:\s*true,\s*role:\s*true,\s*tenantId:\s*true\s*\}/,
  "Kundenbenachrichtigungen müssen die Empfängeradresse aus dem Benutzer laden.",
);
assert.match(
  notifications,
  /recipientEmail:\s*user\?\.email/,
  "Neue Kunden-Queues müssen die Empfängeradresse dauerhaft speichern.",
);

console.log("Notification production queue smoke passed");
