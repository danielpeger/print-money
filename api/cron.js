import { searchParam } from '../lib/request.js';
import { executeRun } from '../lib/run.js';

function unauthorized(res) {
  res.statusCode = 401;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ error: 'unauthorized' }));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'method_not_allowed' }));
    return;
  }
  const secret = process.env.CRON_SECRET;
  const header = req.headers.authorization || '';
  if (!secret || header !== `Bearer ${secret}`) {
    unauthorized(res);
    return;
  }
  const dryRun = searchParam(req, 'dry_run') === '1';
  const result = await executeRun({ dryRun });
  res.statusCode = result.ok ? 200 : 500;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(result));
}
