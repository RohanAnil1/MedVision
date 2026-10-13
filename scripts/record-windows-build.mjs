import {createHash} from 'node:crypto'
import {readFile,writeFile,stat} from 'node:fs/promises'
import path from 'node:path'
const files=['release/MedVision Setup 0.1.0.exe','release/win-unpacked/MedVision.exe','release/win-unpacked/resources/app.asar','release/win-unpacked/resources/backend/medvision-backend/medvision-backend.exe']
const artifacts=[]
for(const file of files){const bytes=await readFile(file);const info=await stat(file);artifacts.push({file,size_bytes:bytes.byteLength,sha256:createHash('sha256').update(bytes).digest('hex'),built_at:info.mtime.toISOString()})}
await writeFile('docs/windows-build.json',JSON.stringify({version:'0.1.0',platform:'Windows x64',signed:false,artifacts,qualification:'Packaged EXE smoke tested with development runtimes removed from PATH; clean-machine installer and physical GPU matrix remain pending.'},null,2)+'\n')
console.log('Recorded Windows artifact hashes and qualification limits.')
