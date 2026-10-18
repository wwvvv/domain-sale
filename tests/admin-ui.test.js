import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('local admin markup declares every DOM id required by its controller',async()=>{
  const html=await readFile(new URL('../admin/index.html',import.meta.url),'utf8');
  const js=await readFile(new URL('../admin/app.js',import.meta.url),'utf8');
  const ids=new Set([...js.matchAll(/\$\('([a-zA-Z0-9]+)'\)/g)].map(match=>match[1]));
  const missing=[...ids].filter(id=>!html.includes('id="'+id+'"'));
  assert.deepEqual(missing,[]);
  assert.match(html,/Content-Security-Policy/);
  assert.match(html,/script type="module" src="\.\/app\.js"/);
});
