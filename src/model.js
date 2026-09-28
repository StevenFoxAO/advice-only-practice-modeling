/*
 * Advice-only practice model: calculation engine.
 *
 * Pure functions, no dependencies. Loads as a classic <script> in the browser
 * (exposes window.PracticeModel, so index.html works from file://) and as a
 * CommonJS module in Node (cli.js, tests).
 *
 * Unit of analysis: a "client" is one engagement-year. That is one hourly
 * engagement, one project, or one subscriber carried for a full year.
 * Every formula is documented in docs/METHODOLOGY.md.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PracticeModel = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MODELS = ['hourly', 'project', 'subscription'];
  var MODEL_LABELS = { hourly: 'Hourly', project: 'Project', subscription: 'Subscription' };

  // Guards Math.ceil/floor against float noise such as 13.000000000000002.
  var EPS = 1e-9;

  function num(v, fallback) {
    if (v === '' || v === null || v === undefined) return fallback;
    var n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : NaN;
  }

  function sumValues(v) {
    if (typeof v === 'number' || typeof v === 'string') return num(v, 0);
    if (!v || typeof v !== 'object') return 0;
    var total = 0;
    Object.keys(v).forEach(function (k) { total += num(v[k], 0); });
    return total;
  }

  function safeDiv(a, b) {
    return b > 0 ? a / b : null;
  }

  /**
   * Fill in missing fields and coerce strings to numbers. Missing values
   * become 0, except realizationPct which defaults to 100.
   */
  function normalize(s) {
    s = s || {};
    var p = s.pricing || {};
    var h = p.hourly || {}, pr = p.project || {}, sub = p.subscription || {};
    var mix = s.mix || {}, cap = s.capacity || {}, c = s.costs || {};
    return {
      pricing: {
        hourly: {
          rate: num(h.rate, 0),
          hoursPerEngagement: num(h.hoursPerEngagement, 0),
          realizationPct: num(h.realizationPct, 100)
        },
        project: {
          fee: num(pr.fee, 0),
          hoursPerEngagement: num(pr.hoursPerEngagement, 0)
        },
        subscription: {
          monthlyFee: num(sub.monthlyFee, 0),
          hoursPerEngagement: num(sub.hoursPerEngagement, 0),
          firstYearFee: num(sub.firstYearFee, 0),
          firstYearExtraHours: num(sub.firstYearExtraHours, 0),
          firstYearPct: num(sub.firstYearPct, 0)
        }
      },
      mix: {
        hourly: num(mix.hourly, 0),
        project: num(mix.project, 0),
        subscription: num(mix.subscription, 0)
      },
      plannedClients: num(s.plannedClients, 0),
      capacity: {
        weeksPerYear: num(cap.weeksPerYear, 0),
        hoursPerWeek: num(cap.hoursPerWeek, 0),
        nonClientHoursPerWeek: num(cap.nonClientHoursPerWeek, 0)
      },
      costs: {
        fixedOverhead: sumValues(c.fixedOverhead),
        variablePctOfRevenue: num(c.variablePctOfRevenue, 0),
        variableCostPerClient: num(c.variableCostPerClient, 0)
      },
      targetOwnerIncome: num(s.targetOwnerIncome, 0)
    };
  }

  function issue(level, field, message) {
    return { level: level, field: field, message: message };
  }

  /** Input problems that make the results meaningless. */
  function validate(n) {
    var errors = [];
    function check(path, value, opts) {
      if (!Number.isFinite(value)) errors.push(issue('error', path, path + ' must be a number.'));
      else if (value < 0) errors.push(issue('error', path, path + ' cannot be negative.'));
      else if (opts && opts.max !== undefined && value > opts.max) {
        errors.push(issue('error', path, path + ' cannot exceed ' + opts.max + '.'));
      }
    }
    var p = n.pricing;
    check('pricing.hourly.rate', p.hourly.rate);
    check('pricing.hourly.hoursPerEngagement', p.hourly.hoursPerEngagement);
    check('pricing.hourly.realizationPct', p.hourly.realizationPct, { max: 100 });
    check('pricing.project.fee', p.project.fee);
    check('pricing.project.hoursPerEngagement', p.project.hoursPerEngagement);
    check('pricing.subscription.monthlyFee', p.subscription.monthlyFee);
    check('pricing.subscription.hoursPerEngagement', p.subscription.hoursPerEngagement);
    check('pricing.subscription.firstYearFee', p.subscription.firstYearFee);
    check('pricing.subscription.firstYearExtraHours', p.subscription.firstYearExtraHours);
    check('pricing.subscription.firstYearPct', p.subscription.firstYearPct, { max: 100 });
    MODELS.forEach(function (m) { check('mix.' + m, n.mix[m]); });
    check('plannedClients', n.plannedClients);
    check('capacity.weeksPerYear', n.capacity.weeksPerYear, { max: 52 });
    check('capacity.hoursPerWeek', n.capacity.hoursPerWeek, { max: 168 });
    check('capacity.nonClientHoursPerWeek', n.capacity.nonClientHoursPerWeek, { max: 168 });
    check('costs.fixedOverhead', n.costs.fixedOverhead);
    check('costs.variablePctOfRevenue', n.costs.variablePctOfRevenue, { max: 100 });
    check('costs.variableCostPerClient', n.costs.variableCostPerClient);
    check('targetOwnerIncome', n.targetOwnerIncome);

    if (errors.length) return errors;

    var mixTotal = n.mix.hourly + n.mix.project + n.mix.subscription;
    if (mixTotal <= 0) {
      errors.push(issue('error', 'mix', 'Client mix is all zero. Give at least one pricing model a share of clients.'));
    }
    if (n.capacity.weeksPerYear <= 0 || n.capacity.hoursPerWeek <= 0) {
      errors.push(issue('error', 'capacity', 'Weeks per year and hours per week must both be above zero.'));
    } else if (n.capacity.nonClientHoursPerWeek >= n.capacity.hoursPerWeek) {
      errors.push(issue('error', 'capacity.nonClientHoursPerWeek',
        'Non-client hours per week must be less than total hours per week, or no time is left for clients.'));
    }
    MODELS.forEach(function (m) {
      if (n.mix[m] > 0 && n.pricing[m].hoursPerEngagement <= 0) {
        errors.push(issue('error', 'pricing.' + m + '.hoursPerEngagement',
          MODEL_LABELS[m] + ' clients are in the mix but have zero hours per engagement. Every engagement takes some time.'));
      }
    });
    return errors;
  }

  /** Revenue, hours, and contribution for one engagement-year of each model. */
  function unitEconomics(n) {
    var p = n.pricing;
    var varPct = n.costs.variablePctOfRevenue / 100;
    var varPer = n.costs.variableCostPerClient;
    var firstYearShare = p.subscription.firstYearPct / 100;

    var raw = {
      hourly: {
        revenue: p.hourly.rate * p.hourly.hoursPerEngagement * (p.hourly.realizationPct / 100),
        hours: p.hourly.hoursPerEngagement
      },
      project: {
        revenue: p.project.fee,
        hours: p.project.hoursPerEngagement
      },
      subscription: {
        revenue: p.subscription.monthlyFee * 12 + firstYearShare * p.subscription.firstYearFee,
        hours: p.subscription.hoursPerEngagement + firstYearShare * p.subscription.firstYearExtraHours
      }
    };

    var out = {};
    MODELS.forEach(function (m) {
      var u = raw[m];
      var variableCost = u.revenue * varPct + varPer;
      var contribution = u.revenue - variableCost;
      out[m] = {
        label: MODEL_LABELS[m],
        revenue: u.revenue,
        hours: u.hours,
        variableCost: variableCost,
        contribution: contribution,
        grossPerHour: safeDiv(u.revenue, u.hours),
        contributionPerHour: safeDiv(contribution, u.hours)
      };
    });
    return out;
  }

  function blend(units, weights) {
    var b = { revenue: 0, hours: 0, variableCost: 0, contribution: 0 };
    MODELS.forEach(function (m) {
      b.revenue += weights[m] * units[m].revenue;
      b.hours += weights[m] * units[m].hours;
      b.variableCost += weights[m] * units[m].variableCost;
      b.contribution += weights[m] * units[m].contribution;
    });
    b.grossPerHour = safeDiv(b.revenue, b.hours);
    b.contributionPerHour = safeDiv(b.contribution, b.hours);
    return b;
  }

  /** Full-year P&L and time budget at a given total client count. */
  function yearAt(clients, blended, weights, n) {
    var nonClientHours = n.capacity.weeksPerYear * n.capacity.nonClientHoursPerWeek;
    var clientHoursAvailable = n.capacity.weeksPerYear * n.capacity.hoursPerWeek - nonClientHours;
    var revenue = clients * blended.revenue;
    var variableCosts = clients * blended.variableCost;
    var profit = revenue - variableCosts - n.costs.fixedOverhead;
    var deliveryHours = clients * blended.hours;
    var totalHours = deliveryHours + nonClientHours;
    var byModel = {};
    MODELS.forEach(function (m) { byModel[m] = clients * weights[m]; });
    return {
      clients: clients,
      byModel: byModel,
      revenue: revenue,
      variableCosts: variableCosts,
      fixedOverhead: n.costs.fixedOverhead,
      profit: profit,
      deliveryHours: deliveryHours,
      nonClientHours: nonClientHours,
      totalHours: totalHours,
      hoursPerWeek: n.capacity.weeksPerYear > 0 ? totalHours / n.capacity.weeksPerYear : null,
      utilization: safeDiv(deliveryHours, clientHoursAvailable),
      netHourly: safeDiv(profit, totalHours)
    };
  }

  function clientsToEarn(profitNeeded, contribution) {
    if (profitNeeded <= 0) return { exact: 0, clients: 0, reachable: true };
    if (contribution <= 0) return { exact: null, clients: null, reachable: false };
    var exact = profitNeeded / contribution;
    return { exact: exact, clients: Math.ceil(exact - EPS), reachable: true };
  }

  var money = function (x) {
    var sign = x < 0 ? '-' : '';
    return sign + '$' + Math.round(Math.abs(x)).toLocaleString('en-US');
  };

  /**
   * Evaluate a scenario. Returns { ok: false, errors } when inputs are
   * unusable, otherwise the full result with warnings.
   */
  function evaluate(scenario) {
    var n = normalize(scenario);
    var errors = validate(n);
    if (errors.length) return { ok: false, inputs: n, errors: errors, warnings: [] };

    var warnings = [];
    var mixTotal = n.mix.hourly + n.mix.project + n.mix.subscription;
    if (Math.abs(mixTotal - 100) > 0.01) {
      warnings.push(issue('warning', 'mix', 'Client mix adds to ' + +mixTotal.toFixed(2) +
        '%, not 100%. Results scale each share proportionally so they total 100%.'));
    }
    var weights = {};
    MODELS.forEach(function (m) { weights[m] = n.mix[m] / mixTotal; });

    var units = unitEconomics(n);
    var blended = blend(units, weights);

    // Capacity ceiling: client-facing hours divided by blended hours per client.
    var weeks = n.capacity.weeksPerYear;
    var annualHours = weeks * n.capacity.hoursPerWeek;
    var nonClientHours = weeks * n.capacity.nonClientHoursPerWeek;
    var clientHours = annualHours - nonClientHours;
    var ceilingExact = clientHours / blended.hours;
    var ceiling = Math.floor(ceilingExact + EPS);

    var be = clientsToEarn(n.costs.fixedOverhead, blended.contribution);
    var tgt = clientsToEarn(n.costs.fixedOverhead + n.targetOwnerIncome, blended.contribution);

    var atCapacity = yearAt(ceiling, blended, weights, n);
    var planned = yearAt(n.plannedClients, blended, weights, n);

    var breakeven = {
      clients: be.clients,
      exact: be.exact,
      reachable: be.reachable,
      withinCapacity: be.reachable && be.clients <= ceiling
    };
    var target = {
      income: n.targetOwnerIncome,
      clients: tgt.clients,
      exact: tgt.exact,
      reachable: tgt.reachable,
      withinCapacity: tgt.reachable && tgt.clients <= ceiling,
      year: tgt.reachable ? yearAt(tgt.clients, blended, weights, n) : null
    };

    if (!be.reachable) {
      warnings.push(issue('critical', 'breakeven', 'Each client costs more to serve than it brings in (contribution per client is ' +
        money(blended.contribution) + '). No client count covers overhead. Raise prices or cut variable costs.'));
    } else if (!breakeven.withinCapacity) {
      warnings.push(issue('critical', 'breakeven', 'Breakeven needs ' + be.clients + ' clients but your hours only fit ' +
        ceiling + '. This mix cannot cover overhead with the time you have.'));
    }
    if (be.reachable && n.targetOwnerIncome > 0 && !target.withinCapacity) {
      warnings.push(issue('warning', 'target', 'Your target income needs ' + tgt.clients + ' clients, above your ceiling of ' +
        ceiling + '. At capacity the practice earns ' + money(atCapacity.profit) + ' a year.'));
    }
    if (n.plannedClients > ceiling) {
      warnings.push(issue('warning', 'plannedClients', 'Planned clients (' + n.plannedClients + ') exceed the capacity ceiling (' +
        ceiling + '). Serving them takes ' + (planned.hoursPerWeek || 0).toFixed(1) + ' hours a week against the ' +
        n.capacity.hoursPerWeek + ' you set.'));
    }

    return {
      ok: true,
      inputs: n,
      errors: [],
      warnings: warnings,
      weights: weights,
      perModel: units,
      blended: blended,
      capacity: {
        annualHours: annualHours,
        nonClientHours: nonClientHours,
        clientHours: clientHours,
        ceiling: ceiling,
        exact: ceilingExact,
        year: atCapacity
      },
      breakeven: breakeven,
      target: target,
      planned: planned,
      effectiveHourly: {
        grossPerClientHour: blended.grossPerHour,
        netAtPlanned: planned.netHourly,
        netAtCapacity: atCapacity.netHourly
      }
    };
  }

  /** Profit and net hourly rate at each client count from 0 to maxClients. */
  function curve(result, maxClients) {
    var pts = [];
    if (!result || !result.ok) return pts;
    for (var c = 0; c <= maxClients; c++) {
      var y = yearAt(c, result.blended, result.weights, result.inputs);
      pts.push({ clients: c, profit: y.profit, netHourly: y.netHourly, revenue: y.revenue, totalHours: y.totalHours });
    }
    return pts;
  }

  return {
    MODELS: MODELS,
    MODEL_LABELS: MODEL_LABELS,
    normalize: normalize,
    validate: validate,
    evaluate: evaluate,
    curve: curve
  };
});
