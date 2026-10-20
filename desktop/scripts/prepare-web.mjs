// Chép server đã build (../.output) + migration vào build/web, rồi đổi better-sqlite3 sang bản cho Electron.
// Server chạy bằng chính binary Electron (ELECTRON_RUN_AS_NODE) nên module native phải khớp ABI của Electron.
//
//   TARGET_ARCH=arm64 node scripts/prepare-web.mjs   # build cho kiến trúc khác máy hiện tại
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rootDir = path.resolve(desktopDir, '..')
const outDir = path.join(desktopDir, 'build/web')

const serverEntry = path.join(rootDir, '.output/server/index.mjs')
if (!fs.existsSync(serverEntry)) {
  console.error('Chưa có .output/server. Chạy `pnpm build` ở thư mục gốc trước.')
  process.exit(1)
}

fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })
fs.cpSync(path.join(rootDir, '.output'), path.join(outDir, '.output'), { recursive: true })
fs.cpSync(path.join(rootDir, 'drizzle'), path.join(outDir, 'drizzle'), { recursive: true })

const electronVersion = require('electron/package.json').version
const arch = process.env.TARGET_ARCH || process.arch
const sqliteDir = path.join(outDir, '.output/server/node_modules/better-sqlite3')

console.log(`better-sqlite3 → electron ${electronVersion} (${process.platform}-${arch})`)
fs.rmSync(path.join(sqliteDir, 'build'), { recursive: true, force: true })
try {
  execFileSync(
    process.execPath,
    [
      require.resolve('prebuild-install/bin.js'),
      '--runtime', 'electron',
      '--target', electronVersion,
      '--arch', arch,
      '--platform', process.platform,
      '--verbose',
    ],
    { cwd: sqliteDir, stdio: 'inherit' },
  )
} catch {
  console.error(
    `Không tải được better-sqlite3 dựng sẵn cho electron ${electronVersion}. ` +
      'Kiểm tra mạng, hoặc dùng bản Electron mà better-sqlite3 có prebuild.',
  )
  process.exit(1)
}

if (!fs.existsSync(path.join(sqliteDir, 'build/Release/better_sqlite3.node'))) {
  console.error('Thiếu build/Release/better_sqlite3.node sau khi tải prebuild.')
  process.exit(1)
}
console.log(`Đã chuẩn bị ${path.relative(desktopDir, outDir)}`)
