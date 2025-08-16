const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { ensureInstalled: ensureSteamcmdInstalled } = require('./steamcmdManager');
const { addModById, listInstalledMods, removeMod, getModsState, setModsState, writeActiveMods } = require('./modManager');
const { installServer, updateServer, startServer, stopServer, status: serverStatus } = require('./serverManager');

const store = new Store({
  name: 'settings',
  defaults: {
    steamcmdPath: '',
    serverInstallPath: '',
    branch: 'stable',
    mods: [],
    serverConfig: {},
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  win.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC: settings basic
ipcMain.handle('settings:get', async (_e) => store.store);
ipcMain.handle('settings:set', async (_e, patch) => {
  store.set(patch);
  return store.store;
});

// Directory picker
ipcMain.handle('system:chooseDirectory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (canceled || !filePaths || !filePaths.length) return null;
  return filePaths[0];
});

// SteamCMD ensureInstalled
ipcMain.handle('steamcmd:ensure', async () => {
  return ensureSteamcmdInstalled(store);
});

// Server management
ipcMain.handle('server:install', async (_e, dir, branch, betaPassword) => installServer(store, dir, branch, betaPassword));
ipcMain.handle('server:update', async () => updateServer(store));
ipcMain.handle('server:start', async () => startServer(store));
ipcMain.handle('server:stop', async () => stopServer());
ipcMain.handle('server:status', async () => serverStatus());

// Mods by ID
ipcMain.handle('mods:addById', async (_e, id) => addModById(store, id));
ipcMain.handle('mods:list', async () => listInstalledMods(store));
ipcMain.handle('mods:remove', async (_e, id) => removeMod(store, id));
ipcMain.handle('mods:getState', async () => getModsState(store));
ipcMain.handle('mods:setState', async (_e, state) => setModsState(store, state));
ipcMain.handle('mods:writeActiveMods', async () => writeActiveMods(store));
