import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{normalizeHost,renderDomain} from '../src/index.js';
test('hostname normalization',()=>assert.equal(normalizeHost('WWW.Example.COM.'),'example.com'));
test('known domain renders price',()=>{const html=renderDomain('example.com');assert.match(html,/8888/);assert.match(html,/seller@example.com/);});
test('unknown domain is rejected',()=>assert.equal(renderDomain('unknown.com'),null));
test('unknown host returns 404',async()=>{const r=await worker.fetch(new Request('https://unknown.com/'));assert.equal(r.status,404)});
test('unknown path returns 404',async()=>{const r=await worker.fetch(new Request('https://example.com/admin'));assert.equal(r.status,404)});
test('known domain returns HTML',async()=>{const r=await worker.fetch(new Request('https://example.com/'));assert.equal(r.status,200);assert.match(await r.text(),/example.com/)});
