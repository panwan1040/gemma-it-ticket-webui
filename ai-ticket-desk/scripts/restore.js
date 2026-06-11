import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { config } from '../src/server/config.js';
import { auditLog } from '../src/server/audit.js';
import { getDb } from '../src/server/db.js';

const backupPath = process.argv[2];
const yes = process.argv.includes('--yes');

if (!backupPath) {
  console.error('Usage: npm run restore -- <backup-path> --yes');
  process.exit(1);
}

const resolvedBackup = path.resolve(backupPath);
if (!fs.existsSync(resolvedBackup)) {
  console.error(`Backup not found: ${resolvedBackup}`);
  process.exit(1);
}

if (!yes) {
  console.error('Restore refuses to overwrite data unless --yes is provided.');
  console.error(`This will replace contents under: ${config.paths.dataDir}`);
  process.exit(1);
}

const restoreTarget = config.paths.dataDir;
const safetyCopy = `${restoreTarget}.before-restore-${Date.now()}`;

console.warn(`Restoring ${resolvedBackup}`);
console.warn(`Current data will be moved to ${safetyCopy}`);

fs.mkdirSync(path.dirname(restoreTarget), { recursive: true });
if (fs.existsSync(restoreTarget)) {
  fs.renameSync(restoreTarget, safetyCopy);
}
fs.mkdirSync(restoreTarget, { recursive: true });

try {
  const stat = fs.statSync(resolvedBackup);
  if (stat.isDirectory()) {
    copyDir(resolvedBackup, restoreTarget);
  } else {
    const tar = spawnSync('tar', ['-xzf', resolvedBackup, '-C', restoreTarget], { stdio: 'inherit' });
    if (tar.status !== 0) throw new Error('Could not extract backup with tar.');
  }
  getDb();
  auditLog({ action: 'restore.completed', targetType: 'backup', targetId: path.basename(resolvedBackup), success: true });
  console.log('Restore completed.');
} catch (error) {
  fs.rmSync(restoreTarget, { recursive: true, force: true });
  if (fs.existsSync(safetyCopy)) fs.renameSync(safetyCopy, restoreTarget);
  getDb();
  auditLog({ action: 'restore.failed', targetType: 'backup', targetId: path.basename(resolvedBackup), success: false, detail: { reason: error.message } });
  console.error(`Restore failed: ${error.message}`);
  process.exit(1);
}

function copyDir(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}
