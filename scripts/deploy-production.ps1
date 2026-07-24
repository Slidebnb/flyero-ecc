param(
    [string]$DeployHost = "167.235.238.254",
    [string]$DeployUser = "flyero",
    [string]$IdentityFile = (Join-Path $HOME ".ssh\flyero-github-deploy"),
    [string]$KnownHostsFile = (Join-Path $HOME ".ssh\known_hosts"),
    [string]$ExpectedSha = ""
)

$ErrorActionPreference = "Stop"

if (!(Test-Path -LiteralPath $IdentityFile)) {
    throw "SSH-Schluessel nicht gefunden: $IdentityFile"
}

if (!(Test-Path -LiteralPath $KnownHostsFile)) {
    throw "SSH-known_hosts nicht gefunden: $KnownHostsFile"
}

if ($ExpectedSha -and $ExpectedSha -notmatch "^[0-9a-f]{7,40}$") {
    throw "ExpectedSha muss eine kurze oder vollstaendige lowercase Git-SHA sein."
}

$remoteScript = @'
set -Eeuo pipefail

cd /opt/flyero
git config --global --add safe.directory /opt/flyero
git fetch --prune origin main
git switch main
git pull --ff-only origin main

deployed_sha="$(git rev-parse HEAD)"
expected_sha="__EXPECTED_SHA__"
if [ -n "$expected_sha" ]; then
  expected_commit="$(git rev-parse --verify "${expected_sha}^{commit}")"
  if [ "$deployed_sha" != "$expected_commit" ]; then
    echo "Der Server steht nicht auf dem erwarteten main-Commit." >&2
    echo "Erwartet: $expected_sha" >&2
    echo "Gefunden: $deployed_sha" >&2
    exit 1
  fi
fi

compose=(docker compose --env-file /opt/flyero/.env.production -f /opt/flyero/docker-compose.production.yml)
"${compose[@]}" build --build-arg "DEPLOY_SHA=$deployed_sha" app
"${compose[@]}" run --rm --no-deps app node scripts/production-preflight.mjs
"${compose[@]}" run --rm --no-deps app npx prisma migrate deploy
# App und Reverse-Proxy gemeinsam recreaten: Das Caddyfile liegt als Bind-Mount
# vor und wird sonst trotz neuer Version im Repository nicht live geladen.
"${compose[@]}" up -d --force-recreate --no-deps app caddy

for attempt in $(seq 1 30); do
  if "${compose[@]}" exec -T app node -e "fetch('http://127.0.0.1:3000/api/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"; then
    break
  fi
  if [ "$attempt" -eq 30 ]; then
    "${compose[@]}" logs --tail=120 app >&2 || true
    exit 1
  fi
  sleep 2
done

"${compose[@]}" ps
curl --fail --silent --show-error https://flyero.org/api/health
echo
echo "Production deployed: $deployed_sha"
'@

$remoteScript = $remoteScript.Replace("__EXPECTED_SHA__", $ExpectedSha)

$sshArgs = @(
    "-i", $IdentityFile,
    "-o", "IdentitiesOnly=yes",
    "-o", "StrictHostKeyChecking=yes",
    "-o", "UserKnownHostsFile=$KnownHostsFile",
    "-o", "ServerAliveInterval=30",
    "-o", "ServerAliveCountMax=4",
    "$DeployUser@$DeployHost",
    "bash -s"
)

$remoteScript | & ssh.exe @sshArgs
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
