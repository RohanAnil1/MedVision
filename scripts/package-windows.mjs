import { execFileSync } from 'node:child_process'
import path from 'node:path'
if(process.platform!=='win32'||process.arch!=='x64')throw new Error('Windows packaging requires a Windows x64 build host.')
const root=process.cwd()
const run=(program,args)=>execFileSync(program,args,{stdio:'inherit',windowsHide:true})
run('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'scripts/build-backend.ps1')])
run(process.execPath,[path.join(root,'node_modules/typescript/bin/tsc'),'--noEmit'])
run(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'build'])
run(process.execPath,[path.join(root,'node_modules/electron-builder/out/cli/cli.js'),'--win','nsis','--x64','--publish','never'])
