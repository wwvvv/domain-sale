import domains from './domains.json' with { type: 'json' };

export function normalizeHost(value) {
  const host = (value || '').trim().toLowerCase().replace(/\.$/, '');
  if (!/^[a-z0-9.-]+$/.test(host) || host.includes('..')) return '';
  return host.replace(/^www\./, '');
}

export function renderDomain(host) {
  const domain = normalizeHost(host);
  const config = Object.hasOwn(domains, domain) ? domains[domain] : null;
  if (!config || config.status !== 'for_sale' || !Number.isFinite(config.price) ||
      config.price < 0 || !/^[A-Z]{3}$/.test(config.currency) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.contact)) return null;
  const data = JSON.stringify({domain,price:config.price,currency:config.currency,contact:config.contact})
    .replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#101827"><title>Domain for sale</title>
<style>:root{color-scheme:dark;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
*{box-sizing:border-box}body{margin:0;background:#101827;color:#fff;min-height:100vh;display:grid;place-items:center}
main{text-align:center;padding:32px 20px;width:100%;max-width:800px}
.eyebrow{color:#a5b4fc;letter-spacing:.16em;font-size:12px;font-weight:700}
h1{font-size:clamp(38px,8vw,76px);overflow-wrap:anywhere;letter-spacing:-.05em;margin:28px 0 10px}
p{color:#94a3b8}.price{font-size:clamp(30px,5vw,44px);font-weight:750;margin:28px 0}
a{display:inline-flex;padding:14px 28px;background:#6366f1;color:white;text-decoration:none;border-radius:12px;font-weight:650}
a:hover{background:#4f46e5}footer{margin-top:64px;color:#64748b;font-size:12px}</style>
</head><body><main><div class="eyebrow">DOMAIN FOR SALE</div><p>此域名正在出售</p>
<h1 id="domain"></h1><div class="price" id="price"></div><a id="contact" rel="nofollow">联系卖家</a>
<footer>Domain for sale · Contact the owner</footer></main>
<script>const d=${data};document.getElementById('domain').textContent=d.domain;
document.getElementById('price').textContent=new Intl.NumberFormat('zh-CN',{style:'currency',currency:d.currency,maximumFractionDigits:0}).format(d.price);
document.getElementById('contact').href='mailto:'+d.contact+'?subject='+encodeURIComponent('域名购买咨询：'+d.domain);
document.title=d.domain+' | 域名出售';</script></body></html>`;
}
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== '/') return new Response('Not Found',{status:404});
    // Allow sample-domain previews only on workers.dev, never on sale domains.
    const isWorkersDev = /^[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev$/.test(url.hostname.toLowerCase());
    const previewDomain = isWorkersDev ? url.searchParams.get('preview') : null;
    if (isWorkersDev && !previewDomain) return new Response('Not Found',{status:404});
    const html = renderDomain(previewDomain || url.hostname);
    if (!html) return new Response('Not Found',{status:404});
    return new Response(html,{headers:{
      'content-type':'text/html; charset=utf-8',
      'cache-control':isWorkersDev ? 'no-store' : 'public, max-age=300',
      'x-robots-tag':isWorkersDev ? 'noindex, nofollow' : 'all',
      'x-content-type-options':'nosniff',
      'referrer-policy':'no-referrer',
      'content-security-policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
    }});
  }
};
