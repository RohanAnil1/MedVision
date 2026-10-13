import { execFileSync } from 'node:child_process'
import path from 'node:path'
const root=process.cwd()
const python=path.join(root,'.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python')
const run=(program,args)=>execFileSync(program,args,{stdio:'inherit',windowsHide:true})
run(python,['-m','pytest','backend/tests','-q'])
run(process.execPath,[path.join(root,'node_modules/vitest/vitest.mjs'),'run','frontend/lib'])
run(process.execPath,[path.join(root,'node_modules/typescript/bin/tsc'),'--noEmit'])
run(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'build'])
run(process.execPath,[path.join(root,'node_modules/@playwright/test/cli.js'),'test'])
run(process.execPath,['tests/desktop/smoke.mjs'])
