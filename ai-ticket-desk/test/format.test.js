import test from 'node:test';
import assert from 'node:assert/strict';
import { arrayToText, formatBytes, formatDateTime, nullableText, textToArray } from '../src/client/lib/format.js';

test('array textarea helpers convert one item per line', () => {
  assert.equal(arrayToText(['one', 'two']), 'one\ntwo');
  assert.deepEqual(textToArray(' one \n\n two\r\n three '), ['one', 'two', 'three']);
});

test('format helpers are API independent', () => {
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(nullableText('  '), null);
  assert.equal(nullableText('  hello  '), 'hello');
  assert.notEqual(formatDateTime('2026-06-11T10:00:00.000Z'), '-');
});
