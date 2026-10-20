// Mở app ở chế độ dev. Terminal tích hợp của VS Code (cũng là Electron) đặt sẵn ELECTRON_RUN_AS_NODE=1,
// kế thừa biến này thì Electron chạy như node và không mở được cửa sổ → xoá trước khi chạy.
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const child = spawn(electron, [desktopDir], { env, stdio: 'inherit' })
child.on('exit', (code) => process.exit(code ?? 0))
