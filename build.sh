#!/usr/bin/env bash

set -Eeuo pipefail

readonly ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly MPSO_DIR="${ROOT_DIR}/MPSO"
readonly FRONTEND_DIR="${ROOT_DIR}/MPSO-Front-End"
readonly VOLEPSI_DIR="${MPSO_DIR}/volepsi"
readonly VOLEPSI_INSTALL_DIR="${MPSO_DIR}/libvolepsi"
readonly VOLEPSI_REVISION="ec76012ed516e25d3f460af9b8680e1140a5d491"
readonly ENV_FILE="${FRONTEND_DIR}/.env.local"

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-4173}"
MPSO_DB_USER="${MPSO_DB_USER:-mpso}"
MPSO_DB_NAME="${MPSO_DB_NAME:-mpso}"
MPSO_DB_HOST="${MPSO_DB_HOST:-127.0.0.1}"
MPSO_DB_PORT="${MPSO_DB_PORT:-5432}"

APP_PID=""
TEMP_FILES=()

log() {
  printf '\n\033[1;32m==> %s\033[0m\n' "$*"
}

warn() {
  printf '\n\033[1;33mWarning: %s\033[0m\n' "$*" >&2
}

die() {
  printf '\n\033[1;31mError: %s\033[0m\n' "$*" >&2
  exit 1
}

on_error() {
  local exit_code=$?
  printf '\n\033[1;31mDeployment failed at line %s (exit code %s).\033[0m\n' "${BASH_LINENO[0]:-unknown}" "$exit_code" >&2
  exit "$exit_code"
}

cleanup() {
  local file
  for file in "${TEMP_FILES[@]}"; do
    [[ -e "$file" ]] && rm -f -- "$file"
  done

  if [[ -n "$APP_PID" ]] && kill -0 "$APP_PID" 2>/dev/null; then
    kill "$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
  fi
}

on_signal() {
  trap - ERR
  exit 0
}

trap on_error ERR
trap cleanup EXIT
trap on_signal INT TERM

