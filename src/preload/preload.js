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
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (patch) => ipcRenderer.invoke('config:set', patch),
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
  },
  progress: {
    onUpdate: (cb) => {
      const listener = (_e, payload) => cb(payload);
      ipcRenderer.on('progress:update', listener);
      return () => ipcRenderer.removeListener('progress:update', listener);
    }
  },
  logs: {
    onAppend: (cb) => {
      const listener = (_e, payload) => cb(payload);
      ipcRenderer.on('logs:append', listener);
      return () => ipcRenderer.removeListener('logs:append', listener);
    }
  }
  ,
  tasks: {
    cancel: (taskId) => ipcRenderer.invoke('tasks:cancel', taskId)
  }
});
