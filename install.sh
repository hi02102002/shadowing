#!/usr/bin/env bash
# Cài đặt / cập nhật Shadowing bằng Docker Compose.
#
#   ./install.sh                 # build image + chạy ở cổng 3000 (hoặc PORT trong .env)
#   ./install.sh --port 8080     # đổi cổng
#   ./install.sh --no-build      # chạy lại bằng image đã có, không build
set -euo pipefail

cd "$(dirname "$0")"

PORT_ARG=""
BUILD=1

usage() {
  sed -n '2,6p' "$0" | sed 's/^# \{0,1\}//'
}

while [ $# -gt 0 ]; do
  case "$1" in
    -p|--port) PORT_ARG="${2:?thiếu số cổng}"; shift 2 ;;
    --no-build) BUILD=0; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Tham số không hợp lệ: $1" >&2; usage; exit 1 ;;
  esac
done

info() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31mxx\033[0m %s\n' "$*" >&2; exit 1; }

# ---- kiểm tra Docker ----
command -v docker >/dev/null 2>&1 \
  || die "Chưa cài Docker. Xem https://docs.docker.com/engine/install/"
docker info >/dev/null 2>&1 \
  || die "Không kết nối được Docker daemon (daemon chưa chạy, hoặc user chưa thuộc nhóm docker)."

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  die "Chưa có Docker Compose. Xem https://docs.docker.com/compose/install/"
fi

# ---- .env ----
if [ ! -f .env ]; then
  cp .env.example .env
  info "Đã tạo .env từ .env.example (điền API key ở đây hoặc ở trang /settings)."
fi

if [ -n "$PORT_ARG" ]; then
  case "$PORT_ARG" in *[!0-9]*) die "Cổng không hợp lệ: $PORT_ARG" ;; esac
  if grep -q '^PORT=' .env; then
    sed -i.bak "s/^PORT=.*/PORT=$PORT_ARG/" .env && rm -f .env.bak
  else
    printf '\n# Cổng trên máy host\nPORT=%s\n' "$PORT_ARG" >> .env
  fi
fi

# compose đọc PORT từ .env để map cổng; biến môi trường shell vẫn được ưu tiên
PORT="${PORT:-$(sed -n 's/^PORT=//p' .env | tail -n1 | tr -d '"'"'"' ')}"
PORT="${PORT:-3000}"
export PORT

# ---- build + chạy ----
if [ "$BUILD" = 1 ]; then
  info "Build image và khởi động container (lần đầu có thể mất vài phút)…"
  "${COMPOSE[@]}" up -d --build
else
  info "Khởi động container…"
  "${COMPOSE[@]}" up -d
fi

# ---- chờ healthcheck ----
CONTAINER=shadowing
info "Chờ app sẵn sàng…"
status=""
for _ in $(seq 1 60); do
  status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$CONTAINER" 2>/dev/null || true)"
  case "$status" in
    healthy|running) break ;;
    unhealthy|exited|dead) break ;;
  esac
  sleep 2
done

case "$status" in
  healthy|running)
    info "Xong! Mở http://localhost:$PORT"
    echo "    Log:      ${COMPOSE[*]} logs -f"
    echo "    Gỡ cài:   ./uninstall.sh"
    ;;
  *)
    warn "Container chưa sẵn sàng (trạng thái: ${status:-không rõ}). 50 dòng log gần nhất:"
    "${COMPOSE[@]}" logs --tail 50 || true
    exit 1
    ;;
esac
