import test from 'node:test';
import assert from 'node:assert/strict';
import inventory from '../src/domains.json' with {type:'json'};
import {validateInventory,normalizeDomainKey,SALE_STATUSES} from '../scripts/validate-domains.mjs';

const example={price:8888,currency:'CNY',contact:'seller@example.com',status:'for_sale'};

test('repository domain inventory is valid',()=>assert.equal(validateInventory(inventory),Object.keys(inventory).length));
test('supports conventional and punycode domains',()=>{
  assert.equal(normalizeDomainKey('example.com'),'example.com');
  assert.equal(normalizeDomainKey('xn--bcher-kva.de'),'xn--bcher-kva.de');
});
test('rejects non-canonical names, URLs and host aliases',()=>{
  for(const key of ['WWW.example.com','www.example.com','Example.COM','example.com.','example.com/path','https://example.com','example..com','-bad.com','example.localhost','example.123']){
    assert.throws(()=>normalizeDomainKey(key),key);
  }
});
test('allows paused, reserved or sold status',()=>{
  for(const status of SALE_STATUSES){
    const data={'example.com':{...example,status}};
    assert.equal(validateInventory(data),1);
  }
});
test('for_sale records cannot have zero or negative price',()=>{
  for(const price of [0,-5,1.234,Number.MAX_VALUE]){
    assert.throws(()=>validateInventory({'example.com':{...example,price}}));
  }
});
test('sold records may have zero price',()=>{
  assert.equal(validateInventory({'example.com':{...example,status:'sold',price:0}}),1);
});
test('supports cents but rejects string or non-finite amounts',()=>{
  assert.equal(validateInventory({'example.com':{...example,price:199.99}}),1);
  assert.throws(()=>validateInventory({'example.com':{...example,price:'199.99'}}));
  assert.throws(()=>validateInventory({'example.com':{...example,price:Infinity}}));
});
test('rejects malformed currency, email and extra config fields',()=>{
  assert.throws(()=>validateInventory({'example.com':{...example,currency:'usd'}}));
  assert.throws(()=>validateInventory({'example.com':{...example,contact:'bad <script>@example.com'}}));
  assert.throws(()=>validateInventory({'example.com':{...example,secret:'do-not-commit'}}));
});
test('rejects arrays and invalid records',()=>{
  assert.throws(()=>validateInventory([]));
  assert.throws(()=>validateInventory({'example.com':null}));
});
