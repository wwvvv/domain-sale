import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import inventory from '../src/domains.json' with {type:'json'};
import {validateInventory} from '../admin/model.js';

test('repository inventory meets admin schema',()=>{
  const clean=validateInventory(inventory);
  assert.equal(Object.keys(clean).length,Object.keys(inventory).length);
});
test('automatic preview deployment requires merged PR, never direct push to main',()=>{
  const workflow=fs.readFileSync(new URL('../.github/workflows/deploy-preview.yml',import.meta.url),'utf8');
  assert.match(workflow,/pull_request:\s*\n\s*types: \[closed\]/);
  assert.doesNotMatch(workflow,/^  push:/m);
  assert.match(workflow,/github\.event\.pull_request\.merged == true/);
  assert.match(workflow,/DOMAIN_SALE_AUTO_DEPLOY == 'true'/);
});
test('Wrangler stays on dedicated preview Worker without custom-domain routes',()=>{
  const config=JSON.parse(fs.readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
  assert.equal(config.name,'domain-sale-preview');
  assert.equal(config.workers_dev,true);
  assert.equal(config.route,undefined);
  assert.equal(config.routes,undefined);
  assert.equal(config.env,undefined);
});
