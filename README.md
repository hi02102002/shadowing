# Shadowing: luyện nghe nói tiếng Anh từ YouTube

Dán link YouTube bất kỳ, app sẽ tự lấy phụ đề và tách thành từng câu để luyện:

- **Shadowing**: nghe và nói đuổi theo, chữ chạy kiểu karaoke theo timing từng từ, có chế độ không nhìn chữ, lặp câu và chỉnh tốc độ 0.5–1.25×.
- **Nghe chép chính tả**: gõ lại câu vừa nghe. App chấm từng từ (đúng / sai / thiếu / thừa) và hiểu được contraction, số viết bằng chữ, dấu nháy cong. AI giải thích bằng tiếng Việt vì sao bạn nghe nhầm (weak form, nối âm, nuốt âm…).
- **Luyện phát âm**: ghi âm rồi chấm độ chính xác, độ đầy đủ, độ trôi chảy và tốc độ nói, kèm nhận xét IPA, mẹo khẩu hình và bài tập. Mặc định **model AI nghe trực tiếp bản ghi** (Gemini, gpt-audio…), nghe ra cả lỗi âm cuối và trọng âm mà Whisper hay bỏ qua. Có thể đổi sang Whisper (STT) trong Cài đặt.
- **Sổ lỗi**: mọi lỗi được gom theo từ và loại lỗi, xếp theo số lần sai, có nút để luyện lại đúng câu chứa lỗi.

App chỉ nhận video có phụ đề tiếng Anh (phụ đề chuẩn hoặc tự động). Video không có phụ đề sẽ bị từ chối khi nhập.

## Stack (TanStack)

| | |
|---|---|
| TanStack **Start** | SSR, server functions (`createServerFn`) |
| TanStack **Router** | file-based routes, search param `?seg=` được validate bằng zod |
| TanStack **Query** | dữ liệu server, mutation, cache |
| TanStack **DB** | collection sổ lỗi + live query, xoá optimistic |
| TanStack **Form** | form nhập link, ô dictation, trang cài đặt |
| TanStack **Table** v9 | bảng sổ lỗi (sort, global filter, column filter) |
| TanStack **Virtual** | transcript dài hàng trăm câu |
| TanStack **Store** | trạng thái player (thời gian, range, loop, tốc độ) |
| TanStack **Pacer** | throttle đồng bộ thời gian player |
| TanStack **Hotkeys** | phím tắt |
| TanStack **AI** | LLM đổi được provider + structured output (zod) + transcription |
| TanStack **Devtools** | Router / Query / Form |

Ngoài TanStack: React 19, Tailwind v4, shadcn/ui, Drizzle + SQLite (better-sqlite3), yt-dlp.

## Cài đặt

Cần có Node ≥ 22, pnpm và **yt-dlp bản mới**. Bản yt-dlp cài qua apt thường quá cũ, YouTube sẽ trả lỗi 400.

```bash
pnpm install

# tải yt-dlp mới nhất vào ./bin (app tự dùng nếu có)
mkdir -p bin && curl -L -o bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux && chmod +x bin/yt-dlp

cp .env.example .env   # điền API key, hoặc nhập ở trang /settings
pnpm dev
```

Database `data/app.db` được tạo và migrate tự động khi khởi động.

## Chạy bằng Docker

Image đã có sẵn node, ffmpeg và yt-dlp. yt-dlp tự cập nhật mỗi lần container khởi động; tắt bằng `YTDLP_AUTO_UPDATE=0`.

Cách nhanh nhất là dùng script:

```bash
./install.sh                # tạo .env nếu chưa có, build, chạy và chờ app sẵn sàng
./install.sh --port 8080    # đổi cổng (ghi vào .env)
./uninstall.sh              # xoá container + image, giữ dữ liệu
./uninstall.sh --purge      # xoá luôn dữ liệu (có hỏi xác nhận)
```

Hoặc chạy thủ công:

```bash
cp .env.example .env      # tuỳ chọn: điền key, hoặc cấu hình sau ở /settings
docker compose up -d --build
# mở http://localhost:3000   (đổi cổng: PORT=8080 docker compose up -d)
```

Dữ liệu (SQLite, bản ghi âm, cache tra từ) nằm trong volume `shadowing-data` và được giữ nguyên khi cập nhật image.

```bash
docker compose logs -f                 # xem log
docker compose up -d --build           # cập nhật sau khi sửa code
docker compose down                    # dừng, vẫn giữ dữ liệu
docker run --rm -v shadowing_shadowing-data:/data -v "$PWD":/backup busybox \
  tar czf /backup/shadowing-backup.tgz -C /data .   # sao lưu dữ liệu
```

Không dùng compose:

```bash
docker build -t shadowing .
docker run -d -p 3000:3000 -v shadowing-data:/app/data --env-file .env shadowing
```

## App desktop (không cần Docker)

