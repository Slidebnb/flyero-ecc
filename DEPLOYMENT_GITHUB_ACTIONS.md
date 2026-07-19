# Automatischer Produktions-Deploy

Der Produktions-Deploy laeuft ueber `.github/workflows/deploy-production.yml`.
Er startet erst, wenn der GitHub-Workflow `CI` fuer `main` erfolgreich war.
Der Server uebernimmt genau den getesteten Commit.

## Einmalige Servereinrichtung

Die folgenden Befehle werden einmal als `root` auf Hetzner ausgefuehrt. Der
private Schluessel bleibt auf dem eigenen Rechner und wird niemals in Git
gespeichert.

```bash
install -d -m 700 -o flyero -g flyero /home/flyero/.ssh
```

Den Inhalt des oeffentlichen Schluessels aus PowerShell kopieren und als
`DEPLOY_PUBLIC_KEY` in der Server-Shell setzen:

```bash
DEPLOY_PUBLIC_KEY='ssh-ed25519 AAAA... github-actions-flyero-production'
grep -qxF "$DEPLOY_PUBLIC_KEY" /home/flyero/.ssh/authorized_keys 2>/dev/null || printf '%s\n' "$DEPLOY_PUBLIC_KEY" >> /home/flyero/.ssh/authorized_keys
chown flyero:flyero /home/flyero/.ssh/authorized_keys
chmod 600 /home/flyero/.ssh/authorized_keys

usermod -aG docker flyero
chown -R flyero:flyero /opt/flyero
chmod 600 /opt/flyero/.env.production
sudo -u flyero git config --global --add safe.directory /opt/flyero
```

Die Gruppe `docker` erlaubt dem Deploy-Benutzer den kontrollierten Neustart
der Produktionscontainer. Das ist eine weitreichende Serverberechtigung; der
SSH-Schluessel darf deshalb nur in GitHub Actions verwendet werden.

## Deploy-Schluessel unter Windows erzeugen

In PowerShell auf dem eigenen Rechner:

```powershell
$key = "$env:USERPROFILE\.ssh\flyero-github-deploy"
ssh-keygen -t ed25519 -f $key -C "github-actions-flyero-production"
Get-Content "$key.pub"
```

Den ausgegebenen oeffentlichen Schluessel einmalig in
`/home/flyero/.ssh/authorized_keys` eintragen. Der private Schluessel liegt
unter:

```text
C:\Users\<Benutzer>\.ssh\flyero-github-deploy
```

Den Server-Hostschluessel nach vorheriger Fingerabdruckpruefung erzeugen:

```powershell
ssh-keyscan -t ed25519 167.235.238.254 | Out-File -Encoding ascii "$env:TEMP\flyero-known-hosts"
Get-Content "$env:TEMP\flyero-known-hosts"
```

Der angezeigte Schluessel muss mit dem bereits beim normalen SSH-Zugang
bestaetigten Hetzner-Fingerabdruck uebereinstimmen.

## GitHub-Secrets

Im Repository unter `Settings -> Environments -> production` das Environment
`production` anlegen und dort folgende Secrets hinterlegen:

```text
FLYERO_DEPLOY_HOST=167.235.238.254
FLYERO_DEPLOY_USER=flyero
FLYERO_DEPLOY_SSH_KEY=<vollstaendiger privater Schluessel>
FLYERO_DEPLOY_KNOWN_HOSTS=<vollstaendiger Inhalt von flyero-known-hosts>
```

Der private Schluessel darf nicht als normaler Repository-Wert, Issue-Text,
Workflow-Ausgabe oder Chatnachricht gespeichert werden. Optional kann fuer das
Environment `production` eine manuelle Freigabe aktiviert werden.

## Ablauf bei jedem Push

```text
Push nach main
 -> CI: Prisma, Lint, Build und Smoke-Tests
 -> Deploy-Workflow wartet auf CI-Erfolg
 -> SSH-Host wird mit festem known_hosts geprueft
 -> Server prueft den getesteten Commit
 -> Produktionsimage wird mit .env.production gebaut
 -> Preflight und Prisma-Migration laufen
 -> App wird kontrolliert ersetzt
 -> Container-Healthcheck und https://flyero.org/api/health werden geprueft
```

Ein CI-Fehler deployt nichts. Ein SSH-, Build-, Migrations- oder Healthcheck-
Fehler macht den Deploy rot und muss in GitHub Actions untersucht werden.
Lokale Serveraenderungen werden nicht ueberschrieben, weil der Server nur
`git pull --ff-only origin main` verwendet.

## Manueller Start

Der Workflow kann in GitHub unter `Actions -> Deploy production -> Run workflow`
manuell fuer `main` gestartet werden. Auch dabei werden Preflight, Migration
und Healthcheck ausgefuehrt.

## Rollback

Ein Rollback wird bewusst nicht automatisch ausgefuehrt. Bei einem fehlerhaften
Release zuerst Logs, Datenbankmigration und Backupstatus pruefen. Danach kann
ein vorheriger Commit gezielt auf einen vorbereiteten Rollback-Branch gebracht
und nach bestandener CI nach `main` gemergt werden.
