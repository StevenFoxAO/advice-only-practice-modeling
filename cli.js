#!/usr/bin/env node
'use strict';
/*
 * Command-line runner.
 *
 *   node cli.js examples/mixed-practice.json     formatted report
 *   node cli.js my-practice.json --json          full result as JSON
 *   node cli.js --template > my-practice.json    starter scenario to edit
 */
const fs = require('node:fs');
const { evaluate, MODELS, MODEL_LABELS } = require('./src/model.js');
const presets = require('./src/presets.js');

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const file = args.find((a) => !a.startsWith('--'));

if (flags.has('--help') || (!file && !flags.has('--template'))) {
  console.log([
    'Usage:',
    '  node cli.js <scenario.json>          Print a formatted report',
    '  node cli.js <scenario.json> --json   Print the full result as JSON',
    '  node cli.js --template               Print a starter scenario to edit',
    '',
    'Examples live in examples/. Field definitions are in docs/METHODOLOGY.md.'
  ].join('\n'));
  process.exit(file || flags.has('--help') ? 0 : 1);
}

if (flags.has('--template')) {
  console.log(JSON.stringify(presets['mixed-practice'], null, 2));
  process.exit(0);
}

let scenario;
try {
  scenario = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (err) {
  console.error(`Could not read ${file}: ${err.message}`);
  process.exit(1);
}

const r = evaluate(scenario);

if (flags.has('--json')) {
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.ok ? 0 : 2);
}

if (!r.ok) {
  console.error('The scenario has input errors:');
  r.errors.forEach((e) => console.error(`  - ${e.message}`));
  process.exit(2);
}

const usd = (x) => (x === null ? 'n/a' : (x < 0 ? '-' : '') + '$' + Math.round(Math.abs(x)).toLocaleString('en-US'));
const rate = (x) => (x === null ? 'n/a' : usd(x) + '/hr');
const int = (x) => (x === null ? 'not reachable' : String(x));
const pad = (s, w) => String(s).padStart(w);

const lines = [];
lines.push(scenario.name ? `Scenario: ${scenario.name}` : `Scenario: ${file}`);
lines.push('');
lines.push('HEADLINE');
lines.push(`  Breakeven client count     ${int(r.breakeven.clients)}  (covers ${usd(r.inputs.costs.fixedOverhead)} overhead, owner earns $0)`);
if (r.inputs.targetOwnerIncome > 0) {
  lines.push(`  Clients for target income  ${int(r.target.clients)}  (${usd(r.inputs.targetOwnerIncome)} pre-tax owner profit)`);
}
lines.push(`  Capacity ceiling           ${r.capacity.ceiling}  (${Math.round(r.capacity.clientHours)} client hours / ${r.blended.hours.toFixed(1)} hrs per client)`);
lines.push(`  Effective hourly, net      ${rate(r.effectiveHourly.netAtPlanned)} at ${r.inputs.plannedClients} clients; ${rate(r.effectiveHourly.netAtCapacity)} at capacity`);
lines.push(`  Revenue per client hour    ${rate(r.effectiveHourly.grossPerClientHour)} (gross, before overhead)`);
lines.push('');
lines.push('PER ENGAGEMENT-YEAR');
lines.push(`  ${'Model'.padEnd(13)}${pad('Share', 7)}${pad('Revenue', 10)}${pad('Hours', 7)}${pad('Gross/hr', 10)}${pad('Contrib/hr', 12)}`);
MODELS.forEach((m) => {
  const u = r.perModel[m];
  lines.push(`  ${MODEL_LABELS[m].padEnd(13)}${pad((r.weights[m] * 100).toFixed(0) + '%', 7)}${pad(usd(u.revenue), 10)}${pad(u.hours.toFixed(1), 7)}${pad(u.grossPerHour === null ? 'n/a' : usd(u.grossPerHour), 10)}${pad(u.contributionPerHour === null ? 'n/a' : usd(u.contributionPerHour), 12)}`);
});
lines.push(`  ${'Blended'.padEnd(13)}${pad('100%', 7)}${pad(usd(r.blended.revenue), 10)}${pad(r.blended.hours.toFixed(1), 7)}${pad(usd(r.blended.grossPerHour), 10)}${pad(usd(r.blended.contributionPerHour), 12)}`);
lines.push('');
lines.push(`PLANNED YEAR (${r.inputs.plannedClients} clients)`);
const p = r.planned;
lines.push(`  Revenue                    ${usd(p.revenue)}`);
lines.push(`  Variable costs             ${usd(-p.variableCosts)}`);
lines.push(`  Fixed overhead             ${usd(-p.fixedOverhead)}`);
lines.push(`  Owner profit (pre-tax)     ${usd(p.profit)}`);
lines.push(`  Hours worked               ${Math.round(p.totalHours)} (${Math.round(p.deliveryHours)} client + ${Math.round(p.nonClientHours)} non-client), ${p.hoursPerWeek.toFixed(1)}/week`);
lines.push(`  Utilization of client time ${(p.utilization * 100).toFixed(0)}%`);

if (r.warnings.length) {
  lines.push('');
  lines.push('FLAGS');
  r.warnings.forEach((w) => lines.push(`  [${w.level}] ${w.message}`));
}
lines.push('');
lines.push('Pre-tax, before self-employment tax and retirement contributions. See docs/METHODOLOGY.md.');
console.log(lines.join('\n'));
