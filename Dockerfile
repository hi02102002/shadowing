# syntax=docker/dockerfile:1.7

# ---------- build ----------
FROM node:24-bookworm-slim AS build
WORKDIR /app

# toolchain để biên dịch better-sqlite3 nếu không có prebuilt cho node/arch này
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store

COPY . .
RUN pnpm build

# ---------- runtime ----------
FROM node:24-bookworm-slim AS runtime
WORKDIR /app

# ffmpeg: chuyển bản ghi sang WAV · yt-dlp (bản standalone) cần glibc + một JS runtime (node có sẵn)
ARG YTDLP_VERSION=latest
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl tini \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /app/bin \
 && if [ "$YTDLP_VERSION" = "latest" ]; then \
      url=https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux; \
    else \
      url=https://github.com/yt-dlp/yt-dlp/releases/download/$YTDLP_VERSION/yt-dlp_linux; \
    fi \
 && curl -fsSL -o /app/bin/yt-dlp "$url" \
 && chmod +x /app/bin/yt-dlp \
 && /app/bin/yt-dlp --version

COPY --from=build /app/.output ./.output
COPY --from=build /app/drizzle ./drizzle
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
 && mkdir -p /app/data \
 && chown -R node:node /app/data /app/bin

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATABASE_URL=/app/data/app.db \
    DATA_DIR=/app/data \
    YTDLP_PATH=/app/bin/yt-dlp \
    YTDLP_AUTO_UPDATE=1

USER node
EXPOSE 3000
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--", "docker-entrypoint.sh"]
CMD ["node", ".output/server/index.mjs"]
