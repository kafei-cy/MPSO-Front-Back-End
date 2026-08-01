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
  printf '\n\033[1;33m警告：%s\033[0m\n' "$*" >&2
}

die() {
  printf '\n\033[1;31m错误：%s\033[0m\n' "$*" >&2
  exit 1
}

on_error() {
  local exit_code=$?
  printf '\n\033[1;31m部署失败：第 %s 行执行出错（退出码 %s）。\033[0m\n' "${BASH_LINENO[0]:-未知}" "$exit_code" >&2
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
用法：./build.sh

首次执行将安装系统依赖、配置 PostgreSQL、编译 MPSO、构建 Next.js，
随后执行真实后端任务验证并以前台模式持续运行服务。

可选环境变量：
  HOST              监听地址，默认 0.0.0.0
  PORT              监听端口，默认 4173
  BUILD_JOBS        编译并行数，默认 min(CPU 线程数, 8)
  MPSO_DB_USER      PostgreSQL 用户，默认 mpso
  MPSO_DB_NAME      PostgreSQL 数据库，默认 mpso
  MPSO_DB_HOST      PostgreSQL 地址，默认 127.0.0.1
  MPSO_DB_PORT      PostgreSQL 端口，默认 5432

服务在当前终端运行；按 Ctrl+C 停止。
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi
[[ $# -eq 0 ]] || die "不支持的参数：$*（使用 --help 查看说明）"

[[ -d "$MPSO_DIR" ]] || die "找不到目录：${MPSO_DIR}"
[[ -f "${MPSO_DIR}/CMakeLists.txt" ]] || die "找不到 MPSO/CMakeLists.txt"
[[ -f "${FRONTEND_DIR}/package-lock.json" ]] || die "找不到前端 package-lock.json"

if [[ ! "$PORT" =~ ^[0-9]+$ ]] || (( PORT < 1 || PORT > 65535 )); then
  die "PORT 必须是 1 到 65535 之间的整数"
fi
if [[ ! "$MPSO_DB_PORT" =~ ^[0-9]+$ ]] || (( MPSO_DB_PORT < 1 || MPSO_DB_PORT > 65535 )); then
  die "MPSO_DB_PORT 必须是 1 到 65535 之间的整数"
fi
if [[ ! "$MPSO_DB_USER" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
  die "MPSO_DB_USER 只能包含字母、数字和下划线，且不能以数字开头"
fi
if [[ ! "$MPSO_DB_NAME" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
  die "MPSO_DB_NAME 只能包含字母、数字和下划线，且不能以数字开头"
fi
if [[ "$MPSO_DB_HOST" != "127.0.0.1" && "$MPSO_DB_HOST" != "localhost" ]]; then
  die "此脚本只负责配置本机 PostgreSQL；MPSO_DB_HOST 必须是 127.0.0.1 或 localhost"
fi

CPU_COUNT="$(getconf _NPROCESSORS_ONLN 2>/dev/null || nproc)"
DEFAULT_BUILD_JOBS="$CPU_COUNT"
(( DEFAULT_BUILD_JOBS > 8 )) && DEFAULT_BUILD_JOBS=8
BUILD_JOBS="${BUILD_JOBS:-$DEFAULT_BUILD_JOBS}"
if [[ ! "$BUILD_JOBS" =~ ^[0-9]+$ ]] || (( BUILD_JOBS < 1 )); then
  die "BUILD_JOBS 必须是正整数"
fi

if [[ "$(uname -m)" != "x86_64" ]]; then
  die "仅支持 x86_64，当前架构为 $(uname -m)"
fi
[[ -r /etc/os-release ]] || die "无法识别操作系统"
# shellcheck disable=SC1091
source /etc/os-release
if [[ "${ID:-}" != "ubuntu" || "${VERSION_ID:-}" != "22.04" ]]; then
  die "仅支持 Ubuntu 22.04，当前系统为 ${PRETTY_NAME:-未知}"
fi

if (( EUID == 0 )); then
  SUDO=()
  POSTGRES_COMMAND=(runuser -u postgres --)
else
  command -v sudo >/dev/null 2>&1 || die "需要 sudo 权限安装依赖并配置 PostgreSQL"
  sudo -v
  SUDO=(sudo)
  POSTGRES_COMMAND=(sudo -u postgres)
fi

log "安装 Ubuntu 系统依赖"
if ! "${SUDO[@]}" apt-get update; then
  die "无法更新 Ubuntu 软件源，请检查网络连接和软件源配置"
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
  log "安装 Node.js 20"
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
node_is_supported || die "Node.js 版本不满足 Next.js 要求（需要 >= 20.9）"
command -v npm >/dev/null 2>&1 || die "未找到 npm"

log "启动并初始化 PostgreSQL"
"${SUDO[@]}" systemctl enable --now postgresql

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
  [[ ${#DATABASE_PARTS[@]} -eq 5 ]] || die "无法解析现有 DATABASE_URL"
  MPSO_DB_USER="${DATABASE_PARTS[0]}"
  DB_PASSWORD="${DATABASE_PARTS[1]}"
  MPSO_DB_HOST="${DATABASE_PARTS[2]}"
  MPSO_DB_PORT="${DATABASE_PARTS[3]}"
  MPSO_DB_NAME="${DATABASE_PARTS[4]}"
  [[ -n "$DB_PASSWORD" ]] || die "现有 DATABASE_URL 未包含数据库密码"
  if [[ "$MPSO_DB_HOST" != "127.0.0.1" && "$MPSO_DB_HOST" != "localhost" ]]; then
    die "现有 DATABASE_URL 不是本机 PostgreSQL 地址"
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

log "准备固定版本的 Vole-PSI"
if [[ ! -d "${VOLEPSI_DIR}/.git" ]]; then
  [[ ! -e "$VOLEPSI_DIR" ]] || die "${VOLEPSI_DIR} 已存在但不是 Git 仓库，请移走后重试"
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
  log "编译并安装 Vole-PSI（首次执行耗时较长）"
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
  [[ -f "${VOLEPSI_DIR}/out/build/linux/volePSI/config.h" ]] || die "Vole-PSI 未生成 config.h"
  mkdir -p "${VOLEPSI_INSTALL_DIR}/include/volePSI"
  cp -- "${VOLEPSI_DIR}/out/build/linux/volePSI/config.h" "${VOLEPSI_INSTALL_DIR}/include/volePSI/config.h"
  [[ -f "${VOLEPSI_INSTALL_DIR}/lib/cmake/volePSI/volePSIConfig.cmake" ]] || die "Vole-PSI 安装不完整"
  printf '%s\n' "$VOLEPSI_REVISION" >"$VOLEPSI_STAMP"
else
  log "复用已安装的 Vole-PSI ${VOLEPSI_REVISION}"
fi

log "以 Release 模式编译 MPSO 后端"
cmake -S "$MPSO_DIR" -B "${MPSO_DIR}/build" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_C_COMPILER=gcc-11 \
  -DCMAKE_CXX_COMPILER=g++-11 \
  -DvolePSI_DIR="${VOLEPSI_INSTALL_DIR}/lib/cmake/volePSI"
cmake --build "${MPSO_DIR}/build" --parallel "$BUILD_JOBS"
mkdir -p "${MPSO_DIR}/build/offline"

for executable in test_mpsi test_mpsic test_mpsics test_mpsu; do
  [[ -x "${MPSO_DIR}/build/${executable}" ]] || die "缺少后端可执行程序：${executable}"
done

log "安装前端依赖并生成生产构建"
(
  cd "$FRONTEND_DIR"
  npm ci
  npm run build
)

if ss -H -ltn "sport = :${PORT}" 2>/dev/null | grep -q .; then
  die "端口 ${PORT} 已被占用，请停止现有服务或通过 PORT 指定其他端口"
fi

log "启动 MPSO 平台：${HOST}:${PORT}"
(
  cd "$FRONTEND_DIR"
  exec npm run start -- --hostname "$HOST" --port "$PORT"
) &
APP_PID=$!

HEALTH_URL="http://127.0.0.1:${PORT}/api/health"
for _ in $(seq 1 60); do
  kill -0 "$APP_PID" 2>/dev/null || die "前端服务在健康检查完成前退出"
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
[[ -n "${HEALTH_RESPONSE:-}" ]] || die "前端健康检查超时"
HEALTH_RESPONSE="$HEALTH_RESPONSE" node -e '
  const response = JSON.parse(process.env.HEALTH_RESPONSE)
  if (response.status !== "ok") process.exit(1)
' || die "后端健康检查未通过"

log "执行 3 方、2^12 的真实 MPSI 冒烟测试"
BASE_URL="http://127.0.0.1:${PORT}" node <<'NODE'
const baseUrl = process.env.BASE_URL
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const createResponse = await fetch(`${baseUrl}/api/runs`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    protocol: '隐私集合求交集',
    parties: 3,
    dataset: '12',
    threads: 4,
  }),
})
const created = await createResponse.json()
if (!createResponse.ok || !created.id) {
  throw new Error(`无法创建冒烟测试：${JSON.stringify(created)}`)
}

for (let attempt = 0; attempt < 600; attempt += 1) {
  const statusResponse = await fetch(`${baseUrl}/api/runs/${created.id}`, { cache: 'no-store' })
  const run = await statusResponse.json()
  if (!statusResponse.ok) throw new Error(`无法读取冒烟测试：${JSON.stringify(run)}`)
  if (run.status === 'failed') throw new Error(`冒烟测试失败：${run.error ?? '未知错误'}`)
  if (run.status === 'completed') {
    const sample = run.samples?.[0]
    if (!sample?.resultValue?.verified) throw new Error('冒烟测试结果未通过预期值校验')
    if (!(sample.oursOnlineMs > 0)) throw new Error('冒烟测试没有记录在线耗时')
    if (!(sample.oursCommMiB > 0)) throw new Error('冒烟测试没有记录在线通信量')
    if (!(sample.preparationMs > 0)) throw new Error('冒烟测试没有记录离线阶段耗时')
    console.log(`冒烟测试通过：任务 ${run.id}`)
    console.log(`在线耗时：${sample.oursOnlineMs.toFixed(3)} ms`)
    console.log(`在线通信：${sample.oursCommMiB.toFixed(3)} MiB`)
    process.exit(0)
  }
  await sleep(500)
}

throw new Error('冒烟测试等待超时')
NODE

LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
log "部署完成"
printf '本机访问：http://127.0.0.1:%s\n' "$PORT"
if [[ -n "$LAN_IP" ]]; then
  printf '局域网访问：http://%s:%s\n' "$LAN_IP" "$PORT"
fi
printf '服务正在前台运行，按 Ctrl+C 停止。\n\n'

wait "$APP_PID"
