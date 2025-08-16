const { spawn } = require('child_process');

const tasks = new Map(); // taskId -> { child, cleanup }
const canceled = new Set(); // taskIds that were requested to cancel

function register(taskId, child, cleanup) {
  if (!taskId || !child) return;
  const existing = tasks.get(taskId);
  const finalCleanup = cleanup !== undefined ? cleanup : (existing ? existing.cleanup : undefined);
  tasks.set(taskId, { child, cleanup: finalCleanup });
  const clear = () => { tasks.delete(taskId); };
  child.on('close', clear);
  child.on('exit', clear);
  child.on('error', clear);
}

function addCleanup(taskId, cleanup) {
  const t = tasks.get(taskId);
  if (t) t.cleanup = cleanup;
  else tasks.set(taskId, { child: null, cleanup });
}

async function cancel(taskId) {
  const t = tasks.get(taskId);
  if (taskId) canceled.add(taskId);
  if (!t) return { ok: true };
  try {
    if (t.child && t.child.pid) {
      if (process.platform === 'win32') {
  try { spawn('taskkill', ['/PID', String(t.child.pid), '/T', '/F']); } catch {}
        // Fallback: steamcmd may respawn during self-update; ensure process image is terminated
        setTimeout(() => { try { spawn('taskkill', ['/IM', 'steamcmd.exe', '/F']); } catch {} }, 200);
      } else {
        try { t.child.kill('SIGINT'); } catch {}
        setTimeout(() => { try { t.child.kill('SIGKILL'); } catch {} }, 1000);
      }
    } else if (process.platform === 'win32') {
      // No child yet (race). Still try to terminate any steamcmd.exe soon after cancel.
      setTimeout(() => { try { spawn('taskkill', ['/IM', 'steamcmd.exe', '/F']); } catch {} }, 100);
    }
  } finally {
    if (t.cleanup) {
      try { t.cleanup(); } catch {}
    }
    tasks.delete(taskId);
  }
  return { ok: true };
}

function isCanceled(taskId) {
  return canceled.has(taskId);
}

function consumeCanceled(taskId) {
  canceled.delete(taskId);
}

module.exports = { register, addCleanup, cancel, isCanceled, consumeCanceled };