Đóng gói thành app Electron: người dùng tải file cài đặt, mở là chạy, không cần cài Node, yt-dlp hay ffmpeg.

```bash
pnpm --dir desktop install   # lần đầu
pnpm desktop                 # build rồi mở app để thử
pnpm desktop:dist            # tạo file cài đặt cho hệ điều hành đang dùng → desktop/dist/
```

Muốn có đủ `.AppImage` (Linux), `.exe` (Windows) và `.dmg` (macOS), push một tag `v*` lên GitHub, workflow `desktop` sẽ build trên cả 3 hệ điều hành và tạo bản nháp Release.

Cách hoạt động:

- Server TanStack Start chạy bằng chính binary Electron (`ELECTRON_RUN_AS_NODE`) ở `127.0.0.1:47821`, cửa sổ app mở trang đó.
- `better-sqlite3` được thay bằng bản dựng sẵn cho Electron (`desktop/scripts/prepare-web.mjs`). Chỉ dùng phiên bản Electron mà better-sqlite3 có prebuild.
- ffmpeg đi kèm app (`ffmpeg-static`). yt-dlp được tải về lần mở đầu tiên và tự cập nhật mỗi lần mở.
- Icon gốc là `desktop/resources/icon.svg`. Sửa xong chạy `pnpm --dir desktop icon` để render lại `icon.png` (1024px), electron-builder tự sinh `.ico` / `.icns` từ đó.
- Dữ liệu nằm trong thư mục người dùng (`~/.config/Shadowing/data`, `%APPDATA%\Shadowing\data`, `~/Library/Application Support/Shadowing/data`). Menu **Tệp** có lối tắt mở thư mục dữ liệu và log.

App chưa được ký: macOS cần chuột phải → **Open** ở lần mở đầu, Windows SmartScreen cần bấm **More info → Run anyway**.

## Cấu hình AI

Có thể dùng bất kỳ provider nào; vào **Cài đặt** để đổi (giá trị ở đó ghi đè `.env`).

| Mục đích | Provider |
|---|---|
| Phân tích lỗi (LLM) | OpenAI, Anthropic, Gemini, Ollama (local), hoặc mọi API tương thích OpenAI (OpenRouter, Groq, LM Studio, vLLM…) |
| Chấm phát âm (mặc định) | Chính model LLM ở trên nếu nó nghe được audio: mọi model Gemini, `gpt-audio`/`gpt-4o-audio`, hoặc proxy OpenAI-compatible có hỗ trợ `input_audio`. Claude và Ollama không nghe được |
| Speech-to-Text (tuỳ chọn, chế độ Whisper) | Bất kỳ endpoint `/audio/transcriptions` chuẩn OpenAI có `verbose_json` + timestamp từng từ: OpenAI `whisper-1`, Groq `whisper-large-v3-turbo`, hoặc speaches / faster-whisper-server chạy local |

Model phải hỗ trợ structured output (JSON schema). Ở chế độ AI nghe trực tiếp, bản ghi được chuyển sang WAV 16kHz bằng **ffmpeg** (cần cài sẵn) rồi gửi qua `/chat/completions` dạng `input_audio`.

## Phím tắt

`Space` phát/dừng · `R` nghe lại câu · `←` `→` câu trước/sau · `L` lặp câu · `M` ghi âm
Trong ô chép chính tả: `Enter` để nộp / sang câu tiếp, `Ctrl+Space` để nghe lại.

## Scripts

```bash
pnpm dev            # dev server
pnpm build && node .output/server/index.mjs   # production
npx vitest run      # unit test (align, tách câu, parse json3, parse link)
pnpm db:generate    # tạo migration sau khi sửa src/db/schema.ts
```

## Cấu trúc

```
src/
  routes/                 # / , /videos/$videoId/{index,shadow,dictation,pronounce}, /review, /settings
  server/
    fns/                  # server functions: videos, dictation, pronunciation, review, settings
    ai/provider.ts        # factory adapter TanStack AI theo cấu hình
    ai/prompts.ts         # prompt + zod schema kết quả (tiếng Việt)
    stt.ts                # speech-to-text
    youtube/ytdlp.ts      # metadata, chọn track phụ đề, tải audio
    transcript/           # parse json3, tách câu
  lib/align.ts            # căn chỉnh Levenshtein từng từ (dùng chung client/server)
  lib/player-store.ts     # TanStack Store cho YouTube player
  components/, hooks/
```

## Lưu ý

- Khi shadowing nên **đeo tai nghe**, nếu không micro sẽ thu cả tiếng video và điểm sẽ không chính xác.
- STT (Whisper) đôi khi "tự sửa" lỗi phát âm nhỏ, nên điểm phát âm phản ánh mức độ máy hiểu được bạn chứ không chấm theo từng âm vị.
- Bản ghi âm lưu ở `data/recordings/`.
