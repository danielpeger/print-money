import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyNow, isTradingDay, nextTradingDay, zonedDateTimeToUtc } from '../lib/calendar.js';

test('known NYSE closures and the paper start session', () => {
  assert.equal(isTradingDay('2019-04-19'), false);
  assert.equal(isTradingDay('2020-04-10'), false);
  assert.equal(isTradingDay('2024-03-29'), false);
  assert.equal(isTradingDay('2026-04-03'), false);
  assert.equal(isTradingDay('2026-01-01'), false);
  assert.equal(isTradingDay('2026-01-19'), false);
  assert.equal(isTradingDay('2026-07-03'), false);
  assert.equal(isTradingDay('2026-11-26'), false);
  assert.equal(isTradingDay('2026-12-25'), false);
  assert.equal(isTradingDay('2021-12-31'), false);
  assert.equal(isTradingDay('2022-06-20'), false);
  assert.equal(isTradingDay('2018-12-05'), false);
  assert.equal(isTradingDay('2025-01-09'), false);
  assert.equal(isTradingDay('2019-05-16'), true);
  assert.equal(isTradingDay('2026-10-12'), true);
  assert.equal(nextTradingDay('2026-10-12'), '2026-10-13');
});

test('22:00 UTC is after the cash close in winter and summer', () => {
  assert.deepEqual(classifyNow(new Date('2026-01-15T22:00:00Z')), {
    action: 'run',
    reason: 'session_closed',
    sessionDate: '2026-01-15',
    nyDate: '2026-01-15',
  });
  assert.equal(classifyNow(new Date('2026-07-15T22:00:00Z')).action, 'run');
  assert.equal(classifyNow(new Date('2026-10-12T22:00:00Z')).sessionDate, '2026-10-12');
  assert.equal(classifyNow(new Date('2026-01-15T21:16:00Z')).action, 'run');
  assert.equal(classifyNow(new Date('2026-01-15T21:16:00Z')).reason, 'session_closed');
});

test('before the cash open uses the previous session', () => {
  assert.deepEqual(classifyNow(new Date('2026-01-15T12:00:00Z')), {
    action: 'run',
    reason: 'prior_session',
    sessionDate: '2026-01-14',
    nyDate: '2026-01-15',
  });
  assert.equal(classifyNow(new Date('2026-01-15T14:29:00Z')).sessionDate, '2026-01-14');
  assert.equal(classifyNow(new Date('2026-01-15T14:30:00Z')).reason, 'session_not_closed');
  assert.equal(classifyNow(new Date('2026-01-15T20:30:00Z')).reason, 'session_not_closed');
  assert.equal(classifyNow(new Date('2026-01-15T21:10:00Z')).reason, 'session_not_closed');
  assert.equal(classifyNow(new Date('2026-07-15T12:00:00Z')).sessionDate, '2026-07-14');
  assert.equal(classifyNow(new Date('2026-10-12T12:00:00Z')).sessionDate, '2026-10-09');
  assert.equal(classifyNow(new Date('2026-01-20T13:00:00Z')).sessionDate, '2026-01-16');
});

test('a weekend or holiday wake-up uses the latest completed session', () => {
  assert.deepEqual(classifyNow(new Date('2026-01-17T17:00:00Z')), {
    action: 'run',
    reason: 'prior_session',
    sessionDate: '2026-01-16',
    nyDate: '2026-01-17',
  });
  assert.deepEqual(classifyNow(new Date('2026-01-18T17:00:00Z')), {
    action: 'run',
    reason: 'prior_session',
    sessionDate: '2026-01-16',
    nyDate: '2026-01-18',
  });
  assert.deepEqual(classifyNow(new Date('2026-11-26T22:00:00Z')), {
    action: 'run',
    reason: 'prior_session',
    sessionDate: '2026-11-25',
    nyDate: '2026-11-26',
  });
  assert.equal(nextTradingDay('2026-01-16'), '2026-01-20');
});

test('opening quote window is 09:30 New York', () => {
  assert.equal(zonedDateTimeToUtc('2026-01-15', 9, 30).toISOString(), '2026-01-15T14:30:00.000Z');
  assert.equal(zonedDateTimeToUtc('2026-07-15', 9, 30).toISOString(), '2026-07-15T13:30:00.000Z');
});
