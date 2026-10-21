import { loadEnv } from '../lib/env.js';
import { executeRun } from '../lib/run.js';

loadEnv();

const result = await executeRun({ dryRun: process.argv.includes('--dry-run') });
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
