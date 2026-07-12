# DB-Autorisierte Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bestehende JWT-Cookie-Sessions durch eine widerrufbare, datenbankautorisierte Session-Prüfung ergänzen, damit Sperrungen und Rollenänderungen sofort für APIs wirksam werden.

**Architecture:** Das signierte JWT bleibt der transportierte Cookie, enthält aber nur die normalisierten Sessiondaten und eine zufällige `sessionId`. Eine neue `AuthSession`-Zeile ist die serverseitige Autorisierungsquelle; `getSession()` verifiziert Signatur, Ablauf, Sessionwiderruf und aktuellen Userstatus/Rolle aus Prisma. Die bestehende Middleware bleibt ein schneller Navigationsfilter und wird nicht zur alleinigen Sicherheitsgrenze.

**Tech Stack:** Next.js 16 App Router, TypeScript, `jose`, Prisma 7, PostgreSQL, Node-Smoke-Tests.

## Global Constraints

- Keine Änderung am PostgreSQL-Port; lokal bleibt `127.0.0.1:5432`.
- Keine Secrets im Repository.
- API-Autorisierung muss serverseitig erfolgen.
- Bestehende Rollen und Kunden-/Admin-Flows bleiben rückwärtskompatibel.
- Jede Schemaänderung erhält eine versionierte Prisma-Migration.

---

### Task 1: Failing Session-Revoke-Test

**Files:**
- Create: `tests/auth-session-smoke.mjs`
- Modify: `package.json`

- [ ] **Step 1: Test schreiben**

Der Smoke-Test meldet einen Demo-Kunden an, ruft `/api/auth/me` erfolgreich auf, widerruft dessen zuletzt erstellte Session direkt in der Testdatenbank und erwartet danach `401`. Anschließend setzt er den Benutzerstatus auf `DISABLED` und erwartet für eine neue Session ebenfalls `401`; in `finally` werden Status und Test-Sessions zurückgesetzt.

- [ ] **Step 2: Rot ausführen**

Run: `npm run test:auth-session`

Expected: Der Test schlägt fehl, weil das aktuelle JWT nach einem Datenbank-Widerruf weiterhin als gültig akzeptiert wird.

- [ ] **Step 3: Commit erst nach Green**

Der Test bleibt im selben Feature-Commit und wird nach der Auth-Implementierung erneut ausgeführt.

### Task 2: AuthSession-Modell und Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_auth_sessions/migration.sql`

- [ ] **Step 1: Modell ergänzen**

`AuthSession` erhält `id`, `userId`, `expiresAt`, `revokedAt`, `lastSeenAt`, `ipAddress`, `userAgent`, `createdAt`; `User.authSessions` wird als Cascade-Relation ergänzt. Indizes werden auf `userId/expiresAt` und `revokedAt/expiresAt` gesetzt.

- [ ] **Step 2: Migration erzeugen und prüfen**

Run: `npx prisma migrate dev --name auth_sessions`

Expected: Eine neue Migration legt Tabelle, Fremdschlüssel und Indizes an; `npx prisma validate` bleibt erfolgreich.

### Task 3: DB-autorisierte Auth-Service-Logik

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `src/app/api/auth/login/route.ts`

- [ ] **Step 1: Session beim Login persistieren**

`setSessionCookie()` erzeugt eine zufällige Session-ID, speichert sie mit Ablaufzeit und optionalem IP-/User-Agent-Kontext und signiert diese ID in das JWT.

- [ ] **Step 2: Session bei jedem API-Zugriff prüfen**

`getSession()` prüft JWT-Signatur und Ablauf, lädt die `AuthSession`-Zeile, lehnt widerrufene/abgelaufene Sessions ab und lädt den aktuellen User mit `role`, `status`, `email` und `warehouseId`. Nur `ACTIVE`-Benutzer erhalten eine Session; die Rolle aus der Datenbank überschreibt alte JWT-Rollen.

- [ ] **Step 3: Logout widerrufen**

`clearSessionCookie()` beziehungsweise der Logout-Route widerruft die aktuelle DB-Session vor dem Löschen des Cookies. Wiederholter Logout bleibt idempotent.

### Task 4: Tests und Dokumentation

**Files:**
- Modify: `tests/auth-session-smoke.mjs`
- Modify: `package.json`
- Modify: `TECHNICAL_DUE_DILIGENCE_AUDIT_2026-07-12.md`
- Create: `AUTH_SESSION_OPERATIONS.md`

- [ ] **Step 1: Green testen**

Run: `npm run test:auth-session`, `npm run test:auth-ux`, `npm run lint`, `npm run build`.

- [ ] **Step 2: Betriebsdoku ergänzen**

Dokumentieren: Sessionablauf, sofortige Sperrwirkung, Logout-Widerruf, Datenminimierung der IP/User-Agent-Felder und offene Punkte wie Geräteverwaltung/MFA.

### Task 5: Commit und Push

- [ ] **Step 1: Diff und Status prüfen**

Run: `git diff --check`, `git status --short`.

- [ ] **Step 2: Committen und pushen**

Run: `git add ...`, `git commit -m "Add database-authorized sessions"`, `git push origin main`.

- [ ] **Step 3: Remote verifizieren**

Run: `git ls-remote origin refs/heads/main` und den Commit-SHA mit `git rev-parse HEAD` vergleichen. GitHub-CI darf erst nach gestarteten Runs als extern bestätigt gelten.
