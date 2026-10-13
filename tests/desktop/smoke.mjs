import { _electron as electron, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const root=process.cwd()
const temporary=await mkdtemp(path.join(tmpdir(),'medvision-desktop-test-'))
const python=path.join(root,'.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python')
execFileSync(python,[path.join(root,'scripts/prepare-browser-tests.py'),temporary],{stdio:'inherit'})
let app
try {
  const options={env:{...process.env,MEDVISION_DATA_DIR:path.join(temporary,'data'),MEDVISION_HEADLESS_TEST:'1'},args:process.argv.includes('--hardware')?[]:['--enable-unsafe-swiftshader']}
  if(process.argv.includes('--discrete'))options.args.push('--force_high_performance_gpu')
  if(process.argv.includes('--packaged')) {
    options.executablePath=path.join(root,'release','win-unpacked','MedVision.exe')
    options.env.PATH=path.join(process.env.SystemRoot||'C:\\Windows','System32')
  }
  else options.args.push(root)
  app=await electron.launch(options)
  const window=await app.firstWindow()
  const remote=[]
  app.context().on('request',request=>{const url=new URL(request.url());if(['http:','https:'].includes(url.protocol)&&url.hostname!=='127.0.0.1')remote.push(url.origin)})
  await expect(window.getByText('Synthetic Phantom',{exact:true})).toBeVisible({timeout:30000})
  await window.getByRole('button',{name:'CT Synthetic CT phantom 5 frames'}).click()
  await expect(window.getByText('Loading local image data…')).toBeHidden({timeout:30000})
  await expect(window.locator('.viewport-message.error')).toHaveCount(0)
  await window.getByRole('button',{name:'3D volume',exact:true}).click()
  await expect(window.getByText('Loading local image data…')).toBeHidden({timeout:30000})
  await expect(window.locator('.viewport-message.error')).toHaveCount(0)
  const isolated=await window.evaluate(()=>typeof window.require==='undefined'&&typeof window.process==='undefined')
  expect(isolated).toBe(true)
  expect(remote).toEqual([])
  await mkdir('test-results',{recursive:true})
  await window.screenshot({path:'test-results/desktop-smoke.png'})
  await window.getByRole('button',{name:'Oblique',exact:true}).click()
  await expect(window.getByText('Loading local image data…')).toBeHidden({timeout:30000})
  await expect(window.locator('.viewport-message.error')).toHaveCount(0)
  await window.getByRole('spinbutton',{name:'Oblique pitch'}).fill('25')
  await expect(window.getByText('Loading local image data…')).toBeHidden({timeout:30000})
  await expect(window.locator('.viewport-message.error')).toHaveCount(0)
  const graphics=await window.evaluate(()=>{
    const canvas=document.createElement('canvas');const gl=canvas.getContext('webgl2')
    if(!gl)return {webgl2:false}
    const debug=gl.getExtension('WEBGL_debug_renderer_info')
    const result={webgl2:true,renderer:debug?String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)):'Unavailable',version:String(gl.getParameter(gl.VERSION))}
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return result
  })
  const features=await app.evaluate(({app})=>app.getGPUFeatureStatus())
  await writeFile(process.argv.includes('--discrete')?'docs/graphics-windows-discrete.json':process.argv.includes('--hardware')?'docs/graphics-windows.json':'test-results/desktop-graphics.json',JSON.stringify({graphics,features,packaged:process.argv.includes('--packaged'),hardwareRequested:process.argv.includes('--hardware'),discreteRequested:process.argv.includes('--discrete'),limits:'Single-host smoke test on a synthetic five-slice phantom; no full GPU/performance matrix qualification.'},null,2)+'\n')
  console.log(`Desktop ${process.argv.includes('--packaged')?'packaged':'development'} smoke passed: archive, DICOM stack, volume, renderer isolation.`)
} finally {
  await app?.close()
  await new Promise(resolve=>setTimeout(resolve,500))
  await rm(temporary,{recursive:true,force:true})
}
