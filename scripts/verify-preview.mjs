import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const origin='https://domain-sale-preview.ddli.workers.dev';
const url=origin+'/?preview=xiac.cn';
const expected=['xiac.cn','¥6,666','下厨','夏创','虾吃','夏城','i@ddli.cn'];
const result={date:new Date().toISOString(),url,checks:[]};
const check=(name,pass,detail='')=>{
  result.checks.push({name,pass,detail});
  if(!pass)throw new Error(name+' failed: '+detail);
};

async function fetchRetry(input){
  let last;
  for(let i=0;i<4;i++){
    try{
      const response=await fetch(input,{signal:AbortSignal.timeout(30000)});
      if(response.status>=500)throw new Error('HTTP '+response.status);
      return response;
    }catch(err){
      last=err;
      await new Promise(r=>setTimeout(r,1000*(i+1)));
    }
  }
  throw last;
}

const html=await fetchRetry(url);
check('HTTPS status 200',html.status===200,String(html.status));
check('Preview not indexed',html.headers.get('x-robots-tag')==='noindex, nofollow',
  String(html.headers.get('x-robots-tag')));
check('Preview not cached',html.headers.get('cache-control')==='no-store',
  String(html.headers.get('cache-control')));
const body=await html.text();
for(const term of expected)check('SSR '+term,body.includes(term));
check('Local first-party script',body.includes('src="/assets/client.js"'));
check('No public admin', (await fetchRetry(origin+'/admin')).status===404);
check('Unknown domain denied',(await fetchRetry(origin+'/?preview=example.com')).status===404);
check('Unspecified preview denied',(await fetchRetry(origin+'/')).status===404);

const asset=await fetchRetry(origin+'/assets/translate.min.js');
check('Self-hosted translate.js status',asset.status===200,String(asset.status));
const assetBody=await asset.text();
check('Pinned translate.js version',assetBody.includes('4.1.0.20260526'));
check('Pinned library actually served',assetBody.length>100000,'size='+assetBody.length);

await mkdir('smoke-results',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
  const mobile=await browser.newContext({locale:'zh-CN',viewport:{width:390,height:844}});
  const zh=await mobile.newPage();
  await zh.goto(url,{waitUntil:'networkidle',timeout:45000});
  await zh.waitForFunction(()=>document.querySelector('#sale-price')?.textContent?.includes('6,666'));
  check('Chinese auto locale',await zh.locator('html').getAttribute('lang')==='zh-CN');
  check('Chinese subtitle',await zh.locator('.subtitle').textContent()==='此域名正在出售');
  check('Chinese four meanings',await zh.locator('.meaning-chip').count()===4);
  check('Chinese fixed mailto',(await zh.locator('#contact-link').getAttribute('href')).startsWith('mailto:i@ddli.cn'));
  const width=await zh.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
  check('390px no horizontal overflow',width.scroll<=width.client+1,JSON.stringify(width));
  await zh.screenshot({path:'smoke-results/xiac-mobile-zh.png',fullPage:true});
  await mobile.close();

  const english=await browser.newContext({locale:'en-US',viewport:{width:1366,height:900}});
  const en=await english.newPage();
  await en.goto(url,{waitUntil:'networkidle',timeout:45000});
  await en.waitForFunction(()=>document.documentElement.lang==='en');
  check('English browser auto locale',await en.locator('html').getAttribute('lang')==='en');
  check('English localized subtitle',await en.locator('.subtitle').textContent()==='This domain is for sale');
  check('English seller action',await en.locator('#contact-link').textContent()==='Contact the owner');
  check('English meanings remain original',await en.locator('.meaning-chip').first().textContent()==='下厨');
  await en.screenshot({path:'smoke-results/xiac-desktop-en.png',fullPage:true});
  await en.locator('#language-select').selectOption('zh-CN');
  await en.waitForURL(/lang=zh-CN/);
  await en.waitForFunction(()=>document.documentElement.lang==='zh-CN');
  check('Manual selector retains preview domain',new URL(en.url()).searchParams.get('preview')==='xiac.cn');
  check('Manual selector translates back to Chinese',await en.locator('.subtitle').textContent()==='此域名正在出售');
  await english.close();

  const japanese=await browser.newContext({locale:'ja-JP',viewport:{width:1280,height:800}});
  const ja=await japanese.newPage();
  const translationDiagnostics=[];
  ja.on('console',entry=>{if(['error','warning'].includes(entry.type())) translationDiagnostics.push('console: '+entry.text().slice(0,400));});
  ja.on('pageerror',error=>translationDiagnostics.push('pageerror: '+error.message.slice(0,400)));
  ja.on('requestfailed',req=>translationDiagnostics.push('failed request: '+req.url().slice(0,200)+' '+String(req.failure()?.errorText||'')));
  ja.on('response',res=>{if(/edge\.microsoft\.com|translate\.zvo\.cn/.test(res.url())) translationDiagnostics.push('translation HTTP '+res.status()+' '+res.url().slice(0,150));});
  const translationAsset=ja.waitForResponse(response=>response.url().endsWith('/assets/translate.min.js'),{timeout:30000});
  await ja.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
  const translationResponse=await translationAsset;
  check('Japanese lazy bundle served',translationResponse.status()===200,String(translationResponse.status()));
  await ja.waitForFunction(()=>Boolean(window.translate&&window.translate.version),null,{timeout:25000});
  check('Japanese auto locale',await ja.locator('html').getAttribute('lang')==='ja');
  check('Pinned translate.js initialized',(await ja.evaluate(()=>window.translate.version))==='4.1.0.20260526');
  check('Japanese preserves domain meanings',await ja.locator('.meaning-chip').allTextContents()
    .then(values=>values.join('、')==='下厨、夏创、虾吃、夏城'));
  // Loading the library is not proof that the remote translation finished.
  // Allow the asynchronous Edge translator to complete and record failures explicitly.
  try {
    await ja.waitForFunction(()=>document.querySelector('.subtitle')?.textContent!=='This domain is for sale',null,{timeout:12000});
  } catch { /* Keeping the English fallback is intentional if Edge is unavailable. */ }
  result.japaneseSubtitle=await ja.locator('.subtitle').textContent();
  result.japaneseTranslationCompleted=result.japaneseSubtitle!=='This domain is for sale';
  result.translationDiagnostics=translationDiagnostics.slice(0,20);
  await ja.screenshot({path:'smoke-results/xiac-desktop-ja.png',fullPage:true});
  await japanese.close();
}finally{
  await browser.close();
}

await writeFile('smoke-results/result.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({passed:result.checks.length,tests:result.checks.map(c=>c.name),
  japaneseSubtitle:result.japaneseSubtitle},null,2));
