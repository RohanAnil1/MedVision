import { execFileSync } from 'node:child_process'
import path from 'node:path'

if (process.platform !== 'darwin') throw new Error('macOS distributions must be built on macOS.')
if (!['arm64','x64'].includes(process.arch)) throw new Error('Unsupported macOS build architecture.')
const root=process.cwd()
const python=path.join(root,'.venv/bin/python')
const pythonArch=execFileSync(python,['-c','import platform; print(platform.machine())'],{encoding:'utf8'}).trim()
const expected=process.arch==='arm64'?'arm64':'x86_64'
if(pythonArch!==expected) throw new Error(`Python architecture ${pythonArch} does not match Node/Electron ${process.arch}. Create a native venv first.`)
execFileSync('/bin/sh',['scripts/build-backend.sh'],{stdio:'inherit'})
execFileSync('npm',['run','build'],{stdio:'inherit'})
execFileSync(process.execPath,[path.join(root,'node_modules/electron-builder/out/cli/cli.js'),'--mac','dmg',`--${process.arch}`,'--publish','never'],{stdio:'inherit'})
