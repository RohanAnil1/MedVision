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
  await expect(page.locator('.metadata')).toContainText('Synthetic^Phantom')
  await page.getByRole('button',{name:'Metadata',exact:true}).click()
  await page.getByRole('button',{name:'Axial',exact:true}).click()
  await expect(page.getByText('Loading local image data…')).toBeHidden({timeout:30000})
  await expect(page.locator('.viewport-message.error')).toHaveCount(0)
  await expect.poll(() => visibleImagePixels(page)).toBeGreaterThan(1000)
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
  await page.reload()
  await expect(page.getByText('Synthetic Phantom', {exact:true})).toBeVisible()
  expect(remote).toEqual([])
  expect(failures).toEqual([])
})
