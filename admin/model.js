// Shared, dependency-free data model for the local domain inventory editor.
export const STATUSES = Object.freeze(['for_sale', 'paused', 'reserved', 'sold']);
export const COLUMNS = Object.freeze(['domain', 'price', 'currency', 'contact', 'status']);
const HEADER_ALIASES = Object.freeze({
  domain:'domain', '域名':'domain',
  price:'price', '售价':'price', '价格':'price',
  currency:'currency', '币种':'currency',
  contact:'contact', '联系方式':'contact', '邮箱':'contact',
  status:'status', '状态':'status'
});
const STATUS_ALIASES = Object.freeze({
  for_sale:'for_sale', '出售中':'for_sale',
  paused:'paused', '暂停':'paused', '暂停出售':'paused',
  reserved:'reserved', '预留':'reserved',
  sold:'sold', '已售出':'sold'
});

export function normalizeDomain(value) {
  if (typeof value !== 'string') throw new Error('域名必须是字符串');
  const domain = value.trim().toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
  if (domain.length > 253) throw new Error('域名不能超过 253 个字符');
  const labels = domain.split('.');
  if (labels.length < 2 || labels.some(label =>
      !label || label.length > 63 ||
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) {
    throw new Error('域名格式不正确：' + value);
  }
  if (!/[a-z]/.test(labels.at(-1)) || /^\d+$/.test(labels.at(-1))) {
    throw new Error('顶级域名格式不正确：' + value);
  }
  return domain;
}

export function validateEntry(domainInput, entry) {
  const domain = normalizeDomain(domainInput);
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new Error(domain + '：域名配置必须是对象');
  }
  const statusInput = String(entry.status ?? 'for_sale').trim();
  const status = STATUS_ALIASES[statusInput];
  if (!status || !STATUSES.includes(status)) {
    throw new Error(domain + '：无效的出售状态 ' + statusInput);
  }
  const priceText = String(entry.price ?? '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(priceText)) {
    throw new Error(domain + '：售价必须为非负数字，最多两位小数');
  }
  const price = Number(priceText);
  if (!Number.isFinite(price) || price > 1_000_000_000_000 || (status === 'for_sale' && price <= 0)) {
    throw new Error(domain + '：售价不符合要求');
  }
  const currency = String(entry.currency ?? 'CNY').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error(domain + '：币种必须是三位 ISO 代码');
  const contact = String(entry.contact ?? '').trim();
  if (contact.length > 254 ||
      !/^[^\s@<>]+@[^\s@<>]+\.[a-zA-Z0-9-]{2,}$/.test(contact)) {
    throw new Error(domain + '：联系方式需要填写有效的公开联系邮箱');
  }
  return {domain, record:{price,currency,contact,status}};
}

export function validateInventory(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('域名数据必须是以域名为键的 JSON 对象');
  }
  if (Object.keys(raw).length > 10000) throw new Error('单次最多维护 10000 个域名');
  const output = Object.create(null);
  for (const [key, value] of Object.entries(raw)) {
    const {domain,record} = validateEntry(key,value);
    if (Object.hasOwn(output,domain)) throw new Error('重复域名：' + domain);
    output[domain] = record;
  }
  return Object.fromEntries(Object.entries(output).sort(([a],[b])=>a.localeCompare(b,'en')));
}

export function parseJson(text) {
  let parsed;
  try { parsed = JSON.parse(String(text).replace(/^\uFEFF/,'')); }
  catch (e) { throw new Error('JSON 解析失败：' + e.message); }
  return validateInventory(parsed);
}

export function toJson(inventory) {
  return JSON.stringify(validateInventory(inventory),null,2) + '\n';
}

export function parseCsvRows(source) {
  const input = String(source).replace(/^\uFEFF/,'');
  const rows = [];
  let row = [], value = '', quoted = false, quoteClosed = false;
  for (let i=0;i<input.length;i++) {
    const ch=input[i];
    if (quoted) {
      if (ch === '"') {
        if (input[i+1] === '"') { value+='"';i++; }
        else { quoted=false;quoteClosed=true; }
      } else value+=ch;
      continue;
    }
    if (ch === '"') {
      if (value || quoteClosed) throw new Error('CSV 引号位置不正确');
      quoted=true;
    } else if (ch === ',') {
      row.push(value);value='';quoteClosed=false;
    } else if (ch === '\r' || ch === '\n') {
      row.push(value);
      if (row.some(x=>x !== '')) rows.push(row);
      row=[];value='';quoteClosed=false;
      if (ch === '\r' && input[i+1] === '\n') i++;
    } else {
      if (quoteClosed && ch !== ' ' && ch !== '\t') throw new Error('CSV 引号后出现无效字符');
      if (!quoteClosed) value+=ch;
    }
  }
  if (quoted) throw new Error('CSV 存在未闭合的引号');
  row.push(value);
  if (row.some(x=>x !== '')) rows.push(row);
  return rows;
}

export function parseCsv(source) {
  const rows=parseCsvRows(source);
  if (!rows.length) throw new Error('CSV 文件为空');
  const headers=rows[0].map(x=>HEADER_ALIASES[x.trim().toLowerCase()] || '');
  for (const field of ['domain','price','contact']) {
    if (!headers.includes(field)) throw new Error('CSV 缺少必需列：' + field);
  }
  if (new Set(headers.filter(Boolean)).size !== headers.filter(Boolean).length) {
    throw new Error('CSV 存在重复表头');
  }
  if (headers.includes('') || headers.length !== new Set(headers).size) {
    throw new Error('CSV 包含不支持的表头');
  }
  const result=Object.create(null);
  for (let index=1;index<rows.length;index++) {
    const row=rows[index];
    if (row.length !== headers.length) throw new Error('CSV 第 '+(index+1)+' 行列数不符');
    const entry=Object.fromEntries(headers.map((name,i)=>[name,row[i]]));
    let parsed;
    try { parsed=validateEntry(entry.domain,entry); }
    catch (e) { throw new Error('CSV 第 '+(index+1)+' 行：'+e.message); }
    if (Object.hasOwn(result,parsed.domain)) throw new Error('CSV 重复域名：'+parsed.domain);
    result[parsed.domain]=parsed.record;
  }
  return validateInventory(result);
}

export function toCsv(inventory) {
  const validated=validateInventory(inventory);
  const quote=value=> {
    const s=String(value);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
  };
  const rows=[COLUMNS.join(',')];
  for (const [domain,item] of Object.entries(validated)) {
    rows.push([domain,item.price,item.currency,item.contact,item.status].map(quote).join(','));
  }
  return '\uFEFF'+rows.join('\r\n')+'\r\n';
}

export function applyImport(existing, incoming, mode='merge') {
  if (!['merge','replace'].includes(mode)) throw new Error('不支持的导入模式');
  const base=validateInventory(existing);
  const next=validateInventory(incoming);
  const overwritten=Object.keys(next).filter(name=>Object.hasOwn(base,name));
  return {
    data:validateInventory(mode==='replace'?next:{...base,...next}),
    imported:Object.keys(next).length,
    overwritten,
    removed:mode==='replace'?Object.keys(base).filter(name=>!Object.hasOwn(next,name)):[]
  };
}

export function getStatistics(inventory) {
  const values=Object.values(validateInventory(inventory));
  return {
    total:values.length,
    for_sale:values.filter(v=>v.status==='for_sale').length,
    paused:values.filter(v=>v.status==='paused').length,
    reserved:values.filter(v=>v.status==='reserved').length,
    sold:values.filter(v=>v.status==='sold').length
  };
}
