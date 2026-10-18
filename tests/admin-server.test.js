import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminServer} from '../scripts/admin-server.mjs';

test('admin server exposes only the local allowlisted static assets',async()=>{
  const server=createAdminServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const base='http://127.0.0.1:'+server.address().port;
    const home=await fetch(base+'/admin/');
    assert.equal(home.status,200);
    assert.match(await home.text(),/域名出售管理/);
    assert.equal(home.headers.get('cache-control'),'no-store');
    assert.match(home.headers.get('content-security-policy'),/api.github.com/);

    const script=await fetch(base+'/admin/app.js');
    assert.equal(script.status,200);
    assert.match(await script.text(),/createPr/);

    const inventory=await fetch(base+'/src/domains.json');
    assert.equal(inventory.status,200);
    const inventoryData=await inventory.json();
    assert.equal(typeof inventoryData,'object');
    assert.equal(Array.isArray(inventoryData),false);

    const denied=await fetch(base+'/src/index.js');
    assert.equal(denied.status,404);

    const deniedFile=await fetch(base+'/.github/workflows/validate.yml');
    assert.equal(deniedFile.status,404);

    const invalidMethod=await fetch(base+'/admin/',{method:'POST'});
    assert.equal(invalidMethod.status,405);

    const head=await fetch(base+'/admin/',{method:'HEAD'});
    assert.equal(head.status,200);
    assert.equal(await head.text(),'');
  }finally{await new Promise(resolve=>server.close(resolve));}
});
