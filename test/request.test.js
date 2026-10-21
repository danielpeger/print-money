import assert from 'node:assert/strict';
import test from 'node:test';
import { searchParam } from '../lib/request.js';

test('dry_run comes from the WHATWG query string, not req.query', () => {
  assert.equal(searchParam({ url: '/api/cron?dry_run=1' }, 'dry_run'), '1');
  assert.equal(searchParam({ url: '/api/cron' }, 'dry_run'), null);
  assert.equal(searchParam({ url: '/api/cron?dry_run=0' }, 'dry_run'), '0');
  assert.equal(
    searchParam({ url: '/api/cron', query: { dry_run: '1' } }, 'dry_run'),
    null,
  );
});

test('a relative request URL still parses', () => {
  assert.equal(searchParam({ url: '/api/cron?foo=bar&dry_run=1' }, 'foo'), 'bar');
  assert.equal(searchParam({}, 'dry_run'), null);
});
