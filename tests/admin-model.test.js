import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeDomain,validateEntry,validateInventory,parseJson,toJson,parseCsv,toCsv,parseCsvRows,applyImport,getStatistics} from '../admin/model.js';

const sample={
  'example.com':{price:8888,currency:'CNY',contact:'sale@example.com',status:'for_sale'},
  'brand.net':{price:0,currency:'USD',contact:'sale+brand@example.com',status:'sold'}
};

test('normalizes hostnames without duplicate www aliases',()=>{
  assert.equal(normalizeDomain(' WWW.Example.COM. '),'example.com');
  assert.throws(()=>normalizeDomain('https://example.com'));
  assert.throws(()=>normalizeDomain('bad..example.com'));
  assert.throws(()=>normalizeDomain('-bad.example.com'));
});
test('validates domain prices and statuses',()=>{
  assert.equal(validateEntry('abc.com',{price:199.99,contact:'x@y.com'}).record.currency,'CNY');
  assert.throws(()=>validateEntry('abc.com',{price:-1,contact:'x@y.com'}));
  assert.throws(()=>validateEntry('abc.com',{price:0,contact:'x@y.com'}));
  assert.throws(()=>validateEntry('abc.com',{price:1,contact:'not an email'}));
  assert.equal(validateEntry('abc.com',{price:0,contact:'x@y.com',status:'sold'}).record.status,'sold');
});
test('rejects invalid or duplicated inventory keys',()=>{
  assert.throws(()=>validateInventory({'www.example.com':sample['example.com'],'example.com':sample['example.com']}),/重复域名/);
  assert.throws(()=>validateInventory([]));
  assert.throws(()=>validateInventory({'__proto__':null,'bad.com':null}));
});
test('JSON roundtrip keeps canonical inventory',()=>{
  assert.deepEqual(parseJson(toJson(sample)),validateInventory(sample));
  assert.deepEqual(parseJson('\uFEFF'+toJson(sample)),validateInventory(sample));
  assert.throws(()=>parseJson('{broken'));
});
test('CSV export and import roundtrip with BOM',()=>{
  assert.deepEqual(parseCsv(toCsv(sample)),validateInventory(sample));
});
test('CSV accepts quoted fields and Chinese column names',()=>{
  const input='\uFEFF域名,售价,币种,邮箱,状态\r\n"TEST.COM","900","USD","seller@example.com","出售中"\r\n';
  assert.deepEqual(parseCsv(input),{'test.com':{price:900,currency:'USD',contact:'seller@example.com',status:'for_sale'}});
});
test('CSV parser handles quoted commas and multi-line fields',()=>{
  assert.deepEqual(parseCsvRows('name,note\n"A","hi, there"\n"B","line 1\nline 2"\n'),
    [['name','note'],['A','hi, there'],['B','line 1\nline 2']]);
  assert.throws(()=>parseCsvRows('"unclosed'));
});
test('CSV rejects duplicate rows and malformed data',()=>{
  assert.throws(()=>parseCsv('domain,price,contact\nx.com,1,x@y.com\nX.COM,2,x@y.com'),/重复域名/);
  assert.throws(()=>parseCsv('domain,price,contact\nx.com,free,x@y.com'),/售价/);
  assert.throws(()=>parseCsv('domain,price,contact\nx.com,1'),/列数/);
  assert.throws(()=>parseCsv('domain,price,contact\n"x.com,1,x@y.com'),/引号/);
});
test('import merge reports overwrites but preserves other records',()=>{
  const incoming={'example.com':{...sample['example.com'],price:100},'new.org':{price:500,currency:'SGD',contact:'hello@example.org',status:'for_sale'}};
  const r=applyImport(sample,incoming,'merge');
  assert.equal(r.data['brand.net'].status,'sold');
  assert.equal(r.data['example.com'].price,100);
  assert.deepEqual(r.overwritten,['example.com']);
  assert.deepEqual(r.removed,[]);
});
test('replace import reports removed records',()=>{
  const r=applyImport(sample,{'example.com':sample['example.com']},'replace');
  assert.deepEqual(r.removed,['brand.net']);
  assert.equal(Object.keys(r.data).length,1);
});
test('statistics reflect all inventory statuses',()=>{
  assert.deepEqual(getStatistics(sample),{total:2,for_sale:1,paused:0,reserved:0,sold:1});
});
test('CSV export does not create formula-bearing cells through validated input',()=>{
  assert.throws(()=>parseCsv('domain,price,contact\n=1+1,10,x@y.com'));
});
