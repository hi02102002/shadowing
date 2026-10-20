#!/usr/bin/env bash
# Gỡ Shadowing khỏi Docker.
#
#   ./uninstall.sh               # dừng + xoá container và image, GIỮ dữ liệu (volume shadowing-data)
#   ./uninstall.sh --purge       # xoá luôn dữ liệu (SQLite, bản ghi âm, cache) — không khôi phục được
#   ./uninstall.sh --purge -y    # không hỏi xác nhận
set -euo pipefail

cd "$(dirname "$0")"

PURGE=0
YES=0

usage() {
  sed -n '2,6p' "$0" | sed 's/^# \{0,1\}//'
}

while [ $# -gt 0 ]; do
  case "$1" in
    --purge) PURGE=1; shift ;;
    -y|--yes) YES=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Tham số không hợp lệ: $1" >&2; usage; exit 1 ;;
  esac
done

info() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31mxx\033[0m %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null 2>&1 || die "Không tìm thấy Docker."
docker info >/dev/null 2>&1 || die "Không kết nối được Docker daemon."

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  die "Chưa có Docker Compose."
fi

if [ "$PURGE" = 1 ] && [ "$YES" = 0 ]; then
  printf 'Xoá TOÀN BỘ dữ liệu (video, sổ lỗi, bản ghi âm, cài đặt)? Gõ "yes" để tiếp tục: '
  read -r answer
  [ "$answer" = "yes" ] || die "Đã huỷ."
fi

args=(down --rmi all --remove-orphans)
[ "$PURGE" = 1 ] && args+=(--volumes)

info "Dừng và xoá container, image…"
"${COMPOSE[@]}" "${args[@]}"

if [ "$PURGE" = 1 ]; then
  info "Đã xoá cả dữ liệu."
else
  volume="$(docker volume ls -q --filter label=com.docker.compose.volume=shadowing-data | head -n1)"
  info "Đã gỡ. Dữ liệu vẫn còn trong volume ${volume:-shadowing-data}."
  echo "    Cài lại:        ./install.sh"
  echo "    Xoá dữ liệu:    ./uninstall.sh --purge"
fi
