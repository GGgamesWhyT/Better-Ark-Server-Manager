const progress = require('./progressBus');

function parseAndEmit(taskId, raw) {
  if (!taskId || !raw) return;
  const text = String(raw);
  // Try several patterns: "37%", "progress: 28.72", "(bytesDone / bytesTotal)"
  let pct = null;
  const mPercent = text.match(/(?:^|\s)(\d{1,3})%/);
  const mProgress = text.match(/progress:\s*(\d+(?:\.\d+)?)/i);
  const mBytes = text.match(/\((\d+)\s*\/\s*(\d+)\)/);
  if (mPercent) pct = parseInt(mPercent[1], 10);
  else if (mProgress) pct = parseFloat(mProgress[1]);
  else if (mBytes) {
    const done = parseFloat(mBytes[1]);
    const total = parseFloat(mBytes[2]);
    if (total > 0) pct = (done / total) * 100;
  }
  const last = text.replace(/\r/g, '\n').trim().split('\n').pop();
  if (pct != null && isFinite(pct)) {
    pct = Math.max(0, Math.min(100, Math.round(pct)));
    progress.emit(taskId, { type: 'progress', percent: pct, message: last });
  } else if (/Update state|Downloading|Validating|verifying update/i.test(text)) {
    progress.emit(taskId, { type: 'message', message: last });
  }
}

module.exports = { parseAndEmit };
