const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const { spawn } = require('node:child_process')
const { randomBytes } = require('node:crypto')
const path = require('node:path')
const fs = require('node:fs/promises')
const { pathToFileURL } = require('node:url')
app.commandLine.appendSwitch('disable-background-networking')
app.commandLine.appendSwitch('disable-component-update')
app.commandLine.appendSwitch('disable-domain-reliability')
app.commandLine.appendSwitch('disable-sync')
let backend, frontend, mainWindow
const token = randomBytes(32).toString('hex')
if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', () => { mainWindow?.show(); mainWindow?.focus() })
  app.whenReady().then(async () => {
    try {
      const root = path.resolve(__dirname, '..')
      const { serveFrontend } = await import(pathToFileURL(path.join(root, 'scripts/server.mjs')).href)
      frontend = await serveFrontend(path.join(root, 'dist'), token)
      const command = app.isPackaged
        ? path.join(process.resourcesPath, 'backend', 'medvision-backend', process.platform === 'win32' ? 'medvision-backend.exe' : 'medvision-backend')
        : path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
      const args = app.isPackaged ? [] : [path.join(root, 'backend/run_backend.py')]
      backend = spawn(command, args, { env: {...process.env, MEDVISION_TOKEN: token}, windowsHide: true, stdio: 'ignore' })
      backend.once('error', () => { dialog.showErrorBox('MedVision', 'Local runtime could not start.'); app.quit() })
      backend.once('exit', () => { if (!app.isQuitting) { dialog.showErrorBox('MedVision', 'Local imaging service stopped.'); app.quit() } })
      let ready = false
      for (let i = 0; i < 150; i++) {
        try {
          const response = await fetch('http://127.0.0.1:8000/api/v1/settings', {headers: {Authorization: `Bearer ${token}`}})
          if (response.ok) { ready = true; break }
        } catch {}
        await new Promise(r => setTimeout(r, 100))
      }
      if (!ready) throw new Error('Backend startup failed or port 8000 is occupied.')
      mainWindow = new BrowserWindow({ show: process.env.MEDVISION_HEADLESS_TEST !== '1', width: 1500, height: 960, minWidth: 1000, minHeight: 650, backgroundColor: '#090e16', title: 'MedVision', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false } })
      const validSender = event => event.sender === mainWindow.webContents && event.senderFrame?.url === 'http://127.0.0.1:3000/'
      ipcMain.handle('medvision:session', event => { if (!validSender(event)) throw new Error('Invalid sender'); return token })
      ipcMain.handle('medvision:choose-storage',async event=>{
        if(!validSender(event))throw new Error('Invalid sender')
        const result=await dialog.showOpenDialog(mainWindow,{title:'Choose local study storage',properties:['openDirectory','createDirectory']})
        return result.canceled?null:result.filePaths[0]||null
      })
      ipcMain.handle('medvision:save', async (event, name, bytes) => {
        if (!validSender(event) || !(bytes instanceof ArrayBuffer) || bytes.byteLength > 256 * 1024 * 1024) throw new Error('Invalid export')
        const result = await dialog.showSaveDialog(mainWindow, {defaultPath: path.basename(String(name))})
        if (result.canceled || !result.filePath) return false
        await fs.writeFile(result.filePath, Buffer.from(bytes))
        return true
      })
      mainWindow.webContents.setWindowOpenHandler(() => ({action: 'deny'}))
      mainWindow.webContents.on('will-navigate', (event, url) => { if (url !== 'http://127.0.0.1:3000/') event.preventDefault() })
      mainWindow.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
      mainWindow.webContents.session.webRequest.onBeforeRequest((details, callback) => {
        const allowed = details.url.startsWith('http://127.0.0.1:3000/') || details.url.startsWith('http://127.0.0.1:8000/') || details.url.startsWith('blob:http://127.0.0.1:3000/') || details.url.startsWith('data:') || details.url.startsWith('devtools:')
        callback({cancel: !allowed})
      })
      await mainWindow.loadURL('http://127.0.0.1:3000/')
      mainWindow.removeMenu()
    } catch (error) { dialog.showErrorBox('MedVision startup', error.message); app.quit() }
  })
  app.on('before-quit', () => { app.isQuitting = true; backend?.kill(); frontend?.close() })
  app.on('window-all-closed', () => app.quit())
}
