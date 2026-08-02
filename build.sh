#!/usr/bin/env bash

set -Eeuo pipefail

readonly ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly MPSO_DIR="${ROOT_DIR}/MPSO"
readonly FRONTEND_DIR="${ROOT_DIR}/MPSO-Front-End"
readonly TAIHANG_DIR="${ROOT_DIR}/Taihang"
readonly TAIHANG_CORE_DIR="${TAIHANG_DIR}/taihang"
readonly TAIHANG_PROTOCOLS_DIR="${TAIHANG_DIR}/taihang-protocols"
readonly TAIHANG_ADAPTER_DIR="${TAIHANG_DIR}/adapter"
readonly TAIHANG_ADAPTER_BUILD_DIR="${TAIHANG_ADAPTER_DIR}/build"
readonly TAIHANG_PROTOCOLS_BUILD_DIR="${TAIHANG_PROTOCOLS_DIR}/build"
readonly TAIHANG_CORE_REVISION="547b053d431aeefed9e3630644e5601e54dd047a"
readonly TAIHANG_PROTOCOLS_REVISION="33f0d6d783c33511d5bc6b83c5261adc0fab730c"
readonly TAIHANG_DEPS_DIR="${TAIHANG_DIR}/.deps"
readonly TAIHANG_LOCAL_DIR="${TAIHANG_DIR}/.local"
readonly OPENSSL_SOURCE_DIR="${TAIHANG_DEPS_DIR}/src/openssl-3.0.2"
readonly OPENSSL_INSTALL_DIR="${TAIHANG_LOCAL_DIR}/openssl-taihang"
readonly XXHASH_SOURCE_DIR="${TAIHANG_DEPS_DIR}/src/xxHash"
readonly XXHASH_INSTALL_DIR="${TAIHANG_LOCAL_DIR}/xxhash"
readonly XXHASH_REVISION="e573d4d2aaeaba0f3e5a0a9a54144a1f2b4b56e7"
readonly XXHASH_STAMP_VALUE="${XXHASH_REVISION}-static"
readonly VOLEPSI_DIR="${MPSO_DIR}/volepsi"
readonly VOLEPSI_INSTALL_DIR="${MPSO_DIR}/libvolepsi"
readonly VOLEPSI_REVISION="ec76012ed516e25d3f460af9b8680e1140a5d491"
readonly ENV_FILE="${FRONTEND_DIR}/.env.local"
readonly VERIFY_SCRIPT="${ROOT_DIR}/verify-platform.sh"

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
builds MPSO, Taihang PSO, and Next.js, verifies both back-end paths, and keeps the
production service running in the foreground.

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
[[ -d "$TAIHANG_ADAPTER_DIR" ]] || die "Taihang adapter source was not found: ${TAIHANG_ADAPTER_DIR}"
[[ -f "$VERIFY_SCRIPT" ]] || die "Platform verification script was not found: ${VERIFY_SCRIPT}"

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
"${SUDO[@]}" env DEBIAN_FRONTEND=noninteractive apt-get install -y software-properties-common
if ! apt-cache show gcc-13 >/dev/null 2>&1; then
  log "Enabling the Ubuntu toolchain repository for GCC 13"
  "${SUDO[@]}" add-apt-repository -y ppa:ubuntu-toolchain-r/test
  "${SUDO[@]}" apt-get update
fi
"${SUDO[@]}" env DEBIAN_FRONTEND=noninteractive apt-get install -y \
  build-essential gcc-11 g++-11 gcc-13 g++-13 git make cmake ninja-build python3 \
  libssl-dev libomp-dev libtool libgtest-dev pkg-config ca-certificates curl gnupg \
  openssl perl gzip tar hostname postgresql postgresql-client iproute2 procps util-linux \
  software-properties-common

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
upsert_env_value TAIHANG_PSO_ADAPTER "${TAIHANG_ADAPTER_BUILD_DIR}/taihang_pso_adapter"
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

clone_pinned_repository() {
  local repository="$1"
  local directory="$2"
  local revision="$3"
  if [[ ! -d "${directory}/.git" ]]; then
    [[ ! -e "$directory" ]] || die "${directory} exists but is not a Git repository"
    git clone "$repository" "$directory"
  fi
  if ! git -C "$directory" cat-file -e "${revision}^{commit}" 2>/dev/null; then
    git -C "$directory" fetch origin "$revision"
  fi
  git -C "$directory" checkout --detach "$revision"
}

log "Preparing the pinned Taihang repositories"
mkdir -p "${TAIHANG_DEPS_DIR}/src" "${TAIHANG_LOCAL_DIR}"
clone_pinned_repository \
  https://github.com/RWC-Lab/taihang.git \
  "$TAIHANG_CORE_DIR" \
  "$TAIHANG_CORE_REVISION"
clone_pinned_repository \
  https://github.com/RWC-Lab/taihang-protocols.git \
  "$TAIHANG_PROTOCOLS_DIR" \
  "$TAIHANG_PROTOCOLS_REVISION"

