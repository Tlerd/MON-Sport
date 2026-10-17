// Drives the real app through the named flows and writes the evidence to verify-output/.
// Usage: node .agents/skills/verify-flow/scripts/run.mjs [flow ...] [--target local|live] [--base-url URL] [--headed]
// Exit code: 0 when no step failed (a SKIP is not a failure), 1 when a step failed, 2 when the app is not reachable.

import { spawnSync } from 'node:child_process';
import ownerDecide from './owner-decide.mjs';
import phoneBooking from './phone-booking.mjs';
import playerRequest from './player-request.mjs';
import { parseOptions, ROOT, Run } from './lib.mjs';

const FLOWS = { 'player-request': playerRequest, 'owner-decide': ownerDecide, 'phone-booking': phoneBooking };

const opts = parseOptions(process.argv.slice(2));
const names = opts.flows.length ? opts.flows : Object.keys(FLOWS);
const unknown = names.filter((n) => !FLOWS[n]);
if (unknown.length) {
  console.error(`Unknown flow: ${unknown.join(', ')}. Flows: ${Object.keys(FLOWS).join(', ')}`);
  process.exit(2);
}

const health = await fetch(`${opts.baseUrl}/api/health`).then((r) => r.json(), (e) => ({ error: e.cause?.code ?? e.message }));
if (health.status !== 'ok') {
  console.error(`${opts.baseUrl}/api/health answered ${JSON.stringify(health)}.`);
  if (opts.target === 'local') console.error('Start the database (pnpm db:start), the API (pnpm dev:api), and the web app (pnpm dev:web).');
  process.exit(2);
}

const run = new Run(opts);
run.commit = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
await run.start();
try {
  for (const name of names) {
    try {
      await FLOWS[name](run);
    } catch (error) {
      // A step already reported its own failure. Anything else failed outside a step.
      if (!error.reported) {
        console.log(`FAIL ${name}: ${error.message.split('\n')[0]}`);
        run.results.push({ n: '--', flow: name, name: 'outside a step', status: 'FAIL', detail: error.message.split('\n')[0], file: run.dir });
      }
    }
  }
} finally {
  await run.close();
}

const report = run.writeReport();
const failed = run.results.filter((r) => r.status === 'FAIL').length;
console.log(`${failed ? 'FAILED' : 'PASSED'}: ${run.results.length} steps, ${failed} failed. Evidence: ${report}`);
process.exit(failed ? 1 : 0);
