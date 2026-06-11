import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createMemoryRateLimiter, isValidBasicAuth, parseBasicAuth } from '../src/server/security.js';

test('Basic Auth parser and validator work', () => {
  const header = `Basic ${Buffer.from('admin:secret').toString('base64')}`;
  assert.deepEqual(parseBasicAuth(header), { username: 'admin', password: 'secret' });
  assert.equal(isValidBasicAuth(header, 'admin:secret'), true);
  assert.equal(isValidBasicAuth(header, 'admin:other'), false);
  assert.equal(parseBasicAuth('Bearer nope'), null);
});

test('rate limiter returns Thai friendly 429', () => {
  const middleware = createMemoryRateLimiter({ windowMs: 60_000, max: 1, action: 'test' });
  const req = { ip: '127.0.0.1', socket: {} };
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
  let nextCount = 0;
  middleware(req, res, () => nextCount++);
  middleware(req, res, () => nextCount++);
  assert.equal(nextCount, 1);
  assert.equal(res.statusCode, 429);
  assert.equal(res.body.error, 'RATE_LIMITED');
  assert.match(res.body.message, /ส่งคำขอถี่เกินไป/);
});

test('production refuses unsafe ADMIN_AUTH', () => {
  const result = spawnSync(
    process.execPath,
    ['-e', "import('./src/server/config.js').catch((error) => { console.error(error.message); process.exit(1); })"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'production',
        ADMIN_AUTH: 'admin:change-me'
      },
      encoding: 'utf8'
    }
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ADMIN_AUTH/);
});
