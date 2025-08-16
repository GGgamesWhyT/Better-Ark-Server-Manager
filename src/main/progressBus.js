const { BrowserWindow } = require('electron');

function emit(taskId, payload) {
  try {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(w => w.webContents.send('progress:update', { taskId, ...payload }));
  } catch { /* no-op */ }
}

module.exports = { emit };
