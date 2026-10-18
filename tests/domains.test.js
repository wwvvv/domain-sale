import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{normalizeHost,renderDomain,handleRequest,escapeHtml} from '../src/index.js';
import {initClient} from '../src/client.js';

const seller={contactEmail:'i@ddli.cn',sourceLanguage:'zh-CN'};
const listings={
  'xiac.cn':{price:6666,currency:'CNY',status:'for_sale',meanings:['下厨','夏创','虾吃','夏城']},
  'paused.cn':{price:999,currency:'CNY',status:'paused'},
  'reserved.cn':{price:999,currency:'CNY',status:'reserved'},
  'sold.cn':{price:999,currency:'CNY',status:'sold'}
};
const fetchFixture=url=>handleRequest(new Request(url),listings,seller);

test('normalize hosts for xiac.cn and www alias',()=>{
  assert.equal(normalizeHost('WWW.Xiac.CN.'),'xiac.cn');
  assert.equal(normalizeHost('xiac.cn'),'xiac.cn');
});
test('xiac.cn sale page shows asking price, public email and four meanings',()=>{
  const html=renderDomain('xiac.cn',listings,seller);
  for(const value of ['xiac.cn','¥6,666','下厨','夏创','虾吃','夏城','i@ddli.cn']){
    assert.ok(html.includes(value),'Missing '+value);
  }
  assert.match(html,/mailto:i@ddli\.cn\?subject=/);
  assert.match(html,/<meta name="viewport"/);
});
test('fixed contact does not require per-domain address',()=>{
  const updated={contactEmail:'sales@example.org',sourceLanguage:'zh-CN'};
  assert.match(renderDomain('xiac.cn',listings,updated),/sales@example\.org/);
  assert.doesNotMatch(renderDomain('xiac.cn',listings,updated),/i@ddli\.cn/);
});
test('removed placeholders are no longer for sale',()=>{
  assert.equal(renderDomain('example.com',listings,seller),null);
  assert.equal(renderDomain('example.net',listings,seller),null);
});
test('unknown and non-sale states return 404',async()=>{
  for(const host of ['unknown.com','paused.cn','reserved.cn','sold.cn']){
    const r=await fetchFixture('https://'+host+'/');
    assert.equal(r.status,404,host);
  }
});
test('invalid price and invalid contact fail closed',()=>{
  assert.equal(renderDomain('xiac.cn',{'xiac.cn':{...listings['xiac.cn'],price:0}},seller),null);
  assert.equal(renderDomain('xiac.cn',listings,{contactEmail:'invalid',sourceLanguage:'zh-CN'}),null);
});
test('sale HTML escapes untrusted meaning text',()=>{
  const html=renderDomain('xiac.cn',{'xiac.cn':{...listings['xiac.cn'],meanings:['<img src=x onerror=alert(1)>','夏创']}},seller);
  assert.doesNotMatch(html,/<img src=x/);
  assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.equal(escapeHtml('<script>"'), '&lt;script&gt;&quot;');
});
test('previews only allow configured domains and preserve noindex',async()=>{
  const preview=await fetchFixture('https://domain-sale-preview.ddli.workers.dev/?preview=xiac.cn');
  assert.equal(preview.status,200);
  assert.equal(preview.headers.get('x-robots-tag'),'noindex, nofollow');
  assert.equal(preview.headers.get('cache-control'),'no-store');
  assert.match(await preview.text(),/xiac\.cn/);
  assert.equal((await fetchFixture('https://domain-sale-preview.ddli.workers.dev/')).status,404);
  assert.equal((await fetchFixture('https://domain-sale-preview.ddli.workers.dev/?preview=unknown.com')).status,404);
});
test('preview selector cannot override the sale domain on production Host',async()=>{
  const r=await fetchFixture('https://xiac.cn/?preview=unknown.com&lang=en');
  assert.equal(r.status,200);
  assert.match(await r.text(),/xiac\.cn/);
});
test('asset routes serve self-hosted pinned translate.js and first-party client',async()=>{
  const client=await fetchFixture('https://domain-sale-preview.ddli.workers.dev/assets/client.js');
  assert.equal(client.status,200);
  assert.match(client.headers.get('content-type'),/javascript/);
  const script=await client.text();
  assert.doesNotThrow(()=>new Function(script));
  assert.match(script,/language-select/);
  const t=await fetchFixture('https://domain-sale-preview.ddli.workers.dev/assets/translate.min.js');
  assert.equal(t.status,200);
  const source=await t.text();
  assert.ok(source.length>100000);
  assert.match(source,/4\.1\.0\.20260526/);
  assert.match(source,/edge\.microsoft\.com/);
  assert.equal((await fetchFixture('https://domain-sale-preview.ddli.workers.dev/assets/unknown.js')).status,404);
});
test('sale pages use same-origin scripts and limit network translations',async()=>{
  const r=await fetchFixture('https://xiac.cn/');
  const csp=r.headers.get('content-security-policy');
  assert.match(csp,/script-src 'self'/);
  assert.match(csp,/connect-src 'self' https:\/\/edge\.microsoft\.com/);
  assert.doesNotMatch(csp,/unsafe-inline.*script-src/);
  const html=await r.text();
  assert.match(html,/<script src="\/assets\/client\.js" defer><\/script>/);
  assert.doesNotMatch(html,/https:\/\/res\.zvo\.cn/);
});
test('HEAD works and writes are refused',async()=>{
  const head=await handleRequest(new Request('https://xiac.cn/',{method:'HEAD'}),listings,seller);
  assert.equal(head.status,200);
  assert.equal(await head.text(),'');
  const post=await handleRequest(new Request('https://xiac.cn/',{method:'POST'}),listings,seller);
  assert.equal(post.status,405);
});
test('Node entrypoint serves xiac.cn from repository inventory',async()=>{
  const html=await (await worker.fetch(new Request('https://xiac.cn/'))).text();
  assert.match(html,/¥6,666/);
});
