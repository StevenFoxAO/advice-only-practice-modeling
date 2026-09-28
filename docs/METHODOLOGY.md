# Methodology

This document defines every input, shows every formula the model uses, and lists what the model leaves out. The code that implements it is [`src/model.js`](../src/model.js), and [`test/model.test.js`](../test/model.test.js) works each formula by hand against the example scenario.

## Unit of analysis: the engagement-year

A **client** in this model is one *engagement-year*:

- one hourly engagement delivered during the year,
- one project delivered during the year, or
- one subscriber carried for the full year.

A household that buys two projects in a year counts as two. A subscriber who joins in July counts as half. If your practice has meaningful mid-year churn or growth, enter your *average* active subscriber count, not your year-end count.

## Inputs

### Pricing and hours per engagement

"Hours" always means **all** advisor time on that engagement-year: meetings, analysis, prep, follow-up, notes, and client-specific admin. Time that no particular client pays for belongs in non-client hours instead.

| Model | Field | Meaning |
|---|---|---|
| Hourly | `rate` | Your hourly rate |
| | `hoursPerEngagement` | Advisor hours per hourly engagement |
| | `realizationPct` | Share of those hours you bill *and* collect (default 100) |
| Project | `fee` | Flat project fee |
| | `hoursPerEngagement` | Advisor hours per project |
| Subscription | `monthlyFee` | Recurring monthly fee |
| | `hoursPerEngagement` | Ongoing advisor hours per subscriber per year |
| | `firstYearFee` | One-time setup or onboarding fee |
| | `firstYearExtraHours` | Extra first-year hours (plan build, onboarding) on top of ongoing hours |
| | `firstYearPct` | Share of subscribers who are in their first year |

### Client mix

`mix.hourly`, `mix.project`, `mix.subscription` are the percentage of engagement-years in each model. They should total 100. If they don't, the model scales each share proportionally (so 20/30/40 becomes 22.2/33.3/44.4) and raises a warning.

### Planned clients

`plannedClients` is the total engagement-years you expect to serve this year, all models combined. It drives the planned-year P&L and the net effective hourly rate at your planned volume. It does not affect breakeven or capacity.

### Your time

| Field | Meaning |
|---|---|
| `weeksPerYear` | Weeks you work (52 minus vacation, holidays, sick time) |
| `hoursPerWeek` | Total hours you are willing to work in a week |
| `nonClientHoursPerWeek` | Weekly hours on marketing, bookkeeping, compliance, CE, and other work no single client pays for |

Non-client hours are treated as **fixed**. You spend them whether you have 10 clients or 60.

### Costs

| Field | Meaning |
|---|---|
| `fixedOverhead` | Annual fixed costs. Either a single number or an object of line items, which are summed. Exclude your own compensation. |
| `variablePctOfRevenue` | Costs that scale with revenue, mainly card and ACH processing |
| `variableCostPerClient` | Costs that scale with client count: per-client software fees, account aggregation, mailings |

### Income target

`targetOwnerIncome` is the annual **pre-tax owner profit** you need. The model uses it to compute a second client count above breakeven.

## Formulas

### Per engagement-year, by model

Let `v%` = `variablePctOfRevenue / 100`, `v$` = `variableCostPerClient`, and `f` = `firstYearPct / 100`.

| | Revenue R | Hours H |
|---|---|---|
| Hourly | `rate × hoursPerEngagement × realizationPct/100` | `hoursPerEngagement` |
| Project | `fee` | `hoursPerEngagement` |
| Subscription | `12 × monthlyFee + f × firstYearFee` | `hoursPerEngagement + f × firstYearExtraHours` |

For each model:

- Variable cost `V = R × v% + v$`
- Contribution `C = R − V`
- Revenue per hour `R / H`
- Contribution per hour `C / H`

### Blended per client

With mix weights `w` (normalized to sum to 1):

- Blended revenue `R̄ = Σ wᵢ Rᵢ`
- Blended hours `H̄ = Σ wᵢ Hᵢ`
- Blended contribution `C̄ = Σ wᵢ Cᵢ`

Blending is a weighted average across engagement-years, so `R̄ / H̄` is revenue per client hour for the practice as a whole. It is *not* the simple average of each model's hourly rate.

### Headline outputs

**Breakeven client count**

```
breakeven = ceil( fixedOverhead / C̄ )
```

The smallest whole client count at which contribution covers fixed overhead. At breakeven, the owner earns roughly $0. If `C̄ ≤ 0` the practice loses money on every client and breakeven is unreachable.

**Clients needed for target income**

