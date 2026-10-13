import { spawn, execFileSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { serveFrontend } from './server.mjs'

const root = process.cwd()
const temporary = await mkdtemp(path.join(tmpdir(), 'medvision-test-'))
const python = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
execFileSync(python, [path.join(root, 'scripts/prepare-browser-tests.py'), temporary], {stdio: 'inherit'})
const token = 'test-session-' + 'a'.repeat(48)
const server = await serveFrontend(path.join(root, 'dist'), token, 'browser-test-bootstrap')
const backend = spawn(python, [path.join(root, 'backend/run_backend.py')], {env: {...process.env, MEDVISION_TOKEN: token, MEDVISION_DATA_DIR: path.join(temporary, 'data')}, stdio: 'inherit', windowsHide: true})
backend.on('exit', () => server.close())
let ready = false
for (let i=0;i<100;i++) {
  try { const response=await fetch('http://127.0.0.1:8000/health'); if(response.ok){ready=true;break} } catch {}
  await new Promise(r=>setTimeout(r,100))
}
if (!ready) {backend.kill();server.close();throw new Error('Test backend failed to start')}
console.log('Browser test services ready')
async function stop() {backend.kill();server.close();await rm(temporary,{recursive:true,force:true});process.exit()}
process.on('SIGINT',stop);process.on('SIGTERM',stop)
