/**
 * NYSE full-day closures. Sessions are weekdays that are not in this set.
 * One-off mourning closures are listed. Early closes are still sessions.
 */

const EXTRA_CLOSURES = new Set([
  '2018-12-05',
  '2025-01-09',
]);

function pad(n) {
  return String(n).padStart(2, '0');
}

function iso(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function civilDate(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day));
}

function weekday(year, month, day) {
  return civilDate(year, month, day).getUTCDay();
}

function nthWeekday(year, month, weekdayIndex, n) {
  const first = weekday(year, month, 1);
  const delta = (weekdayIndex - first + 7) % 7;
  return 1 + delta + (n - 1) * 7;
}

function lastWeekday(year, month, weekdayIndex) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lastDow = weekday(year, month, last);
  const delta = (lastDow - weekdayIndex + 7) % 7;
  return last - delta;
}

function observe(year, month, day) {
  const dow = weekday(year, month, day);
  if (dow === 6) {
    const prev = new Date(Date.UTC(year, month - 1, day - 1));
    return iso(prev.getUTCFullYear(), prev.getUTCMonth() + 1, prev.getUTCDate());
  }
  if (dow === 0) {
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    return iso(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
  }
  return iso(year, month, day);
}

/** Anonymous Gregorian algorithm. Returns the Easter Sunday civil date. */
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return civilDate(year, month, day);
}

const closureCache = new Map();

export function closuresForYear(year) {
  if (closureCache.has(year)) return closureCache.get(year);
  const days = new Set();
  days.add(observe(year, 1, 1));
  days.add(iso(year, 1, nthWeekday(year, 1, 1, 3)));
  days.add(iso(year, 2, nthWeekday(year, 2, 1, 3)));
  const easter = easterSunday(year);
  const goodFriday = new Date(easter.getTime() - 2 * 86400000);
  days.add(iso(goodFriday.getUTCFullYear(), goodFriday.getUTCMonth() + 1, goodFriday.getUTCDate()));
  days.add(iso(year, 5, lastWeekday(year, 5, 1)));
  if (year >= 2022) days.add(observe(year, 6, 19));
  days.add(observe(year, 7, 4));
  days.add(iso(year, 9, nthWeekday(year, 9, 1, 1)));
  days.add(iso(year, 11, nthWeekday(year, 11, 4, 4)));
  days.add(observe(year, 12, 25));
  for (const extra of EXTRA_CLOSURES) {
    if (extra.startsWith(String(year))) days.add(extra);
  }
  closureCache.set(year, days);
  return days;
}

export function isWeekendDate(date) {
  const [y, m, d] = date.split('-').map(Number);
  const dow = weekday(y, m, d);
  return dow === 0 || dow === 6;
}

export function isTradingDay(date) {
  if (isWeekendDate(date)) return false;
  const year = Number(date.slice(0, 4));
  if (closuresForYear(year).has(date)) return false;
  // A Saturday New Year is observed on the previous Friday, which is stored with the new year.
  if (closuresForYear(year + 1).has(date)) return false;
  return true;
}

export function previousTradingDay(date) {
  let [y, m, d] = date.split('-').map(Number);
  for (let i = 0; i < 12; i++) {
    const cursor = new Date(Date.UTC(y, m - 1, d - 1));
    y = cursor.getUTCFullYear();
    m = cursor.getUTCMonth() + 1;
    d = cursor.getUTCDate();
    const isoDate = iso(y, m, d);
    if (isTradingDay(isoDate)) return isoDate;
  }
  throw new Error(`No previous trading day before ${date}`);
}

export function nextTradingDay(date) {
  let [y, m, d] = date.split('-').map(Number);
  for (let i = 0; i < 12; i++) {
    const cursor = new Date(Date.UTC(y, m - 1, d + 1));
    y = cursor.getUTCFullYear();
    m = cursor.getUTCMonth() + 1;
    d = cursor.getUTCDate();
    const isoDate = iso(y, m, d);
    if (isTradingDay(isoDate)) return isoDate;
  }
  throw new Error(`No next trading day after ${date}`);
}

export function nyParts(instant, timeZone = 'America/New_York') {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const bag = {};
  for (const part of dtf.formatToParts(instant)) bag[part.type] = part.value;
  let hour = Number(bag.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour,
    minute: Number(bag.minute),
    second: Number(bag.second),
    date: `${bag.year}-${bag.month}-${pad(bag.day)}`,
  };
}

/** UTC instant for a New York wall-clock time on a civil date. */
export function zonedDateTimeToUtc(date, hour, minute, second = 0, timeZone = 'America/New_York') {
  const [y, m, d] = date.split('-').map(Number);
  const desired = Date.UTC(y, m - 1, d, hour, minute, second);
  let utc = desired;
  for (let i = 0; i < 3; i++) {
    const shown = nyParts(new Date(utc), timeZone);
    const shownAsUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, shown.second);
    const delta = shownAsUtc - desired;
    if (delta === 0) break;
    utc -= delta;
  }
  return new Date(utc);
}

export function nyDateFromIso(isoTimestamp) {
  return nyParts(new Date(isoTimestamp)).date;
}

/**
 * The cron is a wake-up. After 16:15 New York on a trading day it uses
 * today's completed bars. Before the cash open, and on a weekend or NYSE
 * holiday, it uses the previous regular session so a missed weekday job
 * can be rerun. It still waits out an open cash session: an in-progress
 * daily bar would fail the freshness check, and a market/day order would
 * fill at the live quote instead of the next regular open.
 */
export function classifyNow(now = new Date()) {
  const parts = nyParts(now);
  const mins = parts.hour * 60 + parts.minute;
  if (!isTradingDay(parts.date)) {
    return {
      action: 'run',
      reason: 'prior_session',
      sessionDate: previousTradingDay(parts.date),
      nyDate: parts.date,
    };
  }
  if (mins < 9 * 60 + 30) {
    return {
      action: 'run',
      reason: 'prior_session',
      sessionDate: previousTradingDay(parts.date),
      nyDate: parts.date,
    };
  }
  if (mins < 16 * 60 + 15) {
    return { action: 'skip', reason: 'session_not_closed', sessionDate: parts.date, nyDate: parts.date };
  }
  return { action: 'run', reason: 'session_closed', sessionDate: parts.date, nyDate: parts.date };
}
