import domains from './domains.json' with {type:'json'};
import site from './site.json' with {type:'json'};
import template from './template.json' with {type:'json'};
import translateVendor from './vendor/translate.min.json' with {type:'json'};
import {initClient} from './client.js';

const CLIENT_SCRIPT='('+initClient.toString()+')();';
const SCRIPT_HEADERS={
  'content-type':'application/javascript; charset=utf-8',
  'cache-control':'public, max-age=86400',
  'x-content-type-options':'nosniff',
  'x-robots-tag':'noindex, nofollow'
};

export function normalizeHost(value){
  const host=String(value||'').trim().toLowerCase().replace(/\.$/,'');
  if(!/^[a-z0-9.-]+$/.test(host)||host.includes('..'))return '';
  return host.replace(/^www\./,'');
}
export function escapeHtml(value){
  return String(value).replace(/[&<>"']/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));
}

export function renderDomain(host,inventory=domains,settings=site){
  const domain=normalizeHost(host);
  const entry=Object.hasOwn(inventory,domain)?inventory[domain]:null;
  if(!entry||entry.status!=='for_sale'||!Number.isFinite(entry.price)||
     entry.price<=0||!/^[A-Z]{3}$/.test(entry.currency))return null;
  const email=String(settings?.contactEmail||'');
  if(!/^[^\s@<>]+@[^\s@<>]+\.[a-zA-Z0-9-]{2,}$/.test(email))return null;
  const meanings=Array.isArray(entry.meanings)?entry.meanings:[];
  const formattedPrice=new Intl.NumberFormat('zh-CN',{
    style:'currency',currency:entry.currency,minimumFractionDigits:0,
    maximumFractionDigits:2
  }).format(entry.price);
  const contact='mailto:'+email+'?subject='+encodeURIComponent('域名购买咨询：'+domain);
  const meaningMarkup=meanings.length?[
    '<section class="meaning" aria-labelledby="meaning-heading">',
    '<div class="section-label" id="meaning-heading" data-i18n="meaning">域名寓意</div>',
    '<div class="meaning-chips" id="meaning-chips">',
    ...meanings.map(word=>'<span class="meaning-chip">'+escapeHtml(word)+'</span>'),
    '</div></section>'
  ].join(''):'';
  const description=[domain,'域名出售','售价'+formattedPrice,...meanings].join('，');
  const replacements={
    DESCRIPTION:escapeHtml(description),DOMAIN:escapeHtml(domain),
    AMOUNT:escapeHtml(entry.price),CURRENCY:escapeHtml(entry.currency),
    PRICE:escapeHtml(formattedPrice),EMAIL:escapeHtml(email),
    CONTACT_HREF:escapeHtml(contact),MEANING_SECTION:meaningMarkup
  };
  return template.html.replace(/\{\{([A-Z_]+)\}\}/g,(_,key)=>replacements[key]??'');
}

export async function handleRequest(request,inventory=domains,settings=site){
  const url=new URL(request.url);
  const method=request.method||'GET';
  if(method!=='GET'&&method!=='HEAD')
    return new Response('Method Not Allowed',{status:405,headers:{allow:'GET, HEAD'}});
  if(url.pathname==='/assets/client.js')
    return new Response(method==='HEAD'?null:CLIENT_SCRIPT,{headers:SCRIPT_HEADERS});
  if(url.pathname==='/assets/translate.min.js')
    return new Response(method==='HEAD'?null:translateVendor.script,{headers:SCRIPT_HEADERS});
  if(url.pathname!=='/')return new Response('Not Found',{status:404});

  const isWorkersDev=/^[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev$/.test(url.hostname.toLowerCase());
  const previewDomain=isWorkersDev?url.searchParams.get('preview'):null;
  if(isWorkersDev&&!previewDomain)return new Response('Not Found',{status:404});
  const html=renderDomain(previewDomain||url.hostname,inventory,settings);
  if(!html)return new Response('Not Found',{status:404});
  return new Response(method==='HEAD'?null:html,{headers:{
    'content-type':'text/html; charset=utf-8',
    'cache-control':isWorkersDev?'no-store':'public, max-age=300',
    'x-robots-tag':isWorkersDev?'noindex, nofollow':'all',
    'x-content-type-options':'nosniff',
    'referrer-policy':'no-referrer',
    'content-security-policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self' https://edge.microsoft.com; base-uri 'none'; object-src 'none'; form-action 'none'; frame-ancestors 'none'"
  }});
}

export default {fetch(request){return handleRequest(request);}};
