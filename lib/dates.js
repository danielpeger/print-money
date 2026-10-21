export function lowerBound(sorted, value) {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function upperBound(sorted, value) {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function countSessionsInclusive(sessions, start, end) {
  if (!start || !end || end < start) return 0;
  return upperBound(sessions, end) - lowerBound(sessions, start);
}

export function calendarDaysBetween(start, end) {
  const ms = Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  return Math.round(ms / 86400000);
}

export function shiftYears(date, delta) {
  const [y, m, d] = date.split('-').map(Number);
  const year = y + delta;
  const dim = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const day = Math.min(d, dim);
  return `${year}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function floorCents(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.floor(amount * 100 + 1e-6) / 100;
}

export function roundPrice(amount) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function formatNumber(value, digits) {
  if (value == null || Number.isNaN(value)) return 'n/a';
  return Number(value).toFixed(digits);
}

export function formatPct(value, digits = 2) {
  if (value == null || Number.isNaN(value)) return 'n/a';
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatUsd(value) {
  if (value == null || Number.isNaN(value)) return 'n/a';
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}
