const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch) => ipcRenderer.invoke('settings:set', patch),
  },
  steamcmd: {
    ensure: () => ipcRenderer.invoke('steamcmd:ensure'),
  },
  server: {
    install: (dir, branch, betaPassword) => ipcRenderer.invoke('server:install', dir, branch, betaPassword),
    update: () => ipcRenderer.invoke('server:update'),
    start: () => ipcRenderer.invoke('server:start'),
    stop: () => ipcRenderer.invoke('server:stop'),
    status: () => ipcRenderer.invoke('server:status'),
  },
  mods: {
    addById: (id) => ipcRenderer.invoke('mods:addById', id),
    list: () => ipcRenderer.invoke('mods:list'),
    remove: (id) => ipcRenderer.invoke('mods:remove', id),
    getState: () => ipcRenderer.invoke('mods:getState'),
    setState: (state) => ipcRenderer.invoke('mods:setState', state),
    writeActiveMods: () => ipcRenderer.invoke('mods:writeActiveMods'),
  },
  system: {
    chooseDirectory: () => ipcRenderer.invoke('system:chooseDirectory'),
  }
});