usage() {
  cat <<'EOF'
Usage: ./build.sh

On the first run, this script installs system dependencies, configures PostgreSQL,
builds MPSO and Next.js, runs a real back-end smoke test, and keeps the production
service running in the foreground.

Optional environment variables:
  HOST              Listen address. Default: 0.0.0.0
  PORT              Listen port. Default: 4173
  BUILD_JOBS        Parallel build jobs. Default: min(CPU threads, 8)
  MPSO_DB_USER      PostgreSQL user. Default: mpso
  MPSO_DB_NAME      PostgreSQL database. Default: mpso
  MPSO_DB_HOST      PostgreSQL host. Default: 127.0.0.1
  MPSO_DB_PORT      PostgreSQL port. Default: 5432

The service remains attached to this terminal. Press Ctrl+C to stop it.
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi
[[ $# -eq 0 ]] || die "Unsupported arguments: $* (use --help for usage)"

[[ -d "$MPSO_DIR" ]] || die "Directory not found: ${MPSO_DIR}"
[[ -f "${MPSO_DIR}/CMakeLists.txt" ]] || die "MPSO/CMakeLists.txt was not found"
[[ -f "${FRONTEND_DIR}/package-lock.json" ]] || die "The front-end package-lock.json was not found"

if [[ ! "$PORT" =~ ^[0-9]+$ ]] || (( PORT < 1 || PORT > 65535 )); then
  die "PORT must be an integer between 1 and 65535"
fi
if [[ ! "$MPSO_DB_PORT" =~ ^[0-9]+$ ]] || (( MPSO_DB_PORT < 1 || MPSO_DB_PORT > 65535 )); then
  die "MPSO_DB_PORT must be an integer between 1 and 65535"
fi
if [[ ! "$MPSO_DB_USER" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
  die "MPSO_DB_USER may contain only letters, digits, and underscores and may not start with a digit"
fi
if [[ ! "$MPSO_DB_NAME" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
  die "MPSO_DB_NAME may contain only letters, digits, and underscores and may not start with a digit"
fi
if [[ "$MPSO_DB_HOST" != "127.0.0.1" && "$MPSO_DB_HOST" != "localhost" ]]; then
  die "This script configures only a local PostgreSQL instance; MPSO_DB_HOST must be 127.0.0.1 or localhost"
fi

CPU_COUNT="$(getconf _NPROCESSORS_ONLN 2>/dev/null || nproc)"
DEFAULT_BUILD_JOBS="$CPU_COUNT"
(( DEFAULT_BUILD_JOBS > 8 )) && DEFAULT_BUILD_JOBS=8
BUILD_JOBS="${BUILD_JOBS:-$DEFAULT_BUILD_JOBS}"
if [[ ! "$BUILD_JOBS" =~ ^[0-9]+$ ]] || (( BUILD_JOBS < 1 )); then
  die "BUILD_JOBS must be a positive integer"
fi

if [[ "$(uname -m)" != "x86_64" ]]; then
  die "Only x86_64 is supported; the current architecture is $(uname -m)"
fi
[[ -r /etc/os-release ]] || die "Unable to identify the operating system"
# shellcheck disable=SC1091
source /etc/os-release
if [[ "${ID:-}" != "ubuntu" || "${VERSION_ID:-}" != "22.04" ]]; then
  die "Only Ubuntu 22.04 is supported; the current system is ${PRETTY_NAME:-unknown}"
fi

if (( EUID == 0 )); then
  SUDO=()
  POSTGRES_COMMAND=(runuser -u postgres --)
else
  command -v sudo >/dev/null 2>&1 || die "sudo is required to install dependencies and configure PostgreSQL"
  sudo -v
  SUDO=(sudo)
  POSTGRES_COMMAND=(sudo -u postgres)
fi

log "Installing Ubuntu system dependencies"
if ! "${SUDO[@]}" apt-get update; then
  die "Unable to update Ubuntu package sources; check the network connection and repository configuration"
fi
"${SUDO[@]}" env DEBIAN_FRONTEND=noninteractive apt-get install -y \
  build-essential gcc-11 g++-11 git make cmake python3 \
  libssl-dev libomp-dev libtool pkg-config ca-certificates curl gnupg openssl \
  postgresql postgresql-client iproute2

node_is_supported() {
  command -v node >/dev/null 2>&1 || return 1
  node -e '
    const [major, minor] = process.versions.node.split(".").map(Number)
    process.exit(major > 20 || (major === 20 && minor >= 9) ? 0 : 1)
  '
}

if ! node_is_supported; then
  log "Installing Node.js 20"
  NODE_SETUP="$(mktemp)"
  TEMP_FILES+=("$NODE_SETUP")
  curl -fsSL https://deb.nodesource.com/setup_20.x -o "$NODE_SETUP"
  if (( EUID == 0 )); then
    bash "$NODE_SETUP"
  else
    sudo -E bash "$NODE_SETUP"
  fi
  "${SUDO[@]}" env DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
fi
node_is_supported || die "The Node.js version does not meet the Next.js requirement (>= 20.9)"
command -v npm >/dev/null 2>&1 || die "npm was not found"

log "Starting and initializing PostgreSQL"
if [[ -d /run/systemd/system ]]; then
  "${SUDO[@]}" systemctl enable --now postgresql
else
  CLUSTER_DETAILS="$(pg_lsclusters --no-header | awk 'NR == 1 {print $1, $2, $4}')"
  read -r CLUSTER_VERSION CLUSTER_NAME CLUSTER_STATUS <<<"$CLUSTER_DETAILS"
  [[ -n "${CLUSTER_VERSION:-}" && -n "${CLUSTER_NAME:-}" ]] || \
    die "No local PostgreSQL cluster was found"
  if [[ "$CLUSTER_STATUS" != "online" ]]; then
    "${SUDO[@]}" pg_ctlcluster "$CLUSTER_VERSION" "$CLUSTER_NAME" start
  fi
fi

read_env_value() {
  local key="$1"
  [[ -f "$ENV_FILE" ]] || return 0
  sed -n "s/^${key}=//p" "$ENV_FILE" | tail -n 1
}

DATABASE_URL="$(read_env_value DATABASE_URL)"
DB_PASSWORD=""
if [[ -n "$DATABASE_URL" ]]; then
  mapfile -t DATABASE_PARTS < <(
    DATABASE_URL="$DATABASE_URL" node <<'NODE'
const url = new URL(process.env.DATABASE_URL)
console.log(decodeURIComponent(url.username))
console.log(decodeURIComponent(url.password))
console.log(url.hostname)
console.log(url.port || '5432')
console.log(url.pathname.replace(/^\//, ''))
NODE
  )
  [[ ${#DATABASE_PARTS[@]} -eq 5 ]] || die "Unable to parse the existing DATABASE_URL"
  MPSO_DB_USER="${DATABASE_PARTS[0]}"
  DB_PASSWORD="${DATABASE_PARTS[1]}"
  MPSO_DB_HOST="${DATABASE_PARTS[2]}"
  MPSO_DB_PORT="${DATABASE_PARTS[3]}"
  MPSO_DB_NAME="${DATABASE_PARTS[4]}"
  [[ -n "$DB_PASSWORD" ]] || die "The existing DATABASE_URL does not contain a database password"
  if [[ "$MPSO_DB_HOST" != "127.0.0.1" && "$MPSO_DB_HOST" != "localhost" ]]; then
    die "The existing DATABASE_URL does not point to local PostgreSQL"
  fi
else
  DB_PASSWORD="$(openssl rand -hex 24)"
  DATABASE_URL="postgresql://${MPSO_DB_USER}:${DB_PASSWORD}@${MPSO_DB_HOST}:${MPSO_DB_PORT}/${MPSO_DB_NAME}"
fi

"${POSTGRES_COMMAND[@]}" psql -v ON_ERROR_STOP=1 \
  --set=role_name="$MPSO_DB_USER" \
  --set=role_password="$DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'role_name', :'role_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'role_name') \gexec
SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'role_name', :'role_password') \gexec
SQL

"${POSTGRES_COMMAND[@]}" psql -v ON_ERROR_STOP=1 \
  --set=database_name="$MPSO_DB_NAME" \
  --set=role_name="$MPSO_DB_USER" <<'SQL'
SELECT format('CREATE DATABASE %I OWNER %I', :'database_name', :'role_name')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'database_name') \gexec
SELECT format('ALTER DATABASE %I OWNER TO %I', :'database_name', :'role_name') \gexec
SQL

upsert_env_value() {
  local key="$1"
  local value="$2"
  local temporary
  temporary="$(mktemp)"
  TEMP_FILES+=("$temporary")
  if [[ -f "$ENV_FILE" ]]; then
    grep -v "^${key}=" "$ENV_FILE" >"$temporary" || true
  fi
  printf '%s=%s\n' "$key" "$value" >>"$temporary"
  mv -- "$temporary" "$ENV_FILE"
}

touch "$ENV_FILE"
chmod 600 "$ENV_FILE"
upsert_env_value DATABASE_URL "$DATABASE_URL"
upsert_env_value MPSO_BUILD_DIR "${MPSO_DIR}/build"
upsert_env_value MPSO_JOB_TIMEOUT_MS "1800000"
upsert_env_value MPSO_TEST_MEMORY_GIB "64"
chmod 600 "$ENV_FILE"

log "Preparing the pinned Vole-PSI revision"
if [[ ! -d "${VOLEPSI_DIR}/.git" ]]; then
  [[ ! -e "$VOLEPSI_DIR" ]] || die "${VOLEPSI_DIR} exists but is not a Git repository; move it away and retry"
  git clone https://github.com/Visa-Research/volepsi.git "$VOLEPSI_DIR"
fi

if ! git -C "$VOLEPSI_DIR" cat-file -e "${VOLEPSI_REVISION}^{commit}" 2>/dev/null; then
  git -C "$VOLEPSI_DIR" fetch origin "$VOLEPSI_REVISION"
fi
git -C "$VOLEPSI_DIR" checkout --detach "$VOLEPSI_REVISION"

VOLEPSI_STAMP="${VOLEPSI_INSTALL_DIR}/.mpso-volepsi-revision"
if [[ ! -f "$VOLEPSI_STAMP" ]] || \
   [[ "$(<"$VOLEPSI_STAMP")" != "$VOLEPSI_REVISION" ]] || \
   [[ ! -f "${VOLEPSI_INSTALL_DIR}/lib/cmake/volePSI/volePSIConfig.cmake" ]] || \
   [[ ! -f "${VOLEPSI_INSTALL_DIR}/include/volePSI/config.h" ]]; then
  log "Building and installing Vole-PSI (the first run can take a while)"
  rm -rf -- "$VOLEPSI_INSTALL_DIR"
  (
    cd "$VOLEPSI_DIR"
    CC=gcc-11 CXX=g++-11 python3 build.py \
      --install="$VOLEPSI_INSTALL_DIR" \
      --par="$BUILD_JOBS" \
      -DVOLE_PSI_ENABLE_BOOST=ON \
      -DVOLE_PSI_ENABLE_GMW=ON \
      -DVOLE_PSI_ENABLE_CPSI=OFF \
      -DVOLE_PSI_ENABLE_OPPRF=OFF
  )
  [[ -f "${VOLEPSI_DIR}/out/build/linux/volePSI/config.h" ]] || die "Vole-PSI did not generate config.h"
  mkdir -p "${VOLEPSI_INSTALL_DIR}/include/volePSI"
  cp -- "${VOLEPSI_DIR}/out/build/linux/volePSI/config.h" "${VOLEPSI_INSTALL_DIR}/include/volePSI/config.h"
  [[ -f "${VOLEPSI_INSTALL_DIR}/lib/cmake/volePSI/volePSIConfig.cmake" ]] || die "The Vole-PSI installation is incomplete"
  printf '%s\n' "$VOLEPSI_REVISION" >"$VOLEPSI_STAMP"
else
  log "Reusing the installed Vole-PSI revision ${VOLEPSI_REVISION}"
fi

log "Building the MPSO back end in Release mode"
cmake -S "$MPSO_DIR" -B "${MPSO_DIR}/build" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_C_COMPILER=gcc-11 \
  -DCMAKE_CXX_COMPILER=g++-11 \
  -DvolePSI_DIR="${VOLEPSI_INSTALL_DIR}/lib/cmake/volePSI"
cmake --build "${MPSO_DIR}/build" --parallel "$BUILD_JOBS"
mkdir -p "${MPSO_DIR}/build/offline"

for executable in test_mpsi test_mpsic test_mpsics test_mpsu; do
  [[ -x "${MPSO_DIR}/build/${executable}" ]] || die "Missing back-end executable: ${executable}"
done

log "Installing front-end dependencies and creating the production build"
(
  cd "$FRONTEND_DIR"
  npm ci
  npm run build
)

if ss -H -ltn "sport = :${PORT}" 2>/dev/null | grep -q .; then
  die "Port ${PORT} is already in use; stop the existing service or select another port with PORT"
fi

log "Starting the MPSO platform on ${HOST}:${PORT}"
(
  cd "$FRONTEND_DIR"
  exec npm run start -- --hostname "$HOST" --port "$PORT"
) &
APP_PID=$!

HEALTH_URL="http://127.0.0.1:${PORT}/api/health"
for _ in $(seq 1 60); do
  kill -0 "$APP_PID" 2>/dev/null || die "The front-end service exited before the health check completed"
  if HEALTH_RESPONSE="$(curl -fsS "$HEALTH_URL" 2>/dev/null)"; then
    if HEALTH_RESPONSE="$HEALTH_RESPONSE" node -e '
      const response = JSON.parse(process.env.HEALTH_RESPONSE)
      process.exit(response.status === "ok" ? 0 : 1)
    '; then
      break
    fi
  fi
  sleep 1
done
[[ -n "${HEALTH_RESPONSE:-}" ]] || die "The front-end health check timed out"
HEALTH_RESPONSE="$HEALTH_RESPONSE" node -e '
  const response = JSON.parse(process.env.HEALTH_RESPONSE)
  if (response.status !== "ok") process.exit(1)
' || die "The back-end health check failed"

log "Running a real three-party MPSI smoke test with a 2^12 data set"
BASE_URL="http://127.0.0.1:${PORT}" node <<'NODE'
const baseUrl = process.env.BASE_URL
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const createResponse = await fetch(`${baseUrl}/api/runs`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    protocol: '\u9690\u79c1\u96c6\u5408\u6c42\u4ea4\u96c6',
    parties: 3,
    dataset: '12',
    threads: 4,
  }),
})
const created = await createResponse.json()
if (!createResponse.ok || !created.id) {
  throw new Error(`Unable to create the smoke test: ${JSON.stringify(created)}`)
}

for (let attempt = 0; attempt < 600; attempt += 1) {
  const statusResponse = await fetch(`${baseUrl}/api/runs/${created.id}`, { cache: 'no-store' })
  const run = await statusResponse.json()
  if (!statusResponse.ok) throw new Error(`Unable to read the smoke test: ${JSON.stringify(run)}`)
  if (run.status === 'failed') throw new Error(`Smoke test failed: ${run.error ?? 'unknown error'}`)
  if (run.status === 'completed') {
    const sample = run.samples?.[0]
    if (!sample?.resultValue?.verified) throw new Error('The smoke-test result did not match the expected value')
    if (!(sample.oursOnlineMs > 0)) throw new Error('The smoke test did not record online execution time')
    if (!(sample.oursCommMiB > 0)) throw new Error('The smoke test did not record online communication')
    if (!(sample.preparationMs > 0)) throw new Error('The smoke test did not record offline preparation time')
    console.log(`Smoke test passed: run ${run.id}`)
    console.log(`Online time: ${sample.oursOnlineMs.toFixed(3)} ms`)
    console.log(`Online communication: ${sample.oursCommMiB.toFixed(3)} MiB`)
    process.exit(0)
  }
  await sleep(500)
}

throw new Error('Timed out while waiting for the smoke test')
NODE

LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
log "Deployment completed"
printf 'Local URL: http://127.0.0.1:%s\n' "$PORT"
if [[ -n "$LAN_IP" ]]; then
  printf 'LAN URL: http://%s:%s\n' "$LAN_IP" "$PORT"
fi
printf 'The service is running in the foreground. Press Ctrl+C to stop it.\n\n'

wait "$APP_PID"
