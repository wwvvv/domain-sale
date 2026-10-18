import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{normalizeHost,renderDomain} from '../src/index.js';
test('hostname normalization',()=>assert.equal(normalizeHost('WWW.Example.COM.'),'example.com'));
test('known domain renders price',()=>{const html=renderDomain('example.com');assert.match(html,/8888/);assert.match(html,/seller@example.com/);});
test('unknown domain is rejected',()=>assert.equal(renderDomain('unknown.com'),null));
test('unknown host returns 404',async()=>{const r=await worker.fetch(new Request('https://unknown.com/'));assert.equal(r.status,404)});
test('unknown path returns 404',async()=>{const r=await worker.fetch(new Request('https://example.com/admin'));assert.equal(r.status,404)});
test('known domain returns HTML',async()=>{const r=await worker.fetch(new Request('https://example.com/'));assert.equal(r.status,200);assert.match(await r.text(),/example.com/)});

test('workers.dev preview renders allowlisted sample domain',async()=>{
  const r=await worker.fetch(new Request('https://domain-sale-preview.ddli.workers.dev/?preview=example.com'));
  assert.equal(r.status,200);
  assert.equal(r.headers.get('x-robots-tag'),'noindex, nofollow');
  assert.equal(r.headers.get('cache-control'),'no-store');
  assert.match(await r.text(),/example.com/);
});
test('workers.dev root refuses unknown preview host',async()=>{
  const r=await worker.fetch(new Request('https://domain-sale-preview.ddli.workers.dev/'));
  assert.equal(r.status,404);
});
test('workers.dev preview cannot render unlisted domain',async()=>{
  const r=await worker.fetch(new Request('https://domain-sale-preview.ddli.workers.dev/?preview=other.net'));
  assert.equal(r.status,404);
});
test('production Host ignores preview parameter',async()=>{
  const r=await worker.fetch(new Request('https://example.net/?preview=example.com'));
  assert.equal(r.status,200);
  const html=await r.text();
  assert.match(html,/example.net/);
  assert.doesNotMatch(html,/<h1 id="domain">example.com<\/h1>/);
});
