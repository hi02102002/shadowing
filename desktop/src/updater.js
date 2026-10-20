// Cập nhật từ GitHub Releases, do người dùng chủ động (không ép cập nhật):
// app chỉ tự kiểm tra có bản mới rồi báo cho trang Cài đặt; tải và cài khi người dùng bấm.
// Windows (NSIS) / Linux (AppImage, deb): electron-updater tải rồi cài khi khởi động lại (deb hỏi mật khẩu qua pkexec).
// macOS: Squirrel.Mac chỉ cập nhật được app đã ký → chỉ báo có bản mới và mở trang tải.
import fs from 'node:fs'
import path from 'node:path'
import { app, ipcMain, shell, webContents } from 'electron'
import electronUpdater from 'electron-updater'

const { autoUpdater } = electronUpdater

/** lỗi cập nhật trước đây chỉ in ra console → ghi thêm vào logs/updater.log để còn tra lại */
function fileLogger() {
  const dir = path.join(app.getPath('userData'), 'logs')
  fs.mkdirSync(dir, { recursive: true })
  const out = fs.createWriteStream(path.join(dir, 'updater.log'), { flags: 'a' })
  const write = (level) => (...args) => {
    const line = args.map((a) => (a instanceof Error ? a.stack : typeof a === 'string' ? a : JSON.stringify(a))).join(' ')
    out.write(`${new Date().toISOString()} [${level}] ${line}\n`)
    if (level === 'error') console.error('[updater]', ...args)
  }
  return { info: write('info'), warn: write('warn'), error: write('error'), debug: () => {} }
}

const REPO = 'hi02102002/shadowing'
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000

// electron-builder ghi resources/package-type cho bản deb; cài bản mới qua pkexec (hỏi mật khẩu)
const isDeb = () => {
  try {
    return fs.readFileSync(path.join(process.resourcesPath, 'package-type'), 'utf8').trim() === 'deb'
  } catch {
    return false
  }
}

const canAutoInstall =
  process.platform === 'win32' || (process.platform === 'linux' && (!!process.env.APPIMAGE || isDeb()))

/**
 * Trạng thái gửi cho trang Cài đặt (window.shadowingDesktop, xem preload.cjs).
 * status: idle | checking | up-to-date | available | downloading | downloaded | error | dev
 */
let state = {
  status: app.isPackaged ? 'idle' : 'dev',
  currentVersion: app.getVersion(),
  latestVersion: null,
  /** 0–1 khi đang tải */
  progress: 0,
  error: null,
  /** false (macOS chưa ký): không tự cài được, chỉ mở trang tải bản mới */
  canInstall: canAutoInstall,
  releaseUrl: null,
}

function setState(patch) {
  state = { ...state, ...patch }
  for (const wc of webContents.getAllWebContents()) wc.send('updater:state', state)
}

const releaseUrl = (version) => `https://github.com/${REPO}/releases/tag/v${version}`

export function initUpdater() {
  ipcMain.handle('updater:get', () => state)
  ipcMain.handle('updater:check', () => checkForUpdates())
  ipcMain.handle('updater:download', () => downloadUpdate())
  ipcMain.handle('updater:install', () => installUpdate())
  ipcMain.handle('updater:open-release', () =>
    shell.openExternal(state.releaseUrl ?? `https://github.com/${REPO}/releases/latest`),
  )

  if (!app.isPackaged) return

  if (canAutoInstall) {
    autoUpdater.logger = fileLogger()
    // chỉ tải / cài khi người dùng bấm trong Cài đặt
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false
    // release đang được đánh dấu pre-release (0.0.x) vẫn phải nhận
    autoUpdater.allowPrerelease = true
    autoUpdater.on('update-available', (info) =>
      setState({ status: 'available', latestVersion: info.version, releaseUrl: releaseUrl(info.version) }),
    )
    autoUpdater.on('update-not-available', () => setState({ status: 'up-to-date' }))
    autoUpdater.on('download-progress', (p) => setState({ status: 'downloading', progress: p.percent / 100 }))
    autoUpdater.on('update-downloaded', (info) =>
      setState({ status: 'downloaded', latestVersion: info.version, progress: 1 }),
    )
    autoUpdater.on('error', (err) => setState({ status: 'error', error: err?.message ?? String(err) }))
  }

  checkForUpdates()
  setInterval(() => checkForUpdates(), CHECK_EVERY_MS).unref()
}

/** Chỉ kiểm tra có bản mới, không tải. Gọi từ menu "Kiểm tra cập nhật…" hoặc trang Cài đặt */
export async function checkForUpdates() {
  if (!app.isPackaged || ['checking', 'downloading', 'downloaded'].includes(state.status)) return state
  setState({ status: 'checking', error: null })
  try {
    if (canAutoInstall) await autoUpdater.checkForUpdates()
    else await checkGithub()
  } catch (err) {
    setState({ status: 'error', error: err?.message ?? String(err) })
  }
  return state
}

async function downloadUpdate() {
  if (!canAutoInstall || state.status !== 'available') return state
  setState({ status: 'downloading', progress: 0, error: null })
  try {
    await autoUpdater.downloadUpdate()
  } catch (err) {
    setState({ status: 'error', error: err?.message ?? String(err) })
  }
  return state
}

function installUpdate() {
  if (state.status === 'downloaded') autoUpdater.quitAndInstall()
}

/** macOS: so phiên bản với release mới nhất trên GitHub */
async function checkGithub() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=10`, {
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (!res.ok) throw new Error(`GitHub trả về HTTP ${res.status}`)
  const latest = (await res.json()).find((r) => !r.draft)
  const version = latest?.tag_name?.replace(/^v/, '')
  if (version && isNewer(version, app.getVersion())) {
    setState({ status: 'available', latestVersion: version, releaseUrl: latest.html_url })
  } else {
    setState({ status: 'up-to-date' })
  }
}

/** so sánh x.y.z, bỏ qua hậu tố pre-release */
function isNewer(a, b) {
  const pa = a.split(/[.-]/).map(Number)
  const pb = b.split(/[.-]/).map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0)
  }
  return false
}
