import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

test('Wrangler is preview-only and has no custom-domain routes',()=>{
  const wrangler=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
  assert.equal(wrangler.name,'domain-sale-preview');
  assert.equal(wrangler.workers_dev,true);
  for(const forbidden of ['route','routes','env','triggers','site','assets']) {
    assert.equal(wrangler[forbidden],undefined,'Unexpected config key '+forbidden);
  }
});
test('admin UI and secret-bearing deployment workflows are absent',()=>{
  for(const path of ['../admin/','../scripts/admin-server.mjs','../playwright.config.js','../.github/workflows/deploy-preview.yml']) {
    assert.equal(existsSync(new URL(path,import.meta.url)),false,'Unexpected artifact: '+path);
  }
});
