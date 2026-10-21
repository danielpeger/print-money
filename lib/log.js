import { redact } from './env.js';

export function log(level, fields) {
  const row = redact({
    time: new Date().toISOString(),
    level,
    ...fields,
  });
  console.log(JSON.stringify(row));
}
