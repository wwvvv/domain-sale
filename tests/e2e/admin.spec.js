import {test, expect} from '@playwright/test';

const data = {
  'example.com': {price:8888,currency:'CNY',contact:'seller@example.com',status:'for_sale'},
  'example.net': {price:12800,currency:'CNY',contact:'seller@example.com',status:'for_sale'}
};
const b64=Buffer.from(JSON.stringify(data)).toString('base64');
const mainSha='e2e-fixture-sha';

async function prepare(page, capture = null) {
  await page.route('https://api.github.com/**', async route => {
    const req=route.request();
    const url=new URL(req.url());
    const method=req.method();
    const responseHeaders={
      'access-control-allow-origin':'*',
      'access-control-allow-methods':'GET, POST, PUT, OPTIONS',
      'access-control-allow-headers':'authorization, content-type, accept',
      'access-control-max-age':'600'
    };
    if(method==='OPTIONS') {
      await route.fulfill({status:204,headers:responseHeaders});
      return;
    }
    const path=url.pathname;
    if(capture)capture.push({method,path,body:req.postDataJSON?.()});
    let body=null;
    if(path==='/repos/wwvvv/domain-sale/contents/src/domains.json' && method==='GET') {
      body={sha:mainSha,content:b64};
    } else if(path==='/user' && method==='GET') {
      body={login:'wwvvv'};
    } else if(path==='/repos/wwvvv/domain-sale' && method==='GET') {
      body={permissions:{push:true}};
    } else if(path==='/repos/wwvvv/domain-sale/git/ref/heads/main' && method==='GET') {
      body={object:{sha:'e2e-main-commit-sha'}};
    } else if(path==='/repos/wwvvv/domain-sale/git/refs' && method==='POST') {
      body={ref:'refs/heads/domain-sale/manage-e2e'};
    } else if(path==='/repos/wwvvv/domain-sale/contents/src/domains.json' && method==='PUT') {
      body={content:{sha:'mock-updated-sha'}};
    } else if(path==='/repos/wwvvv/domain-sale/pulls' && method==='POST') {
      body={number:42,html_url:'https://github.com/wwvvv/domain-sale/pull/42'};
    } else {
      await route.fulfill({status:404,headers:responseHeaders,contentType:'application/json',
        body:JSON.stringify({message:'Unexpected mock request '+method+' '+path})});
      return;
    }
    await route.fulfill({status:200,headers:responseHeaders,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('/admin/');
  await expect(page.locator('#sourceStatus')).toContainText('已同步 GitHub');
}

test('desktop inventory renders correctly and supports add/edit/filter/delete',async ({page}) => {
  await page.setViewportSize({width:1366,height:900});
  await prepare(page);
  await expect(page.locator('#totalCount')).toHaveText('2');
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await page.screenshot({path:'test-results/domain-manager-desktop.png',fullPage:true});

  await page.locator('#addBtn').click();
  await page.locator('#domainInput').fill('newdomain.org');
  await page.locator('#priceInput').fill('199.50');
  await page.locator('#currencyInput').selectOption('USD');
  await page.locator('#contactInput').fill('sales@example.org');
  await page.locator('#domainForm button[type=submit]').click();
  await expect(page.locator('#totalCount')).toHaveText('3');
  await expect(page.locator('#domainTable')).toContainText('newdomain.org');

  await page.locator('#searchInput').fill('newdomain');
  await expect(page.locator('#domainTable tr')).toHaveCount(1);
  await page.locator('#domainTable .action-link').first().click();
  await page.locator('#priceInput').fill('250');
  await page.locator('#statusInput').selectOption('sold');
  await page.locator('#domainForm button[type=submit]').click();
  await expect(page.locator('#soldCount')).toHaveText('1');
  await page.locator('#filterSelect').selectOption('sold');
  await expect(page.locator('#domainTable tr')).toHaveCount(1);
  await expect(page.locator('#domainTable')).toContainText('newdomain.org');
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#domainTable .action-link.delete').click();
  await expect(page.locator('#totalCount')).toHaveText('2');
});

test('mobile layout has no horizontal document overflow',async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await prepare(page);
  await expect(page.getByRole('heading',{name:'域名出售管理'})).toBeVisible();
  await expect(page.locator('#addBtn')).toBeVisible();
  const widths=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client+1);
  await page.screenshot({path:'test-results/domain-manager-mobile-390.png',fullPage:true});
});

test('CSV import and export preserve edited inventory',async ({page}) => {
  await prepare(page);
  const chooserEvent=page.waitForEvent('filechooser');
  await page.locator('#importCsvBtn').click();
  const chooser=await chooserEvent;
  await chooser.setFiles({
    name:'new.csv',mimeType:'text/csv',
    buffer:Buffer.from('domain,price,currency,contact,status\r\nimported.dev,500,USD,hi@example.dev,for_sale\r\n')
  });
  await expect(page.locator('#totalCount')).toHaveText('3');
  const downloadEvent=page.waitForEvent('download');
  await page.locator('#exportCsvBtn').click();
  const download=await downloadEvent;
  expect(download.suggestedFilename()).toBe('domain-sale-domains.csv');
  await expect(page.locator('#domainTable')).toContainText('imported.dev');
});

test('GitHub PR submission creates a branch and leaves main unchanged',async ({page}) => {
  const calls=[];
  await prepare(page,calls);
  await page.locator('#addBtn').click();
  await page.locator('#domainInput').fill('feature.io');
  await page.locator('#priceInput').fill('99');
  await page.locator('#contactInput').fill('seller@example.io');
  await page.locator('#domainForm button[type=submit]').click();
  await page.locator('#tokenInput').fill('github_pat_test_not_real');
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#prBtn').click();
  await expect(page.locator('#prResult')).toContainText('PR #42');
  const create=calls.find(x=>x.method==='POST'&&x.path.endsWith('/git/refs'));
  const update=calls.find(x=>x.method==='PUT'&&x.path.endsWith('/contents/src/domains.json'));
  const pr=calls.find(x=>x.method==='POST'&&x.path.endsWith('/pulls'));
  expect(create).toBeTruthy();
  expect(update?.body?.branch).toMatch(/^domain-sale\/manage-/);
  expect(update?.body?.sha).toBe(mainSha);
  expect(pr?.body?.base).toBe('main');
  expect(await page.locator('#tokenInput').inputValue()).toBe('');
});

test('editor is not publicly exposed by the Worker and loopback server rejects source path',async({page})=>{
  const response=await page.request.get('/src/index.js');
  expect(response.status()).toBe(404);
  const response2=await page.request.get('/.github/workflows/deploy-preview.yml');
  expect(response2.status()).toBe(404);
});