```
targetClients = ceil( (fixedOverhead + targetOwnerIncome) / C̄ )
```

**Capacity ceiling**

```
annualHours       = weeksPerYear × hoursPerWeek
nonClientHours    = weeksPerYear × nonClientHoursPerWeek
clientHours       = annualHours − nonClientHours
capacityCeiling   = floor( clientHours / H̄ )
```

The most whole clients your calendar can hold at this mix.

**Effective hourly rate.** The model reports two figures, because "effective hourly rate" gets used for both and they differ a lot:

| Figure | Formula | What it answers |
|---|---|---|
| **Net effective hourly rate** (headline) | `ownerProfit / totalHoursWorked` | What the owner earns for each hour worked, after all costs and counting non-client time |
| Revenue per client hour | `R̄ / H̄` | What clients pay for each hour spent on them, before any costs |

For any client count `N`:

```
revenue       = N × R̄
variableCosts = N × V̄
ownerProfit   = N × C̄ − fixedOverhead
clientHours   = N × H̄
hoursWorked   = N × H̄ + nonClientHours
netHourly     = ownerProfit / hoursWorked
utilization   = (N × H̄) / clientHours available
```

The model evaluates this at your planned client count and at the capacity ceiling.

Net hourly rate rises with client count, steeply at first and then flattening. It approaches `C̄ / H̄` only as client hours swamp fixed overhead and non-client time, so it never reaches that figure in practice.

### Why contribution per hour is in the table

When the calendar is full, time is the binding constraint, and the model that earns the most contribution per hour of advisor time sets the income ceiling. This is the standard managerial-accounting rule for a constrained resource: rank by contribution margin per unit of the scarce input. Below capacity, contribution *per client* matters more, since you are limited by how many clients you can find, not by hours.

### Rounding

Client counts are whole numbers. Breakeven and target counts round **up** (you need the next whole client to cover the gap). The capacity ceiling rounds **down** (a partial client does not fit). A tolerance of 1e-9 keeps floating-point noise from shifting an exact result by one.

## Flags

| Level | Condition |
|---|---|
| Critical | Contribution per client is zero or negative, so no client count breaks even |
| Critical | Breakeven exceeds the capacity ceiling |
| Warning | Target-income clients exceed the capacity ceiling. The flag reports profit at capacity. |
| Warning | Planned clients exceed the capacity ceiling. The flag reports the weekly hours required. |
| Warning | Client mix does not total 100% |

Inputs that make the result meaningless (negative numbers, percentages above 100, zero working time, non-client hours ≥ total hours, or zero hours on a model that has clients) stop evaluation and return errors instead.

## What the model leaves out

Use the results with these limits in mind.

- **Taxes and owner benefits.** Owner profit is pre-tax. A sole proprietor or single-member LLC owes self-employment tax on top of income tax: 15.3% (12.4% Social Security up to the annual wage base, plus 2.9% Medicare) on 92.35% of net earnings, with an additional 0.9% Medicare tax above the filing-status threshold. The §199A QBI deduction may apply, but financial planning is a specified service trade or business under the §199A regulations, so it phases out above the taxable-income threshold. With an S corporation election, profit splits between reasonable-compensation wages and distributions, which changes the payroll-tax picture. Retirement plan contributions and health insurance also come out of this figure. Set `targetOwnerIncome` to the pre-tax profit that covers all of those.
- **Growth and ramp-up.** The model is one steady-state year. It does not model how long it takes to reach breakeven, client acquisition cost per new client, or cash burn while building.
- **Churn beyond year one.** First-year subscription hours and fees are captured through `firstYearPct`. Cancellations mid-year are not; use average active subscribers.
- **Seasonality.** Capacity is annual. A practice that also prepares returns, or that sees demand bunch up in Q1, can hit a weekly ceiling well before the annual one.
- **Demand.** The capacity ceiling is a supply limit. It says nothing about whether the market will fill it at your prices.
- **Multiple advisors or staff.** The model assumes a single advisor's time. Staff cost can go in overhead, but the hours staff free up are not modeled. Reduce your hours per engagement to reflect delegated work.
- **Cash timing.** Subscription fees arrive monthly and project fees arrive in lumps. The model is on an annual accrual basis.
- **Price tiers within a model.** Each model takes one price. For tiered subscriptions, enter a weighted average fee and hours, or run the scenario once per tier.

## About the example numbers

The example scenarios in [`examples/`](../examples) and [`src/presets.js`](../src/presets.js) are illustrative placeholders chosen to exercise the model. They are **not** industry benchmarks and were not drawn from survey data. Replace every figure with your own.
