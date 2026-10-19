#!/bin/sh
set -e

# YouTube thay đổi thường xuyên, bản yt-dlp cũ sẽ không lấy được phụ đề → tự cập nhật khi khởi động.
# Tắt bằng YTDLP_AUTO_UPDATE=0 (vd. khi chạy không có mạng).
if [ "${YTDLP_AUTO_UPDATE:-1}" = "1" ] && [ -w "$YTDLP_PATH" ]; then
  "$YTDLP_PATH" -U --update-to stable >/dev/null 2>&1 \
    && echo "yt-dlp $("$YTDLP_PATH" --version)" \
    || echo "yt-dlp: không cập nhật được, dùng bản $("$YTDLP_PATH" --version)"
fi

mkdir -p "${DATA_DIR:-/app/data}"

exec "$@"
