const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

// Poll .log/.txt files in given directories and stream appended bytes.
function startTail(dirs, onData, intervalMs = 300) {
  const folders = Array.from(new Set((dirs || []).filter(Boolean)));
  const lastSizes = new Map(); // key: filePath, value: size
  let timer = null;
  let stopped = false;

  async function scanOnce() {
    if (stopped) return;
    for (const dir of folders) {
      try {
        const entries = await fsp.readdir(dir, { withFileTypes: true });
        for (const e of entries) {
          if (!e.isFile()) continue;
          const ext = path.extname(e.name).toLowerCase();
          if (ext !== '.log' && ext !== '.txt') continue;
          const file = path.join(dir, e.name);
          let stat;
          try { stat = await fsp.stat(file); } catch { continue; }
          const prev = lastSizes.get(file) ?? 0;
          const size = stat.size;
          if (size > prev) {
            try {
              const stream = fs.createReadStream(file, { start: prev, end: size - 1, encoding: 'utf8' });
              for await (const chunk of stream) {
                onData(chunk);
              }
            } catch { /* ignore read errors */ }
            lastSizes.set(file, size);
          } else if (!lastSizes.has(file)) {
            lastSizes.set(file, size);
          }
        }
      } catch { /* ignore dir errors */ }
    }
  }

  timer = setInterval(() => { scanOnce(); }, intervalMs);
  // kick off immediately
  scanOnce();

  return () => {
    stopped = true;
    if (timer) clearInterval(timer);
  };
}

module.exports = { startTail };
