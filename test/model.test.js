'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluate, curve, normalize } = require('../src/model.js');
const presets = require('../src/presets.js');

const close = (actual, expected, tol = 1e-6) =>
  assert.ok(Math.abs(actual - expected) <= tol, `expected ${expected}, got ${actual}`);

const clone = (o) => JSON.parse(JSON.stringify(o));

// Every expected value below is worked by hand in the comments so a reader
// can audit the formulas without reading src/model.js.
test('mixed preset: unit economics per model', () => {
  const r = evaluate(presets['mixed-practice']);
  assert.equal(r.ok, true);
  // Hourly: 250 * 8 * 0.90 = 1800 revenue; variable 1800 * 0.03 + 100 = 154
  close(r.perModel.hourly.revenue, 1800);
  close(r.perModel.hourly.contribution, 1646);
  close(r.perModel.hourly.grossPerHour, 225);
  // Project: 3500 flat; variable 105 + 100 = 205
  close(r.perModel.project.revenue, 3500);
  close(r.perModel.project.contribution, 3295);
  // Subscription: 250 * 12 + 0.30 * 1500 = 3450; hours 18 + 0.30 * 12 = 21.6
  close(r.perModel.subscription.revenue, 3450);
  close(r.perModel.subscription.hours, 21.6);
  close(r.perModel.subscription.contribution, 3246.5);
});

test('mixed preset: blended figures and the three headline outputs', () => {
  const r = evaluate(presets['mixed-practice']);
  // Blended revenue: .2*1800 + .3*3500 + .5*3450 = 3135
  close(r.blended.revenue, 3135);
  // Blended hours: .2*8 + .3*16 + .5*21.6 = 17.2
  close(r.blended.hours, 17.2);
  // Blended contribution: .2*1646 + .3*3295 + .5*3246.5 = 2940.95
  close(r.blended.contribution, 2940.95);

  // Breakeven: 40000 / 2940.95 = 13.60 -> 14 clients
  close(r.breakeven.exact, 40000 / 2940.95);
  assert.equal(r.breakeven.clients, 14);
  // Target: (40000 + 150000) / 2940.95 = 64.60 -> 65 clients
  assert.equal(r.target.clients, 65);

  // Capacity: 46 * (40 - 15) = 1150 client hours / 17.2 = 66.86 -> 66
  close(r.capacity.clientHours, 1150);
  assert.equal(r.capacity.ceiling, 66);
  assert.equal(r.target.withinCapacity, true);

  // Planned 50 clients: profit 50 * 2940.95 - 40000 = 107047.50
  close(r.planned.profit, 107047.5);
  // Hours worked: 50 * 17.2 + 46 * 15 = 860 + 690 = 1550
  close(r.planned.totalHours, 1550);
  // Net effective hourly: 107047.5 / 1550
  close(r.effectiveHourly.netAtPlanned, 107047.5 / 1550);
  // Gross per client hour: 3135 / 17.2
  close(r.effectiveHourly.grossPerClientHour, 3135 / 17.2);
  assert.deepEqual(r.warnings, []);
});

test('overhead given as a single number equals the itemized total', () => {
  const s = clone(presets['mixed-practice']);
  s.costs.fixedOverhead = 40000;
  const a = evaluate(s);
  const b = evaluate(presets['mixed-practice']);
  assert.equal(a.breakeven.clients, b.breakeven.clients);
  close(a.planned.profit, b.planned.profit);
});

test('breakeven lands exactly on an integer without rounding up an extra client', () => {
  const s = {
    pricing: { project: { fee: 1000, hoursPerEngagement: 10 } },
    mix: { project: 100 },
    plannedClients: 10,
    capacity: { weeksPerYear: 50, hoursPerWeek: 40, nonClientHoursPerWeek: 10 },
    costs: { fixedOverhead: 10000 },
    targetOwnerIncome: 0
  };
  const r = evaluate(s);
  assert.equal(r.breakeven.clients, 10);
  close(r.planned.profit, 0);
  // Capacity: 50 * 30 = 1500 hours / 10 = 150 exactly
  assert.equal(r.capacity.ceiling, 150);
});

test('float noise does not push a whole-number ceiling down by one', () => {
  // 0.1 + 0.2 style noise: 3 hours per engagement, 0.3 hours of first-year extra on 100% new
  const s = {
    pricing: { subscription: { monthlyFee: 100, hoursPerEngagement: 2.7, firstYearExtraHours: 0.3, firstYearPct: 100 } },
    mix: { subscription: 100 },
    capacity: { weeksPerYear: 30, hoursPerWeek: 10, nonClientHoursPerWeek: 0 },
    costs: { fixedOverhead: 0 }
  };
  const r = evaluate(s);
  assert.equal(r.capacity.ceiling, 100);
});

