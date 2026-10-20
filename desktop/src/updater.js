// Tự cập nhật từ GitHub Releases.
// Windows (NSIS) / Linux (AppImage, deb): electron-updater tải ngầm, cài khi khởi động lại hoặc khi thoát app.
// macOS: Squirrel.Mac chỉ cập nhật được app đã ký → chỉ báo có bản mới và mở trang tải.
import fs from 'node:fs'
import path from 'node:path'
import { app, dialog, shell } from 'electron'
import electronUpdater from 'electron-updater'

const { autoUpdater } = electronUpdater

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

let manual = false
let downloadedVersion = null
let dismissedVersion = null

export function initUpdater() {
  if (!app.isPackaged) return

  if (canAutoInstall) {
    // release đang được đánh dấu pre-release (0.0.x) vẫn phải nhận
    autoUpdater.allowPrerelease = true
    autoUpdater.on('update-downloaded', (info) => {
      downloadedVersion = info.version
      promptRestart()
    })
    autoUpdater.on('update-not-available', () => {
      if (manual) showUpToDate()
    })
    autoUpdater.on('error', (err) => {
      console.error('[updater]', err)
      if (manual) dialog.showErrorBox('Không kiểm tra được cập nhật', err?.message ?? String(err))
    })
  }

  checkForUpdates(false)
  setInterval(() => checkForUpdates(false), CHECK_EVERY_MS).unref()
}

/** @param {boolean} isManual bấm từ menu → báo cả khi không có bản mới / khi lỗi */
export async function checkForUpdates(isManual = true) {
  manual = isManual
  if (!app.isPackaged) {
    if (isManual) dialog.showMessageBox({ type: 'info', message: 'Chỉ kiểm tra cập nhật ở bản đã cài.' })
    return
  }
  if (downloadedVersion) return promptRestart()
  try {
    if (canAutoInstall) await autoUpdater.checkForUpdates()
    else await notifyFromGithub()
  } catch (err) {
    console.error('[updater]', err)
    if (isManual) dialog.showErrorBox('Không kiểm tra được cập nhật', err?.message ?? String(err))
  }
}

async function promptRestart() {
  const { response } = await dialog.showMessageBox({
    type: 'info',
    buttons: ['Khởi động lại', 'Để sau'],
    defaultId: 0,
    cancelId: 1,
    message: `Đã tải xong Shadowing ${downloadedVersion}`,
    detail: 'Khởi động lại để cập nhật. Nếu để sau, bản mới sẽ được cài khi bạn thoát app.',
  })
  if (response === 0) autoUpdater.quitAndInstall()
}

async function notifyFromGithub() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=10`, {
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (!res.ok) throw new Error(`GitHub trả về HTTP ${res.status}`)
  const latest = (await res.json()).find((r) => !r.draft)
  const version = latest?.tag_name?.replace(/^v/, '')

  if (!version || !isNewer(version, app.getVersion())) {
    if (manual) showUpToDate()
    return
  }
  if (!manual && version === dismissedVersion) return

  const { response } = await dialog.showMessageBox({
    type: 'info',
    buttons: ['Tải về', 'Để sau'],
    defaultId: 0,
    cancelId: 1,
    message: `Đã có Shadowing ${version}`,
    detail: `Bạn đang dùng ${app.getVersion()}. Tải file cài mới rồi kéo vào Applications để thay bản cũ.`,
  })
  if (response === 0) shell.openExternal(latest.html_url)
  else dismissedVersion = version
}

function showUpToDate() {
  dialog.showMessageBox({ type: 'info', message: `Bạn đang dùng bản mới nhất (${app.getVersion()}).` })
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
