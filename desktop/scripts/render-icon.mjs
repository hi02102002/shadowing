// Render resources/icon.svg → resources/icon.png (1024px) bằng Chromium của Electron.
// electron-builder sinh .icns / .ico từ file PNG này.
// Linux cần thêm resources/icons/<n>x<n>.png: theme hicolor không có cỡ 1024 → menu ứng dụng không thấy icon.
//
//   pnpm icon
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SIZE = 1024
const self = fileURLToPath(import.meta.url)
const resourcesDir = path.resolve(path.dirname(self), '../resources')
const svgPath = path.join(resourcesDir, 'icon.svg')
const pngPath = path.join(resourcesDir, 'icon.png')
const linuxIconsDir = path.join(resourcesDir, 'icons')
const LINUX_SIZES = [16, 24, 32, 48, 64, 128, 256, 512]

if (process.versions.electron) {
  const { app, BrowserWindow } = await import('electron')
  // không await whenReady ở top-level: 'ready' chỉ phát sau khi module chính chạy xong → treo
  app.whenReady().then(() =>
    render(BrowserWindow).then(
      () => app.exit(0),
      (err) => {
        console.error(err)
        app.exit(1)
      },
    ),
  )
} else {
  // chạy bằng node → mở lại chính file này trong Electron
  const { default: electron } = await import('electron')
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const child = spawn(electron, ['--force-device-scale-factor=1', self], { env, stdio: 'inherit' })
  child.on('exit', (code) => process.exit(code ?? 0))
}

async function render(BrowserWindow) {
  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    frame: false,
    transparent: true,
    useContentSize: true,
    webPreferences: { offscreen: true },
  })
  const svg = fs.readFileSync(svgPath).toString('base64')
  const html =
    '<body style="margin:0;background:transparent">' +
    `<img src="data:image/svg+xml;base64,${svg}" width="${SIZE}" height="${SIZE}" style="display:block">`
  await win.loadURL(`data:text/html;base64,${Buffer.from(html).toString('base64')}`)
  await win.webContents.executeJavaScript('document.images[0].decode()')
  // frame offscreen có thể chưa vẽ xong ngay sau khi ảnh decode → capturePage lỗi, thử lại
  let image
  for (let attempt = 0; !image; attempt++) {
    await new Promise((r) => setTimeout(r, 250))
    try {
      image = await win.webContents.capturePage({ x: 0, y: 0, width: SIZE, height: SIZE })
      if (image.isEmpty()) image = undefined
    } catch (err) {
      if (attempt >= 10) throw err
    }
  }
  image = image.resize({ width: SIZE, height: SIZE })
  fs.writeFileSync(pngPath, image.toPNG())
  console.log(`Đã tạo ${path.relative(process.cwd(), pngPath)}`)

  fs.mkdirSync(linuxIconsDir, { recursive: true })
  for (const size of LINUX_SIZES) {
    const out = path.join(linuxIconsDir, `${size}x${size}.png`)
    fs.writeFileSync(out, image.resize({ width: size, height: size, quality: 'best' }).toPNG())
  }
  console.log(`Đã tạo ${path.relative(process.cwd(), linuxIconsDir)}/ (${LINUX_SIZES.join(', ')}px)`)
}
