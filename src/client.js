// This function is serialized into the browser script by the Worker.
// It must remain self-contained and must not reference module-level values.
export function initClient() {
  'use strict';
  const texts = {
    'zh-CN': {
      badge:'PREMIUM DOMAIN', subtitle:'此域名正在出售', price:'出售价格',
      meaning:'域名寓意', contact:'联系卖家',
      footer:'有意购买？欢迎联系域名所有者。',
      subject:'域名购买咨询：', title:'域名出售'
    },
    en: {
      badge:'PREMIUM DOMAIN', subtitle:'This domain is for sale', price:'Asking price',
      meaning:'Chinese name associations', contact:'Contact the owner',
      footer:'Interested in this domain? Contact the owner.',
      subject:'Domain purchase inquiry: ', title:'Domain for sale'
    }
  };
  const providers = {
    'zh-TW':'chinese_traditional', ja:'japanese', ko:'korean',
    fr:'french', de:'german', es:'spanish', ru:'russian',
    pt:'portuguese', ar:'arabic', th:'thai', vi:'vietnamese',
    id:'indonesian', it:'italian', nl:'dutch'
  };
  const supported = ['zh-CN','zh-TW','en',...Object.keys(providers).filter(v=>v!=='zh-TW')];
  function normalizeLocale(raw) {
    const lang=String(raw||'').trim().replace(/_/g,'-').toLowerCase();
    if(lang.startsWith('zh')){
      return /(?:tw|hk|mo|hant)/.test(lang)?'zh-TW':'zh-CN';
    }
    const root=lang.split('-')[0];
    if(root==='en')return 'en';
    return Object.hasOwn(providers,root)?root:'en';
  }
  const params=new URL(window.location.href).searchParams;
  const override=params.get('lang');
  const browserLanguage=Array.isArray(navigator.languages)&&navigator.languages.length?
    navigator.languages[0]:(navigator.language||'zh-CN');
  const locale=override&&supported.includes(override)?override:normalizeLocale(browserLanguage);
  const select=document.getElementById('language-select');
  if(select){
    select.value=override&&supported.includes(override)?override:'auto';
    select.addEventListener('change',function(){
      const url=new URL(window.location.href);
      if(select.value==='auto')url.searchParams.delete('lang');
      else url.searchParams.set('lang',select.value);
      window.location.assign(url.toString());
    });
  }
  function localize(language) {
    const words=language==='zh-CN'?texts['zh-CN']:texts.en;
    document.documentElement.lang=language;
    document.documentElement.dir=language==='ar'?'rtl':'ltr';
    document.querySelectorAll('[data-i18n]').forEach(function(node){
      const key=node.getAttribute('data-i18n');
      if(Object.hasOwn(words,key))node.textContent=words[key];
    });
    const domain=document.getElementById('sale-domain').textContent;
    const price=document.getElementById('sale-price');
    if(price){
      try{
        price.textContent=new Intl.NumberFormat(language,{
          style:'currency',currency:price.getAttribute('data-currency'),
          minimumFractionDigits:0,maximumFractionDigits:2
        }).format(Number(price.getAttribute('data-amount')));
      }catch(error){/* Keep server-rendered asking price. */}
    }
    const mail=document.getElementById('contact-link');
    const address=document.getElementById('contact-email');
    if(mail && address){
      const href='mailto:'+mail.getAttribute('data-email')+'?subject='+
        encodeURIComponent(words.subject+domain);
      mail.href=href;address.href=href;
    }
    document.title=domain+' · '+words.title;
  }
  localize(locale);
  if(locale==='zh-CN'||locale==='en'||!Object.hasOwn(providers,locale))return;
  // The translator is pinned and self-hosted. Chinese brand puns stay untouched.
  const loader=document.createElement('script');
  loader.src='/assets/translate.min.js';
  loader.async=true;
  loader.onload=function(){
    try{
      const t=window.translate;
      if(!t||!t.language||!t.service||!t.ignore)return;
      t.language.setLocal('english');
      t.language.setDefaultTo(providers[locale]);
      t.selectLanguageTag.show=false;
      t.service.use('client.edge');
      // client.edge translates through Microsoft directly; no IP lookup or
      // translate.zvo.cn initialization/probing requests are needed.
      if(t.request && t.request.api){
        ['connectTest','init','ip','language'].forEach(function(key){t.request.api[key]='';});
      }
      ['sale-domain','sale-price','meaning-chips','contact-email','language-select']
        .forEach(function(id){t.ignore.id.push(id);});
      t.language.translateLanguagesRange=['english'];
      // Language choice is already derived from the browser or ?lang.
      // Avoid IP geolocation so no visitor address needs to be looked up.
      t.execute();
    }catch(error){
      console.warn('Translation unavailable; using English fallback',error);
    }
  };
  loader.onerror=function(){console.warn('translate.js unavailable; using English fallback');};
  document.head.appendChild(loader);
}
