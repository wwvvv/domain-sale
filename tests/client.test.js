import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {initClient} from '../src/client.js';

function browserStub({locale='zh-CN',override=null}={}){
  const nodes={};
  function element(id){
    if(!nodes[id]){
      const attrs={};
      nodes[id]={
        id,textContent:id==='sale-domain'?'xiac.cn':'',
        href:'',value:'',getAttribute:key=>attrs[key]??null,
        setAttribute:(key,value)=>{attrs[key]=value;},
        addEventListener:(event,handler)=>{nodes[id].handlers[event]=handler;},
        handlers:{},
        querySelector:()=>true
      };
    }
    return nodes[id];
  }
  element('sale-price').setAttribute('data-currency','CNY');
  element('sale-price').setAttribute('data-amount','6666');
  element('contact-link').setAttribute('data-email','i@ddli.cn');
  const i18n=['badge','subtitle','price','meaning','contact','footer'].map(key=>{
    const n=element('text-'+key);
    n.getAttribute=k=>k==='data-i18n'?key:null;
    return n;
  });
  const spawned=[];
  const document={
    documentElement:{lang:'zh-CN',dir:'ltr'},
    title:'',
    getElementById:element,
    querySelectorAll:()=>i18n,
    createElement:type=>({type,src:'',async:false,onload:null,onerror:null}),
    head:{appendChild:el=>spawned.push(el)}
  };
  const url=new URL('https://domain-sale-preview.ddli.workers.dev/?preview=xiac.cn'+
    (override?'&lang='+encodeURIComponent(override):''));
  const assigned=[];
  const window={location:{href:url.href,assign:href=>assigned.push(href)}};
  const navigator={languages:[locale],language:locale};
  const warnings=[];
  const globals={document,window,navigator,URL,Intl,console:{warn:(...args)=>warnings.push(args)}};
  vm.runInNewContext('('+initClient.toString()+')();',globals,{timeout:1000});
  return{nodes,document,window,navigator,spawned,assigned,warnings};
}

test('Simplified Chinese browser uses Chinese without translation requests',()=>{
  const t=browserStub({locale:'zh-CN'});
  assert.equal(t.document.documentElement.lang,'zh-CN');
  assert.equal(t.nodes['text-subtitle'].textContent,'此域名正在出售');
  assert.equal(t.nodes['sale-price'].textContent,'¥6,666');
  assert.equal(t.spawned.length,0);
});
test('English browser automatically switches to English without external calls',()=>{
  const t=browserStub({locale:'en-US'});
  assert.equal(t.document.documentElement.lang,'en');
  assert.equal(t.nodes['text-subtitle'].textContent,'This domain is for sale');
  assert.equal(t.nodes['text-contact'].textContent,'Contact the owner');
  assert.match(t.nodes['contact-link'].href,/Domain%20purchase%20inquiry/);
  assert.match(t.nodes['sale-price'].textContent,/6,666/);
  assert.equal(t.spawned.length,0);
});
test('manual language query overrides the browser language',()=>{
  const t=browserStub({locale:'en-US',override:'zh-CN'});
  assert.equal(t.document.documentElement.lang,'zh-CN');
  assert.equal(t.nodes['language-select'].value,'zh-CN');
  assert.equal(t.spawned.length,0);
});
test('Japanese browser lazily loads locally pinned translate.js',()=>{
  const t=browserStub({locale:'ja-JP'});
  assert.equal(t.spawned.length,1);
  assert.equal(t.spawned[0].src,'/assets/translate.min.js');
  const calls=[],ignored=[];
  t.window.translate={
    language:{
      setLocal:lang=>calls.push(['local',lang]),
      setDefaultTo:lang=>calls.push(['to',lang])
    },
    service:{use:name=>calls.push(['service',name])},
    selectLanguageTag:{show:true},
    ignore:{id:ignored},
    execute:()=>calls.push(['execute'])
  };
  t.spawned[0].onload();
  assert.ok(calls.some(x=>x[0]==='to'&&x[1]==='japanese'));
  assert.ok(calls.some(x=>x[0]==='service'&&x[1]==='client.edge'));
  assert.ok(ignored.includes('meaning-chips'));
  assert.ok(ignored.includes('sale-price'));
  assert.equal(t.window.translate.selectLanguageTag.show,false);
});
test('language picker retains preview query and supports auto reset',()=>{
  const t=browserStub({locale:'en-GB'});
  t.nodes['language-select'].value='ja';
  t.nodes['language-select'].handlers.change();
  const parsed=new URL(t.assigned[0]);
  assert.equal(parsed.searchParams.get('preview'),'xiac.cn');
  assert.equal(parsed.searchParams.get('lang'),'ja');
});
test('translation loading errors preserve the English fallback',()=>{
  const t=browserStub({locale:'de-DE'});
  assert.equal(t.nodes['text-subtitle'].textContent,'This domain is for sale');
  t.spawned[0].onerror();
  assert.equal(t.warnings.length,1);
  assert.equal(t.nodes['text-subtitle'].textContent,'This domain is for sale');
});
