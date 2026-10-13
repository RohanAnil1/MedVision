const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('medvision', {
  session: () => ipcRenderer.invoke('medvision:session'),
  save: (name, bytes) => ipcRenderer.invoke('medvision:save', name, bytes),
})
