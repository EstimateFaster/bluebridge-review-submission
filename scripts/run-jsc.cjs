const fs = require("fs")
const os = require("os")
const path = require("path")
const { spawnSync } = require("child_process")

const root = path.resolve(__dirname, "..")
const cli = path.join(root, "node_modules", "aiot-toolkit", "lib", "bin.js")
const commandArgs = process.argv.slice(2)
let workingDirectory = root
let temporaryRoot = ""
let projectJunction = ""

if (!commandArgs.length) {
  throw new Error("缺少 aiot-toolkit 命令")
}

if (process.platform === "win32" && /[^\x00-\x7F]/.test(root)) {
  temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "stocktycoon-jsc-"))
  projectJunction = path.join(temporaryRoot, "project")
  fs.symlinkSync(root, projectJunction, "junction")
  workingDirectory = projectJunction
  console.log("JSC 使用纯 ASCII 临时工程入口：" + projectJunction)
}

try {
  const result = spawnSync(process.execPath, [cli].concat(commandArgs), {
    cwd: workingDirectory,
    stdio: "inherit"
  })
  if (result.error) throw result.error
  process.exitCode = result.status === null ? 1 : result.status
} finally {
  if (projectJunction && fs.existsSync(projectJunction)) fs.unlinkSync(projectJunction)
  if (temporaryRoot && fs.existsSync(temporaryRoot)) fs.rmdirSync(temporaryRoot)
}
