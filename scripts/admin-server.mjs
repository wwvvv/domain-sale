import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const root=new URL('../',import.meta.url);
const allowed=Object.freeze({
  '/admin/':['admin/index.html','text/html; charset=utf-8'],
  '/admin/index.html':['admin/index.html','text/html; charset=utf-8'],
  '/admin/app.js':['admin/app.js','text/javascript; charset=utf-8'],
  '/admin/model.js':['admin/model.js','text/javascript; charset=utf-8'],
  '/admin/style.css':['admin/style.css','text/css; charset=utf-8'],
  '/src/domains.json':['src/domains.json','application/json; charset=utf-8']
});

export function createAdminServer(){
  return createServer(async(request,response)=>{
    const path=new URL(request.url||'/', 'http://localhost').pathname;
    const target=Object.hasOwn(allowed,path)?allowed[path]:null;
    const headers={
      'Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff',
      'X-Frame-Options':'DENY',
      'Referrer-Policy':'no-referrer',
      'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self' https://api.github.com; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'"
    };
    // Refuse DNS-rebinding hostnames before serving an authenticated editor.
    if (!/^(?:127\.0\.0\.1|localhost):\d{1,5}$/.test(String(request.headers.host||'').toLowerCase())) {
      response.writeHead(403,headers);response.end('Forbidden');return;
    }
    if(!['GET','HEAD'].includes(request.method||'')){
      response.writeHead(405,{...headers,'Allow':'GET, HEAD'});response.end('Method Not Allowed');return;
    }
    if(!target){
      response.writeHead(404,headers);response.end('Not Found');return;
    }
    try{
      const buffer=await readFile(new URL(target[0],root));
      response.writeHead(200,{...headers,'Content-Type':target[1],'Content-Length':buffer.length});
      response.end(request.method==='HEAD'?undefined:buffer);
    }catch{
      response.writeHead(404,headers);response.end('Not Found');
    }
  });
}
const isEntrypoint=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isEntrypoint){
  const port=Number(process.env.PORT||4173);
  if(!Number.isSafeInteger(port)||port<1024||port>65535)throw Error('Invalid admin port');
  const server=createAdminServer();
  server.listen(port,'127.0.0.1',()=>console.log('Local domain manager: http://127.0.0.1:'+port+'/admin/'));
}
