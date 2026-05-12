const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  saveDialog: (defaultName) => ipcRenderer.invoke('save-dialog', defaultName)
});
