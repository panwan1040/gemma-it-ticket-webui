import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const knowledgeDir = path.join(root, 'knowledge');
const outFile = path.join(root, 'data', 'rag-index.json');

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    if (entry.isFile() && entry.name.endsWith('.md')) files.push(full);
  }
  return files;
}

function tokenize(text) {
  return [...new Set(text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 2))];
}

const files = await walk(knowledgeDir).catch(() => []);
const docs = [];

for (const file of files) {
  const content = await fs.readFile(file, 'utf8');
  const title = content.match(/^#\s+(.+)$/m)?.[1] || path.basename(file, '.md');
  docs.push({
    path: path.relative(root, file),
    title,
    content,
    tokens: tokenize(`${title}\n${content}`)
  });
}

await fs.mkdir(path.dirname(outFile), { recursive: true });
await fs.writeFile(outFile, JSON.stringify({ generatedAt: new Date().toISOString(), docs }, null, 2));
console.log(`Indexed ${docs.length} knowledge notes -> ${outFile}`);
