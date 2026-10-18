import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{normalizeHost,renderDomain,handleRequest} from '../src/index.js';

const examples={
  'example.com':{price:8888,currency:'CNY',contact:'seller@example.com',status:'for_sale'},
  'example.net':{price:12800,currency:'CNY',contact:'seller@example.com',status:'for_sale'},
  'reserved.org':{price:10,currency:'CNY',contact:'seller@example.com',status:'reserved'},
  'sold.org':{price:20,currency:'CNY',contact:'seller@example.com',status:'sold'}
};
const fetchWithInventory=(url)=>handleRequest(new Request(url),examples);

test('hostname normalization',()=>assert.equal(normalizeHost('WWW.Example.COM.'),'example.com'));
test('known domain renders price',()=>{
  const html=renderDomain('example.com',examples);
  assert.match(html,/8888/);assert.match(html,/seller@example.com/);
});
test('unknown domain is rejected',()=>assert.equal(renderDomain('unknown.com',examples),null));
test('reserved or sold records never render a sale page',()=>{
  assert.equal(renderDomain('reserved.org',examples),null);
  assert.equal(renderDomain('sold.org',examples),null);
});
test('sale price must be positive',()=>{
  assert.equal(renderDomain('zero.org',{'zero.org':{...examples['example.com'],price:0}}),null);
});
test('unknown host returns 404',async()=>{
  const r=await fetchWithInventory('https://unknown.com/');
  assert.equal(r.status,404);
});
test('unknown path returns 404',async()=>{
  const r=await fetchWithInventory('https://example.com/admin');
  assert.equal(r.status,404);
});
test('known domain returns HTML',async()=>{
  const r=await fetchWithInventory('https://example.com/');
  assert.equal(r.status,200);assert.match(await r.text(),/example.com/);
});
test('workers.dev preview renders inventory record',async()=>{
  const r=await fetchWithInventory('https://domain-sale-preview.ddli.workers.dev/?preview=example.com');
  assert.equal(r.status,200);
  assert.equal(r.headers.get('x-robots-tag'),'noindex, nofollow');
  assert.equal(r.headers.get('cache-control'),'no-store');
  assert.match(await r.text(),/example.com/);
});
test('workers.dev root returns 404',async()=>{
  const r=await fetchWithInventory('https://domain-sale-preview.ddli.workers.dev/');
  assert.equal(r.status,404);
});
test('workers.dev preview does not leak unlisted domains',async()=>{
  const r=await fetchWithInventory('https://domain-sale-preview.ddli.workers.dev/?preview=other.net');
  assert.equal(r.status,404);
});
test('production Host ignores preview parameter',async()=>{
  const r=await fetchWithInventory('https://example.net/?preview=example.com');
  assert.equal(r.status,200);
  const html=await r.text();
  assert.match(html,/example.net/);
  assert.doesNotMatch(html,/<h1 id="domain">example.com<\/h1>/);
});
test('domain sale HTML escapes injection-prone email characters',()=>{
  const html=renderDomain('example.com',{'example.com':{price:10,currency:'USD',contact:'a<svg>@example.com',status:'for_sale'}});
  assert.doesNotMatch(html,/<svg>/);
});
test('worker entrypoint still serves current repository config',async()=>{
  const r=await worker.fetch(new Request('https://unknown.example/'));
  assert.equal(r.status,404);
});

test('selling price formatter preserves optional cents',()=>{
  const html=renderDomain('example.com',{'example.com':{...examples['example.com'],price:199.95}});
  assert.match(html,/maximumFractionDigits:2/);
  assert.match(html,/199.95/);
});
