'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const presets = require('../src/presets.js');
const { evaluate } = require('../src/model.js');

const dir = path.join(__dirname, '..', 'examples');

test('examples/*.json match src/presets.js', () => {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  assert.deepEqual(files, Object.keys(presets).map((k) => k + '.json').sort());
  for (const [key, preset] of Object.entries(presets)) {
    const onDisk = JSON.parse(fs.readFileSync(path.join(dir, key + '.json'), 'utf8'));
    assert.deepEqual(onDisk, preset, `${key}.json has drifted from src/presets.js`);
  }
});

test('every preset evaluates without errors', () => {
  for (const [key, preset] of Object.entries(presets)) {
    const r = evaluate(preset);
    assert.equal(r.ok, true, `${key}: ${JSON.stringify(r.errors)}`);
  }
});
