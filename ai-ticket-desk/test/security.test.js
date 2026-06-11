import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { assertPathInside, sanitizeOriginalName, validateMimeType } from '../src/server/security.js';
import { makeStoredName } from '../src/server/storage.js';

test('safe filename generation removes path traversal and keeps safe extension', () => {
  assert.equal(sanitizeOriginalName('../../secret ไทย.png'), 'secret _.png');
  const stored = makeStoredName({ originalName: '../../secret.png', mimeType: 'image/png' });
  assert.match(stored, /^[\w-]+\.png$/);
});

test('path traversal is rejected', () => {
  const parent = path.resolve('/tmp/ai-ticket-desk');
  assert.equal(assertPathInside(parent, path.join(parent, 'file.png')), path.join(parent, 'file.png'));
  assert.throws(() => assertPathInside(parent, '/tmp/evil.png'));
});

test('mime validation allows only supported files', () => {
  assert.equal(validateMimeType('image/png'), true);
  assert.equal(validateMimeType('application/pdf'), true);
  assert.equal(validateMimeType('text/html'), false);
});