test('mix that does not total 100% is scaled proportionally and flagged', () => {
  const s = clone(presets['mixed-practice']);
  s.mix = { hourly: 2, project: 3, subscription: 5 };
  const r = evaluate(s);
  assert.equal(r.ok, true);
  close(r.weights.hourly, 0.2);
  close(r.blended.revenue, 3135);
  assert.ok(r.warnings.some((w) => w.field === 'mix'));
});

test('negative contribution means breakeven is unreachable', () => {
  const s = {
    pricing: { hourly: { rate: 50, hoursPerEngagement: 2, realizationPct: 100 } },
    mix: { hourly: 100 },
    capacity: { weeksPerYear: 46, hoursPerWeek: 40, nonClientHoursPerWeek: 10 },
    costs: { fixedOverhead: 10000, variableCostPerClient: 150 }
  };
  const r = evaluate(s);
  assert.equal(r.breakeven.reachable, false);
  assert.equal(r.breakeven.clients, null);
  assert.ok(r.warnings.some((w) => w.level === 'critical' && w.field === 'breakeven'));
});

test('breakeven above the capacity ceiling is flagged as critical', () => {
  const s = {
    pricing: { project: { fee: 1000, hoursPerEngagement: 40 } },
    mix: { project: 100 },
    capacity: { weeksPerYear: 46, hoursPerWeek: 40, nonClientHoursPerWeek: 10 },
    costs: { fixedOverhead: 100000 }
  };
  const r = evaluate(s);
  // 1380 hours / 40 = 34 clients; breakeven 100 clients
  assert.equal(r.capacity.ceiling, 34);
  assert.equal(r.breakeven.clients, 100);
  assert.equal(r.breakeven.withinCapacity, false);
  assert.ok(r.warnings.some((w) => w.level === 'critical'));
});

test('planned clients above the ceiling are flagged with the hours per week required', () => {
  const s = clone(presets['mixed-practice']);
  s.plannedClients = 80;
  const r = evaluate(s);
  const w = r.warnings.find((x) => x.field === 'plannedClients');
  assert.ok(w);
  // (80 * 17.2 + 690) / 46 = 44.9 hours a week
  assert.match(w.message, /44\.9 hours a week/);
  assert.ok(r.planned.utilization > 1);
});

test('zero overhead means zero clients to break even', () => {
  const s = clone(presets['mixed-practice']);
  s.costs.fixedOverhead = 0;
  const r = evaluate(s);
  assert.equal(r.breakeven.clients, 0);
  assert.equal(r.breakeven.withinCapacity, true);
});

test('hours on a model with 0% share do not trigger a zero-hours error', () => {
  const r = evaluate(presets['hourly-only']);
  assert.equal(r.ok, true);
  assert.equal(r.perModel.project.grossPerHour, null);
});

test('input errors stop evaluation', () => {
  const cases = [
    [{ mix: {} }, 'mix'],
    [{ ...clone(presets['mixed-practice']), capacity: { weeksPerYear: 46, hoursPerWeek: 20, nonClientHoursPerWeek: 20 } },
      'capacity.nonClientHoursPerWeek'],
    [{ ...clone(presets['mixed-practice']), plannedClients: -1 }, 'plannedClients'],
    [{ ...clone(presets['mixed-practice']), plannedClients: 'abc' }, 'plannedClients']
  ];
  const zeroHours = clone(presets['mixed-practice']);
  zeroHours.pricing.project.hoursPerEngagement = 0;
  cases.push([zeroHours, 'pricing.project.hoursPerEngagement']);
  const overRealization = clone(presets['mixed-practice']);
  overRealization.pricing.hourly.realizationPct = 120;
  cases.push([overRealization, 'pricing.hourly.realizationPct']);

  for (const [scenario, field] of cases) {
    const r = evaluate(scenario);
    assert.equal(r.ok, false, `expected an error for ${field}`);
    assert.ok(r.errors.some((e) => e.field === field), `missing error on ${field}: ${JSON.stringify(r.errors)}`);
  }
});

test('realization defaults to 100% and numeric strings are accepted', () => {
  const n = normalize({ pricing: { hourly: { rate: '200', hoursPerEngagement: '5' } } });
  assert.equal(n.pricing.hourly.realizationPct, 100);
  assert.equal(n.pricing.hourly.rate, 200);
});

test('curve crosses zero profit at the breakeven count', () => {
  const r = evaluate(presets['mixed-practice']);
  const pts = curve(r, r.capacity.ceiling);
  assert.equal(pts.length, r.capacity.ceiling + 1);
  close(pts[0].profit, -40000);
  assert.ok(pts[r.breakeven.clients - 1].profit < 0);
  assert.ok(pts[r.breakeven.clients].profit >= 0);
});
