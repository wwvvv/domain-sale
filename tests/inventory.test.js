import test from 'node:test';
import assert from 'node:assert/strict';
import inventory from '../src/domains.json' with {type:'json'};
import site from '../src/site.json' with {type:'json'};
import {validateInventory,validateSite,normalizeDomainKey,SALE_STATUSES} from '../scripts/validate-domains.mjs';

const sample={price:8888,currency:'CNY',status:'for_sale'};

test('repository inventory and shared site settings are valid',()=>{
  assert.equal(validateInventory(inventory),1);
  assert.equal(validateSite(site),true);
  assert.equal(site.contactEmail,'i@ddli.cn');
});
test('xiac.cn exact listing and Chinese associations',()=>{
  assert.deepEqual(inventory['xiac.cn'],{
    price:6666,currency:'CNY',status:'for_sale',
    meanings:['下厨','夏创','虾吃','夏城']
  });
});
test('supports conventional and punycode domains',()=>{
  assert.equal(normalizeDomainKey('xiac.cn'),'xiac.cn');
  assert.equal(normalizeDomainKey('xn--bcher-kva.de'),'xn--bcher-kva.de');
});
test('rejects non-canonical keys',()=>{
  for(const key of ['WWW.xiac.cn','www.xiac.cn','Xiac.CN','xiac.cn.','xiac.cn/path','https://xiac.cn','example..com','-bad.com','example.localhost','example.123']){
    assert.throws(()=>normalizeDomainKey(key),key);
  }
});
test('supports lifecycle status values',()=>{
  for(const status of SALE_STATUSES){
    assert.equal(validateInventory({'xiac.cn':{...sample,status}}),1);
  }
});
test('for_sale record requires positive price',()=>{
  for(const price of [0,-5,1.234,Number.MAX_VALUE]){
    assert.throws(()=>validateInventory({'xiac.cn':{...sample,price}}));
  }
});
test('other states may have a zero price',()=>{
  assert.equal(validateInventory({'xiac.cn':{...sample,price:0,status:'sold'}}),1);
});
test('supports cents and rejects invalid amounts',()=>{
  assert.equal(validateInventory({'xiac.cn':{...sample,price:199.99}}),1);
  assert.throws(()=>validateInventory({'xiac.cn':{...sample,price:'199.99'}}));
  assert.throws(()=>validateInventory({'xiac.cn':{...sample,price:Infinity}}));
});
test('rejects extra fields and per-domain contact overrides',()=>{
  assert.throws(()=>validateInventory({'xiac.cn':{...sample,contact:'wrong@example.com'}}));
  assert.throws(()=>validateInventory({'xiac.cn':{...sample,secret:'do-not-commit'}}));
  assert.throws(()=>validateInventory({'xiac.cn':{...sample,currency:'usd'}}));
});
test('rejects malformed domain meaning arrays',()=>{
  assert.throws(()=>validateInventory({'xiac.cn':{...sample,meanings:'下厨'}}));
  assert.throws(()=>validateInventory({'xiac.cn':{...sample,meanings:['下厨','下厨']}}));
  assert.throws(()=>validateInventory({'xiac.cn':{...sample,meanings:['<script>','a\nb']}}));
});
test('rejects invalid site contact emails',()=>{
  assert.throws(()=>validateSite({...site,contactEmail:'bad email'}));
  assert.throws(()=>validateSite({...site,contactEmail:'x@y.com',sourceLanguage:'en'}));
  assert.throws(()=>validateSite({...site,other:'bad'}));
});
