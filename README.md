# advice-only-practice-modeling

A worksheet for evaluating an advice-only financial planning practice. You enter your hourly, project, and subscription pricing, your client mix, the hours each engagement takes, and your overhead. It returns three numbers:

- **Breakeven client count**: how many clients cover your overhead and variable costs, with $0 left for you. It also reports how many clients you need to hit a target owner income.
- **Effective hourly rate**: owner profit divided by *every* hour you work, client and non-client. It also shows revenue per client hour, the gross figure most people quote.
- **Capacity ceiling**: the most clients your calendar can hold at this mix, given your working weeks, weekly hours, and time spent on non-client work.

It also breaks out revenue and contribution per hour for each pricing model, gives a planned-year P&L and time budget, and plots net hourly rate against client count.

There are no dependencies and no build step. Everything runs in your browser or in Node, and your inputs are never sent anywhere. The one outside request is the web page loading its typefaces from Google Fonts. If you'd rather avoid that, delete the three font `<link>` tags in `index.html`; the page falls back to system fonts.

## Use it

**In the browser.** Open `index.html`, either from a GitHub Pages deployment of this repo or by downloading the repo and double-clicking the file. Your inputs are saved in your own browser's local storage and never leave your machine. Use *Import / export* to copy a scenario as JSON, and *Copy share link* (on a hosted copy) to send one to a colleague.

**From the command line** (Node 18 or newer):

```sh
node cli.js examples/mixed-practice.json          # formatted report
node cli.js examples/mixed-practice.json --json   # full result as JSON
node cli.js --template > my-practice.json         # starter file to edit
```

**As a library:**

```js
const { evaluate } = require('./src/model.js');
const result = evaluate(require('./examples/mixed-practice.json'));
console.log(result.breakeven.clients, result.effectiveHourly.netAtPlanned, result.capacity.ceiling);
```

## Example output

From `examples/mixed-practice.json` (20% hourly, 30% project, 50% subscription; $40,000 overhead; 46 weeks at 40 hours with 15 non-client hours a week):

```
HEADLINE
  Breakeven client count     14  (covers $40,000 overhead, owner earns $0)
  Clients for target income  65  ($150,000 pre-tax owner profit)
  Capacity ceiling           66  (1150 client hours / 17.2 hrs per client)
  Effective hourly, net      $69/hr at 50 clients; $84/hr at capacity
  Revenue per client hour    $182/hr (gross, before overhead)
```

The gap between $182 and $69 is overhead, variable costs, and the 690 hours a year of marketing, admin, and CE that no client pays for directly.

**The example numbers are illustrative placeholders, not benchmarks.** Replace them with your own.

## How it calculates

Every formula, input definition, and limitation is in [docs/METHODOLOGY.md](docs/METHODOLOGY.md). In short:

- A "client" is one engagement-year: one hourly engagement, one project, or one subscriber carried for a year.
- Blended revenue, hours, and contribution per client are weighted by your client mix.
- Breakeven = fixed overhead ÷ blended contribution per client, rounded up.
- Capacity ceiling = (annual hours − non-client hours) ÷ blended hours per client, rounded down.
- Net effective hourly rate = (revenue − variable costs − overhead) ÷ (client hours + non-client hours).

Figures are pre-tax. The model does not include self-employment tax, retirement contributions, ramp-up time, churn beyond the first subscription year, or seasonality. The methodology doc covers what each omission means for your numbers.

## Repository layout

| Path | Contents |
|---|---|
| `index.html` | The browser worksheet |
| `src/model.js` | Calculation engine, shared by the page, CLI, and tests |
| `src/presets.js` | Example scenarios loaded by the page |
| `examples/*.json` | The same scenarios as files for the CLI |
| `cli.js` | Command-line report |
| `test/` | Tests, run with `npm test` (Node's built-in runner) |
| `docs/METHODOLOGY.md` | Formulas, definitions, and limitations |

## Hosting your own copy

Fork the repo, then in **Settings → Pages** set the source to *Deploy from a branch*, branch `main`, folder `/ (root)`. The worksheet will be served at `https://<your-username>.github.io/advice-only-practice-modeling/`.

## Contributing

Issues and pull requests are welcome, especially corrections to the methodology. Any change to `src/model.js` should come with a test in `test/model.test.js` that works the new figure by hand. If you change a preset, update the matching file in `examples/`; `npm test` fails when they drift apart.

## Disclaimer

This is an educational model for thinking through practice economics. It is not tax, legal, or investment advice, and its outputs are only as good as the inputs you give it.

## License

[MIT](LICENSE)
