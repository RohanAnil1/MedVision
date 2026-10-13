import { test, expect } from '@playwright/test'

async function visibleImagePixels(page: import('@playwright/test').Page) {
  return page.locator('.render-surface canvas').evaluate(canvas => {
    const original = canvas as HTMLCanvasElement
    const copy = document.createElement('canvas'); copy.width = original.width; copy.height = original.height
    const context = copy.getContext('2d')!; context.drawImage(original,0,0)
    const pixels = context.getImageData(0,0,copy.width,copy.height).data
    let visible = 0
    for(let i=0;i<pixels.length;i+=4) if (pixels[i]>10 || pixels[i+1]>10 || pixels[i+2]>10) visible++
    return visible
  })
}

test('real DICOM stack, MPR, volume and restart stay on loopback', async ({page, context}) => {
  const remote: string[] = []
  const failures: string[] = []
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (['http:', 'https:'].includes(url.protocol) && url.hostname !== '127.0.0.1') {remote.push(url.origin);await route.abort()}
    else await route.continue()
  })
  page.on('pageerror', error => failures.push(error.message))
  await page.goto('/')
  await page.evaluate(async () => {await fetch('/bootstrap', {method:'POST',body:new URLSearchParams({code:'browser-test-bootstrap'}),redirect:'manual'})})
  await page.reload()
  await expect(page.getByText('Synthetic Phantom', {exact:true})).toBeVisible()
  await page.getByRole('button',{name:'CT Synthetic CT phantom 5 frames'}).click()
  await expect(page.locator('.viewport-controls')).toBeVisible()
  await expect(page.getByText('Loading local image data…')).toBeHidden({timeout:30000})
  await expect(page.locator('.viewport-message.error')).toHaveCount(0)
  await expect(page.locator('.render-surface canvas')).toHaveCount(1)
  await expect.poll(() => visibleImagePixels(page)).toBeGreaterThan(1000)
  const slice=page.getByRole('slider',{name:'Slice'})
  await slice.fill('3')
  await expect(page.locator('.viewport-controls')).toContainText('4 / 5')
  await page.getByRole('combobox',{name:'Window preset'}).selectOption('-600,1500')
  await page.getByRole('button',{name:'Rotate 90°'}).click()
  await page.getByRole('button',{name:'Metadata',exact:true}).click()
  await page.getByRole('button',{name:'Saved measurements',exact:true}).click()
  await page.getByRole('button',{name:'Length',exact:true}).click()
  const bounds=await page.locator('.render-surface').boundingBox()
  if(!bounds) throw new Error('Viewport missing')
  const x=bounds.x+bounds.width/2, y=bounds.y+bounds.height/2
  await page.mouse.move(x,y)
  await page.mouse.down()
  await page.mouse.move(x+100,y,{steps:10})
  await page.mouse.up()
  await expect(page.locator('.measurement-item')).toContainText('length')
  await expect(page.locator('.measurement-item')).toContainText('mm')
  const download=page.waitForEvent('download')
  await page.getByRole('button',{name:'PDF',exact:true}).click()
  expect((await download).suggestedFilename()).toBe('MedVision-report.pdf')
  await page.getByRole('button',{name:'Saved measurements',exact:true}).click()
  await expect(page.locator('.metadata')).toContainText('Synthetic^Phantom')
  await page.getByRole('button',{name:'Metadata',exact:true}).click()
  await page.getByRole('button',{name:'Axial',exact:true}).click()
  await expect(page.getByText('Loading local image data…')).toBeHidden({timeout:30000})
  await expect(page.locator('.viewport-message.error')).toHaveCount(0)
  await expect.poll(() => visibleImagePixels(page)).toBeGreaterThan(1000)
  for(const projection of ['mip','aip','minip','slice']){
    await page.getByRole('combobox',{name:'Projection'}).selectOption(projection)
    await expect(page.locator('.viewport-message.error')).toHaveCount(0)
    if(projection!=='minip')await expect.poll(()=>visibleImagePixels(page)).toBeGreaterThan(1000)
  }
  await page.getByRole('button',{name:'3D volume',exact:true}).click()
  await expect(page.getByText('Loading local image data…')).toBeHidden({timeout:30000})
  await expect(page.locator('.viewport-message.error')).toHaveCount(0)
  await expect.poll(() => visibleImagePixels(page)).toBeGreaterThan(1000)
  await page.screenshot({path:'test-results/workstation-volume.png'})
  await page.getByRole('button',{name:'2D stack',exact:true}).click()
  await expect(page.getByText('Loading local image data…')).toBeHidden({timeout:30000})
  await page.getByLabel('CPU 2D').check()
  await expect(page.getByText('Loading local image data…')).toBeHidden({timeout:30000})
  await expect(page.locator('.viewport-message.error')).toHaveCount(0)
  await expect.poll(() => visibleImagePixels(page)).toBeGreaterThan(1000)
  await page.screenshot({path:'test-results/workstation-stack.png'})
  await page.getByRole('button',{name:'Coronal',exact:true}).click()
  await expect(page.getByText('Loading local image data…')).toBeHidden({timeout:30000})
  await expect(page.locator('.viewport-message.error')).toHaveCount(0)
  await expect.poll(()=>visibleImagePixels(page)).toBeGreaterThan(1000)
  for(const projection of ['mip','aip']){
    await page.getByRole('combobox',{name:'Projection'}).selectOption(projection)
    await expect(page.getByText('Loading local image data…')).toBeHidden({timeout:30000})
    await expect.poll(()=>visibleImagePixels(page)).toBeGreaterThan(1000)
  }
  await page.getByRole('combobox',{name:'Projection'}).selectOption('minip')
  await expect(page.getByText('Loading local image data…')).toBeHidden({timeout:30000})
  await expect(page.locator('.viewport-message.error')).toHaveCount(0)
  await page.getByRole('button',{name:'Oblique',exact:true}).click()
  await expect(page.getByText('Loading local image data…')).toBeHidden({timeout:30000})
  await expect.poll(()=>visibleImagePixels(page)).toBeGreaterThan(1000)
  await page.getByRole('spinbutton',{name:'Oblique pitch'}).fill('30')
  await expect(page.getByText('Loading local image data…')).toBeHidden({timeout:30000})
  await expect(page.locator('.viewport-message.error')).toHaveCount(0)
  await expect.poll(()=>visibleImagePixels(page)).toBeGreaterThan(1000)
  const pngDownload=page.waitForEvent('download')
  await page.getByRole('button',{name:'Export PNG',exact:true}).click()
  expect((await pngDownload).suggestedFilename()).toBe('MedVision-reconstruction.png')
  await page.screenshot({path:'test-results/workstation-oblique.png'})
  await page.reload()
  await expect(page.getByText('Synthetic Phantom', {exact:true})).toBeVisible()
  await page.getByRole('button',{name:'CT Synthetic CT phantom 5 frames'}).click()
  await page.getByRole('button',{name:'Saved measurements',exact:true}).click()
  await expect(page.locator('.measurement-item')).toContainText('length')
  await page.getByRole('button',{name:'Saved measurements',exact:true}).click()
  for (const description of ['RLE phantom','JPEG-LS phantom','JPEG2000 phantom']) {
    await page.getByRole('button',{name:`CT ${description} 1 frames`}).click()
    await expect(page.getByText('Loading local image data…')).toBeHidden({timeout:30000})
    await expect(page.locator('.viewport-message.error')).toHaveCount(0)
    await expect.poll(() => visibleImagePixels(page)).toBeGreaterThan(1000)
  }
  expect(remote).toEqual([])
  expect(failures).toEqual([])
})