OPENSSL_STAMP="${OPENSSL_INSTALL_DIR}/.taihang-openssl-revision"
if [[ ! -f "$OPENSSL_STAMP" ]] ||
   [[ "$(<"$OPENSSL_STAMP")" != "3.0.2-x25519-export" ]] ||
   [[ ! -f "${OPENSSL_INSTALL_DIR}/lib/libcrypto.a" ]] ||
   [[ ! -f "${OPENSSL_INSTALL_DIR}/include/openssl/opensslv.h" ]]; then
  log "Building the patched OpenSSL 3.0.2 dependency"
  OPENSSL_ARCHIVE="${TAIHANG_DEPS_DIR}/src/openssl-3.0.2.tar.gz"
  if [[ ! -f "$OPENSSL_ARCHIVE" ]]; then
    curl -fsSL https://www.openssl.org/source/openssl-3.0.2.tar.gz -o "$OPENSSL_ARCHIVE"
  fi
  if [[ ! -f "${OPENSSL_SOURCE_DIR}/Configure" ]]; then
    tar -xzf "$OPENSSL_ARCHIVE" -C "${TAIHANG_DEPS_DIR}/src"
  fi
  sed -i 's/^static void x25519_scalar_mulx/void x25519_scalar_mulx/' \
    "${OPENSSL_SOURCE_DIR}/crypto/ec/curve25519.c"
  (
    cd "$OPENSSL_SOURCE_DIR"
    make clean >/dev/null 2>&1 || true
    CC=gcc-13 ./Configure --prefix="$OPENSSL_INSTALL_DIR" no-shared no-tests
    make -j"$BUILD_JOBS"
    make install_sw
  )
  printf '%s\n' '3.0.2-x25519-export' >"$OPENSSL_STAMP"
else
  log "Reusing the patched OpenSSL 3.0.2 dependency"
fi

XXHASH_STAMP="${XXHASH_INSTALL_DIR}/.taihang-xxhash-revision"
if [[ ! -f "$XXHASH_STAMP" ]] ||
   [[ "$(<"$XXHASH_STAMP")" != "$XXHASH_STAMP_VALUE" ]] ||
   [[ ! -f "${XXHASH_INSTALL_DIR}/lib/libxxhash.a" ]] ||
   [[ ! -f "${XXHASH_INSTALL_DIR}/lib/cmake/xxHash/xxHashConfig.cmake" ]]; then
  log "Building the pinned xxHash dependency"
  clone_pinned_repository \
    https://github.com/Cyan4973/xxHash.git \
    "$XXHASH_SOURCE_DIR" \
    "$XXHASH_REVISION"
  rm -rf -- "${TAIHANG_DEPS_DIR}/build/xxHash"
  cmake -S "${XXHASH_SOURCE_DIR}/build/cmake" \
    -B "${TAIHANG_DEPS_DIR}/build/xxHash" \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_C_COMPILER=gcc-13 \
    -DCMAKE_INSTALL_PREFIX="$XXHASH_INSTALL_DIR" \
    -DBUILD_SHARED_LIBS=OFF \
    -DXXHASH_BUILD_XXHSUM=OFF
  cmake --build "${TAIHANG_DEPS_DIR}/build/xxHash" --parallel "$BUILD_JOBS"
  cmake --install "${TAIHANG_DEPS_DIR}/build/xxHash"
  printf '%s\n' "$XXHASH_STAMP_VALUE" >"$XXHASH_STAMP"
else
  log "Reusing the pinned xxHash dependency"
fi

log "Building the Taihang PSO protocol in the default build mode"
rm -rf -- "$TAIHANG_PROTOCOLS_BUILD_DIR"
cmake -S "$TAIHANG_PROTOCOLS_DIR" -B "$TAIHANG_PROTOCOLS_BUILD_DIR" \
  -DCMAKE_C_COMPILER=gcc-13 \
  -DCMAKE_CXX_COMPILER=g++-13 \
  -DTAIHANG_BUILD_TESTS=OFF \
  -DTAIHANG_BUILD_BENCHMARKS=OFF \
  -DOPENSSL_ROOT_DIR="$OPENSSL_INSTALL_DIR" \
  -DxxHash_DIR="${XXHASH_INSTALL_DIR}/lib/cmake/xxHash"
cmake --build "$TAIHANG_PROTOCOLS_BUILD_DIR" --target taihang_protocols --parallel "$BUILD_JOBS"

log "Building the Taihang PSO adapter"
cmake -S "$TAIHANG_ADAPTER_DIR" -B "$TAIHANG_ADAPTER_BUILD_DIR" \
  -DCMAKE_CXX_COMPILER=g++-13 \
  -DTAIHANG_PROTOCOLS_BUILD_DIR="$TAIHANG_PROTOCOLS_BUILD_DIR" \
  -DOPENSSL_ROOT_DIR="$OPENSSL_INSTALL_DIR" \
  -DxxHash_DIR="${XXHASH_INSTALL_DIR}/lib/cmake/xxHash"
cmake --build "$TAIHANG_ADAPTER_BUILD_DIR" --parallel "$BUILD_JOBS"
[[ -x "${TAIHANG_ADAPTER_BUILD_DIR}/taihang_pso_adapter" ]] || die "Missing Taihang PSO adapter"

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

log "Running full platform verification"
BASE_URL="http://127.0.0.1:${PORT}" \
  REQUEST_TIMEOUT_SECONDS=1800 \
  bash "$VERIFY_SCRIPT"

LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
log "Deployment completed"
printf 'Local URL: http://127.0.0.1:%s\n' "$PORT"
if [[ -n "$LAN_IP" ]]; then
  printf 'LAN URL: http://%s:%s\n' "$LAN_IP" "$PORT"
fi
printf 'The service is running in the foreground. Press Ctrl+C to stop it.\n\n'

wait "$APP_PID"
