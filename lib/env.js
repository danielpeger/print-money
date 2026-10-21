import { existsSync, readFileSync } from 'node:fs';

export function loadEnv(cwd = process.cwd()) {
  for (const name of ['.env.local', '.env']) {
    const path = `${cwd}/${name}`;
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

const SECRET_KEY = /api[_-]?key|secret|authorization|token|password|bearer|resend/i;

export function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, inner] of Object.entries(value)) {
      out[key] = SECRET_KEY.test(key) ? '[redacted]' : redact(inner);
    }
    return out;
  }
  if (typeof value === 'string' && /^(PK|sb_secret_|sk_|re_)/.test(value)) return '[redacted]';
  return value;
}
