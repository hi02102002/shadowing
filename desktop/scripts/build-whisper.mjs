// Build whisper-cli (whisper.cpp) để tạo phụ đề ngay trên máy, không cần API.
// Release chính thức của whisper.cpp chỉ có bản Windows → tự build cho mọi nền tảng cho đồng nhất.
//
//   node scripts/build-whisper.mjs              # → build/whisper/whisper-cli (app desktop)
//   node scripts/build-whisper.mjs ../bin       # → bin/whisper-cli (pnpm dev ở thư mục gốc)
//   CMAKE=/path/to/cmake node scripts/build-whisper.mjs
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const VERSION = 'v1.9.5'
const REPO = 'https://github.com/ggml-org/whisper.cpp'

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.resolve(process.argv[2] ?? path.join(desktopDir, 'build/whisper'))
const srcDir = path.join(desktopDir, 'build/whisper-src')
const exe = process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli'
const stamp = path.join(outDir, 'VERSION')
const cmake = process.env.CMAKE || 'cmake'

const flags = [
  '-DCMAKE_BUILD_TYPE=Release',
  // một file thực thi duy nhất, không kèm .so/.dll
  '-DBUILD_SHARED_LIBS=OFF',
  // không tối ưu theo CPU của máy build (vd. AVX-512 trên runner CI) → chạy được trên CPU cũ
  '-DGGML_NATIVE=OFF',
  // OpenMP cần libgomp.so / vcomp140.dll mà máy người dùng (và image Docker slim) có thể không có;
  // ggml tự có threadpool nên chỉ chậm hơn chút ít
  '-DGGML_OPENMP=OFF',
  '-DWHISPER_BUILD_TESTS=OFF',
  '-DWHISPER_BUILD_SERVER=OFF',
  '-DWHISPER_SDL2=OFF',
  '-DWHISPER_CURL=OFF',
  ...(process.platform === 'linux' ? ['-DCMAKE_EXE_LINKER_FLAGS=-static-libstdc++ -static-libgcc'] : []),
  // CRT tĩnh: không bắt người dùng cài Visual C++ Redistributable
  ...(process.platform === 'win32' ? ['-DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded'] : []),
]
// đổi phiên bản hoặc cờ build thì build lại
const stampValue = [VERSION, ...flags].join(' ')

const builtStamp = fs.existsSync(stamp) ? fs.readFileSync(stamp, 'utf8').trim() : null
if (fs.existsSync(path.join(outDir, exe)) && builtStamp === stampValue) {
  console.log(`whisper-cli ${VERSION} đã có trong ${outDir}`)
  process.exit(0)
}

const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit' })

if (!fs.existsSync(path.join(srcDir, 'CMakeLists.txt'))) {
  fs.rmSync(srcDir, { recursive: true, force: true })
  run('git', ['clone', '--depth', '1', '--branch', VERSION, REPO, srcDir])
}

run(cmake, ['-S', srcDir, '-B', path.join(srcDir, 'build'), ...flags])
run(cmake, [
  '--build', path.join(srcDir, 'build'),
  '--config', 'Release',
  '--target', 'whisper-cli',
  '--parallel', String(os.availableParallelism()),
])

// MSVC đặt binary trong bin/Release, các generator khác trong bin/
const built = [path.join(srcDir, 'build/bin/Release', exe), path.join(srcDir, 'build/bin', exe)].find((p) =>
  fs.existsSync(p),
)
if (!built) {
  console.error('Không tìm thấy whisper-cli sau khi build')
  process.exit(1)
}
fs.mkdirSync(outDir, { recursive: true })
fs.copyFileSync(built, path.join(outDir, exe))
fs.writeFileSync(stamp, stampValue)
console.log(`whisper-cli ${VERSION} → ${path.join(outDir, exe)}`)
