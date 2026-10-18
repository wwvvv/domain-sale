import domains from '../src/domains.json' with {type:'json'};
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export const SALE_STATUSES=['for_sale','paused','reserved','sold'];

export function normalizeDomainKey(input) {
  if(typeof input!=='string') throw new Error('Domain must be text');
  const name=input.trim().toLowerCase().replace(/\.$/,'');
  if(name!==input)throw new Error('Domain key must be canonical lowercase without whitespace or trailing dot: '+input);
  if(name.startsWith('www.'))throw new Error('Domain key should omit www.: '+input);
  if(name.length>253)throw new Error('Domain name is too long: '+input);
  const labels=name.split('.');
  if(labels.length<2 || labels.some(label=>label.length<1 || label.length>63 ||
    !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) {
    throw new Error('Invalid domain name: '+input);
  }
  if(!/^(?:xn--[a-z0-9-]+|[a-z]{2,63})$/.test(labels.at(-1)) ||
     ['localhost','local','test','invalid','example'].includes(labels.at(-1)))
    throw new Error('Invalid top-level domain: '+input);
  return name;
}

export function validateInventory(inventory) {
  if(!inventory || typeof inventory!=='object' || Array.isArray(inventory))
    throw new Error('Inventory must be a JSON object indexed by hostname');
  const keys=Object.keys(inventory);
  if(keys.length>10000)throw new Error('Inventory too large (>10000 domains)');
  const seen=new Set();
  for(const name of keys) {
    const domain=normalizeDomainKey(name);
    if(seen.has(domain))throw new Error('Duplicate hostname: '+domain);
    seen.add(domain);
    const entry=inventory[name];
    if(!entry || typeof entry!=='object' || Array.isArray(entry))
      throw new Error('Invalid configuration object for '+domain);
    if(Object.keys(entry).some(key=>!['price','currency','contact','status'].includes(key)))
      throw new Error('Unknown field for '+domain);
    if(!SALE_STATUSES.includes(entry.status))throw new Error('Invalid status for '+domain);
    if(typeof entry.price!=='number' || !Number.isFinite(entry.price) ||
      entry.price<0 || (entry.status==='for_sale' && entry.price===0) ||
      !/^\d+(?:\.\d{1,2})?$/.test(String(entry.price))) {
      throw new Error('Invalid price for '+domain);
    }
    if(typeof entry.currency!=='string' || !/^[A-Z]{3}$/.test(entry.currency))
      throw new Error('Invalid 3-letter currency for '+domain);
    if(typeof entry.contact!=='string' || entry.contact.length>254 ||
      !/^[^\s@<>]+@[^\s@<>]+\.[a-zA-Z0-9-]{2,}$/.test(entry.contact)) {
      throw new Error('Invalid contact email for '+domain);
    }
  }
  return keys.length;
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const count=validateInventory(domains);
    process.stdout.write('Domain inventory validated: '+count+' entries\n');
  } catch(error) {
    console.error(error.message);
    process.exitCode=1;
  }
}
