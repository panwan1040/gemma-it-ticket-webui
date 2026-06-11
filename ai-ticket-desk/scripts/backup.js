import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { config } from '../src/server/config.js';
import { auditLog } from '../src/server/audit.js';
import { getDb } from '../src/server/db.js';

function stamp() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function copyDir(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (entry.name === 'backups') continue;
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}

getDb();
const backupDir = path.join(config.paths.dataDir, 'backups');
fs.mkdirSync(backupDir, { recursive: true });

const baseName = `ai-ticket-desk-${stamp()}`;
const archivePath = path.join(backupDir, `${baseName}.tar.gz`);
const tar = spawnSync('tar', ['-czf', archivePath, '--exclude', 'backups', '-C', config.paths.dataDir, '.'], {
  stdio: 'pipe'
});

if (tar.status === 0) {
  auditLog({ action: 'backup.created', targetType: 'backup', targetId: path.basename(archivePath), success: true });
  console.log(`Backup created: ${archivePath}`);
} else {
  const folderPath = path.join(backupDir, baseName);
  copyDir(config.paths.dataDir, folderPath);
  auditLog({ action: 'backup.created', targetType: 'backup', targetId: path.basename(folderPath), success: true, detail: { fallback: 'folder-copy' } });
  console.log(`tar/gzip was unavailable. Folder backup created: ${folderPath}`);
}
