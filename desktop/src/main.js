import { execFile, spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, dialog, Menu, shell } from 'electron'
import ffmpegStatic from 'ffmpeg-static'

const here = path.dirname(fileURLToPath(import.meta.url))

// localStorage gắn với origin (có cả cổng) → cố định cổng để không mất cài đặt phía client giữa các lần mở
const PREFERRED_PORT = 47821

const YTDLP_ASSETS = {
  linux: { x64: 'yt-dlp_linux', arm64: 'yt-dlp_linux_aarch64' },
  darwin: { x64: 'yt-dlp_macos', arm64: 'yt-dlp_macos' },
  win32: { x64: 'yt-dlp.exe', arm64: 'yt-dlp_arm64.exe' },
}

// tách khỏi cache Chromium trong userData: SQLite, bản ghi âm, cache tra từ
const dataDir = path.join(app.getPath('userData'), 'data')
const binDir = path.join(app.getPath('userData'), 'bin')
const logDir = path.join(app.getPath('userData'), 'logs')
const ytdlpPath = path.join(binDir, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp')
// dev: desktop/build/web · đóng gói: <resources>/web
const webDir = app.isPackaged ? path.join(process.resourcesPath, 'web') : path.join(app.getAppPath(), 'build/web')
const ffmpegPath = ffmpegStatic?.replace('app.asar', 'app.asar.unpacked')

/** @type {import('node:child_process').ChildProcess | null} */
let server = null
/** @type {BrowserWindow | null} */
let win = null
let quitting = false

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.focus()
  })
  app.whenReady().then(start)
}

app.on('window-all-closed', () => app.quit())
app.on('before-quit', () => {
  quitting = true
  server?.kill()
})

async function start() {
  Menu.setApplicationMenu(buildMenu())
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'Shadowing',
    // macOS lấy icon từ bundle; Linux/Windows cần chỉ định cho cửa sổ + taskbar
    icon: path.join(here, '../resources/icon.png'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true },
  })
  win.on('closed', () => {
    win = null
  })
  await win.loadFile(path.join(here, 'loading.html'))

  try {
    fs.mkdirSync(dataDir, { recursive: true })
    fs.mkdirSync(binDir, { recursive: true })
    fs.mkdirSync(logDir, { recursive: true })
    await ensureYtdlp()
    setStatus('Đang khởi động…')
    const port = await findPort(PREFERRED_PORT)
    const origin = `http://127.0.0.1:${port}`
    startServer(port)
    await waitForServer(origin)
    lockToOrigin(win, origin)
    await win.loadURL(origin)
  } catch (err) {
    fail(err)
  }
}

// ---------- yt-dlp ----------

async function ensureYtdlp() {
  if (fs.existsSync(ytdlpPath)) {
    // YouTube đổi thường xuyên, bản cũ sẽ không lấy được phụ đề → cập nhật nền mỗi lần mở
    execFile(ytdlpPath, ['-U', '--update-to', 'stable'], { timeout: 120_000 }, () => {})
    return
  }
  const asset = YTDLP_ASSETS[process.platform]?.[process.arch]
  if (!asset) throw new Error(`yt-dlp không hỗ trợ ${process.platform}-${process.arch}`)

  setStatus('Đang tải yt-dlp (chỉ lần đầu)…')
  const res = await fetch(`https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`)
  if (!res.ok) throw new Error(`Không tải được yt-dlp (HTTP ${res.status}). Kiểm tra kết nối mạng.`)
  const tmp = `${ytdlpPath}.download`
  fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()))
  fs.chmodSync(tmp, 0o755)
  fs.renameSync(tmp, ytdlpPath)
}

// ---------- server ----------

function startServer(port) {
  const log = fs.createWriteStream(path.join(logDir, 'server.log'), { flags: 'a' })
  log.write(`\n--- ${new Date().toISOString()} · v${app.getVersion()} · port ${port}\n`)

  server = spawn(process.execPath, [path.join(webDir, '.output/server/index.mjs')], {
    // migration được đọc từ ./drizzle theo cwd
    cwd: webDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: String(port),
      DATABASE_URL: path.join(dataDir, 'app.db'),
      DATA_DIR: dataDir,
      YTDLP_PATH: ytdlpPath,
      // yt-dlp cần JS runtime; dùng lại Electron ở chế độ node (biến ELECTRON_RUN_AS_NODE được kế thừa)
      YTDLP_JS_RUNTIME: `node:${process.execPath}`,
      ...(ffmpegPath ? { FFMPEG_PATH: ffmpegPath } : {}),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  server.stdout.pipe(log)
  server.stderr.pipe(log)
  server.on('exit', (code, signal) => {
    server = null
    if (!quitting) fail(new Error(`Server dừng bất thường (code ${code ?? signal}).`))
  })
}

async function waitForServer(origin, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (!server) throw new Error('Server không khởi động được.')
    try {
      const res = await fetch(origin, { signal: AbortSignal.timeout(2000) })
      if (res.ok) return
    } catch {
      /* chưa lên */
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error('Server khởi động quá lâu.')
}

function findPort(preferred) {
  const tryPort = (port) =>
    new Promise((resolve) => {
      const srv = net.createServer()
      srv.once('error', () => resolve(null))
      srv.listen(port, '127.0.0.1', () => {
        const { port: got } = srv.address()
        srv.close(() => resolve(got))
      })
    })
  return (async () => {
    for (let p = preferred; p < preferred + 20; p++) {
      const got = await tryPort(p)
      if (got) return got
    }
    return tryPort(0)
  })()
}

// ---------- cửa sổ ----------

/** Link ngoài app (YouTube, tài liệu…) mở bằng trình duyệt mặc định */
function lockToOrigin(window, origin) {
  const isExternal = (url) => !url.startsWith(origin)
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    if (!isExternal(url)) return
    event.preventDefault()
    if (/^https?:/.test(url)) shell.openExternal(url)
  })
}

function setStatus(text) {
  win?.webContents.executeJavaScript(`setStatus(${JSON.stringify(text)})`).catch(() => {})
}

function fail(err) {
  if (quitting) return
  const message = err instanceof Error ? err.message : String(err)
  dialog.showErrorBox('Shadowing không khởi động được', `${message}\n\nLog: ${path.join(logDir, 'server.log')}`)
  app.quit()
}

function buildMenu() {
  const isMac = process.platform === 'darwin'
  return Menu.buildFromTemplate([
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'Tệp',
      submenu: [
        { label: 'Mở thư mục dữ liệu', click: () => shell.openPath(dataDir) },
        { label: 'Mở log', click: () => shell.openPath(logDir) },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit', label: 'Thoát' },
      ],
    },
    { role: 'editMenu', label: 'Sửa' },
    { role: 'viewMenu', label: 'Xem' },
    { role: 'windowMenu', label: 'Cửa sổ' },
  ])
}
