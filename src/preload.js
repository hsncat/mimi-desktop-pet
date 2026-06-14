const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mimiPet', {
  startDrag: () => ipcRenderer.invoke('pet:start-drag'),
  drag: () => ipcRenderer.invoke('pet:drag'),
  endDrag: () => ipcRenderer.invoke('pet:end-drag'),
  close: () => ipcRenderer.invoke('pet:close')
});
