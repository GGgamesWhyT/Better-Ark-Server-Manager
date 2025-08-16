const { BrowserWindow } = require('electron');

function emit(source, message) {
  try {
    const payload = { source, message, ts: Date.now() };
    BrowserWindow.getAllWindows().forEach(w => w.webContents.send('logs:append', payload));
  } catch { /* no-op */ }
}

module.exports = { emit };
