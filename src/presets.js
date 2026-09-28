/*
 * Example scenarios. These numbers are illustrative placeholders chosen to
 * exercise the model. They are not industry benchmarks. Replace every one
 * with your own figures.
 *
 * examples/*.json mirrors these presets for the CLI; test/presets.test.js
 * fails if the two drift apart.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PracticePresets = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var mixed = {
    name: 'Mixed practice',
    pricing: {
      hourly: { rate: 250, hoursPerEngagement: 8, realizationPct: 90 },
      project: { fee: 3500, hoursPerEngagement: 16 },
      subscription: {
        monthlyFee: 250,
        hoursPerEngagement: 18,
        firstYearFee: 1500,
        firstYearExtraHours: 12,
        firstYearPct: 30
      }
    },
    mix: { hourly: 20, project: 30, subscription: 50 },
    plannedClients: 50,
    capacity: { weeksPerYear: 46, hoursPerWeek: 40, nonClientHoursPerWeek: 15 },
    costs: {
      fixedOverhead: {
        technology: 12000,
        complianceAndRegistration: 6000,
        insurance: 4000,
        marketing: 8000,
        educationAndMemberships: 4000,
        officeAndOther: 6000
      },
      variablePctOfRevenue: 3,
      variableCostPerClient: 100
    },
    targetOwnerIncome: 150000
  };

  var hourlyOnly = {
    name: 'Hourly only',
    pricing: {
      hourly: { rate: 300, hoursPerEngagement: 10, realizationPct: 85 },
      project: { fee: 0, hoursPerEngagement: 0 },
      subscription: { monthlyFee: 0, hoursPerEngagement: 0, firstYearFee: 0, firstYearExtraHours: 0, firstYearPct: 0 }
    },
    mix: { hourly: 100, project: 0, subscription: 0 },
    plannedClients: 80,
    capacity: { weeksPerYear: 46, hoursPerWeek: 40, nonClientHoursPerWeek: 15 },
    costs: {
      fixedOverhead: {
        technology: 9000,
        complianceAndRegistration: 6000,
        insurance: 4000,
        marketing: 10000,
        educationAndMemberships: 4000,
        officeAndOther: 5000
      },
      variablePctOfRevenue: 3,
      variableCostPerClient: 50
    },
    targetOwnerIncome: 150000
  };

  var subscriptionOnly = {
    name: 'Subscription only',
    pricing: {
      hourly: { rate: 0, hoursPerEngagement: 0, realizationPct: 100 },
      project: { fee: 0, hoursPerEngagement: 0 },
      subscription: {
        monthlyFee: 400,
        hoursPerEngagement: 22,
        firstYearFee: 2000,
        firstYearExtraHours: 20,
        firstYearPct: 25
      }
    },
    mix: { hourly: 0, project: 0, subscription: 100 },
    plannedClients: 40,
    capacity: { weeksPerYear: 46, hoursPerWeek: 40, nonClientHoursPerWeek: 15 },
    costs: {
      fixedOverhead: {
        technology: 14000,
        complianceAndRegistration: 6000,
        insurance: 4000,
        marketing: 8000,
        educationAndMemberships: 4000,
        officeAndOther: 6000
      },
      variablePctOfRevenue: 3,
      variableCostPerClient: 150
    },
    targetOwnerIncome: 150000
  };

  return {
    'mixed-practice': mixed,
    'hourly-only': hourlyOnly,
    'subscription-only': subscriptionOnly
  };
});
