import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { serveFrontend } from './server.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const token = randomBytes(32).toString('hex')
const bootstrap = randomBytes(32).toString('hex')
let server, child, temporary
let closing = false
async function close() {
  if (closing) return
  closing = true
  server?.close()
  child?.kill()
  if (temporary) await rm(temporary, {recursive: true, force: true})
}
process.on('SIGINT', async () => { await close(); process.exit() })
process.on('SIGTERM', async () => { await close(); process.exit() })
try {
  server = await serveFrontend(path.join(root, 'dist'), token, bootstrap)
  const python = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
  child = spawn(python, [path.join(root, 'backend/run_backend.py')], { cwd: root, env: {...process.env, MEDVISION_TOKEN: token}, stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true })
  child.on('error', async () => { console.error('Cannot start the bundled development runtime. See installation instructions.'); await close(); process.exitCode = 1 })
  child.on('exit', async () => { if (!closing) { console.error('Local imaging service stopped.'); await close(); process.exitCode = 1 } })
  let ready = false
  for (let n = 0; n < 100 && !closing; n++) {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/v1/settings', {headers: {Authorization: `Bearer ${token}`}})
      if (response.ok) { ready = true; break }
    } catch {}
    await new Promise(r => setTimeout(r, 100))
  }
  if (!ready) throw new Error('Backend startup failed or port 8000 is occupied.')
  temporary = await mkdtemp(path.join(tmpdir(), 'medvision-launch-'))
  const launchPath = path.join(temporary, 'launch.html')
  // One-time bootstrap travels in a POST body, never in a URL. Browser session is HttpOnly.
  await writeFile(launchPath, `<!doctype html><meta charset="utf-8"><title>Launch MedVision</title><form method="post" action="http://127.0.0.1:3000/bootstrap"><input type="hidden" name="code" value="${bootstrap}"><button>Open MedVision workstation</button></form>`, {mode: 0o600})
  const url = pathToFileURL(launchPath).href
  if (process.platform === 'win32') spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], {windowsHide: true, stdio: 'ignore'})
  else spawn('open', [url], {stdio: 'ignore'})
  console.log('MedVision is running on 127.0.0.1:3000. Close with Ctrl+C.')
} catch (error) { console.error(error.message); await close(); process.exitCode = 1 }
