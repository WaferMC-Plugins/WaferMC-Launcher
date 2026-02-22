const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false })
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`Comando fallito: ${command} ${args.join(' ')}`)
  }
}

function resolveElectronBuilder() {
  const cli = path.join(process.cwd(), 'node_modules', 'electron-builder', 'cli.js')
  if (!fs.existsSync(cli)) {
    throw new Error(`electron-builder CLI non trovato: ${cli}`)
  }
  return cli
}

function resolveRcedit() {
  const localAppData = process.env.LOCALAPPDATA
  if (!localAppData) {
    throw new Error('LOCALAPPDATA non disponibile.')
  }
  const cacheRoot = path.join(localAppData, 'electron-builder', 'Cache', 'winCodeSign')
  if (!fs.existsSync(cacheRoot)) {
    throw new Error(`Cache winCodeSign non trovata: ${cacheRoot}`)
  }

  let latest = null
  for (const entry of fs.readdirSync(cacheRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const candidate = path.join(cacheRoot, entry.name, 'rcedit-x64.exe')
    if (!fs.existsSync(candidate)) continue
    const mtime = fs.statSync(candidate).mtimeMs
    if (!latest || mtime > latest.mtime) {
      latest = { file: candidate, mtime }
    }
  }

  if (!latest) {
    throw new Error('rcedit-x64.exe non trovato nella cache winCodeSign.')
  }

  return latest.file
}

const builder = resolveElectronBuilder()
const appExe = path.join('dist', 'win-unpacked', 'WaferMC Launcher.exe')
const appIcon = path.join('build', 'icon.ico')

run(process.execPath, [builder, 'build', '--win', 'dir', '--config.win.signAndEditExecutable=false'])

const rcedit = resolveRcedit()
run(rcedit, [appExe, '--set-icon', appIcon])

run(process.execPath, [builder, 'build', '--win', 'nsis', '--prepackaged', path.join('dist', 'win-unpacked'), '--config.win.signAndEditExecutable=false'])
