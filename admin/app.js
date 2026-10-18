import {validateEntry,validateInventory,parseJson,toJson,parseCsv,toCsv,applyImport,getStatistics} from './model.js';

const REPO='wwvvv/domain-sale';
const CONTENTS='/repos/'+REPO+'/contents/src/domains.json';
const LOCAL=new Set(['localhost','127.0.0.1','::1','[::1]']);
const labels={for_sale:'出售中',paused:'暂停出售',reserved:'已预留',sold:'已售出'};
const state={items:{},sha:null,dirty:false,editing:null,fileType:'json'};
const $=id=>document.getElementById(id);
const message=e=>e?.message||String(e);
function notice(text,type='info'){const x=$('notice');x.hidden=false;x.className='notice '+type;x.textContent=text;}
function cell(value,className=''){const el=document.createElement('td');el.textContent=String(value);el.className=className;return el;}
function btn(text,className,click){const el=document.createElement('button');el.type='button';el.className=className;el.textContent=text;el.addEventListener('click',click);return el;}
function price(item){try{return new Intl.NumberFormat('zh-CN',{style:'currency',currency:item.currency,maximumFractionDigits:2}).format(item.price);}catch{return item.currency+' '+item.price;}}
function render(){
  const stats=getStatistics(state.items);
  $('totalCount').textContent=stats.total;
  $('saleCount').textContent=stats.for_sale;
  $('pausedCount').textContent=stats.paused+stats.reserved;
  $('soldCount').textContent=stats.sold;
  $('sourceStatus').textContent=(state.sha?'已同步 GitHub':'未与 GitHub 同步')+(state.dirty?' · 有尚未提交的修改':' · 无本地修改');
  const query=$('searchInput').value.trim().toLowerCase(),filter=$('filterSelect').value;
  const found=Object.entries(state.items).filter(([name,item])=>(filter==='all'||filter===item.status)&&(!query||name.includes(query)||item.contact.toLowerCase().includes(query)));
  const body=$('domainTable');body.replaceChildren();
  for(const [name,item] of found.slice(0,100)){
    const row=document.createElement('tr');
    row.append(cell(name,'domain-name'),cell(price(item),'price-cell'),cell(item.contact));
    const status=cell('');const label=document.createElement('span');label.className='status '+item.status;label.textContent=labels[item.status];status.append(label);row.append(status);
    const actions=cell('','action-cell');
    actions.append(btn('编辑','action-link',()=>openEditor(name)),btn('删除','action-link delete',()=>remove(name)));
    row.append(actions);body.append(row);
  }
  if(!found.length){const row=document.createElement('tr'),empty=cell('没有匹配的域名。可以添加域名或导入 CSV。','empty');empty.colSpan=5;row.append(empty);body.append(row);}
  $('rowSummary').textContent='匹配 '+found.length+' 项 · 显示 '+Math.min(found.length,100)+' 项（最多显示前 100 项）';
}
function openEditor(name=null){
  state.editing=name;const item=name?state.items[name]:null;
  $('dialogTitle').textContent=name?'编辑域名':'添加域名';
  $('domainInput').value=name||'';
  $('priceInput').value=item?.price??'';
  $('currencyInput').value=item?.currency||'CNY';
  $('contactInput').value=item?.contact||Object.values(state.items)[0]?.contact||'';
  $('statusInput').value=item?.status||'for_sale';
  $('formError').hidden=true;$('domainDialog').showModal();$('domainInput').focus();
}
function closeEditor(){$('domainDialog').close();state.editing=null;}
function save(event){
  event.preventDefault();
  try{
    const {domain,record}=validateEntry($('domainInput').value,{price:$('priceInput').value,currency:$('currencyInput').value,contact:$('contactInput').value,status:$('statusInput').value});
    if(Object.hasOwn(state.items,domain)&&domain!==state.editing)throw Error('该域名已经存在，请直接编辑原有记录');
    const next={...state.items};if(state.editing&&domain!==state.editing)delete next[state.editing];next[domain]=record;
    state.items=validateInventory(next);state.dirty=true;closeEditor();render();
    notice('已在本地保存；提交 GitHub PR 后才会更新仓库。','success');
  }catch(e){$('formError').hidden=false;$('formError').textContent=message(e);}
}
function remove(name){
  if(!confirm('确定删除 '+name+'？部署后该域名会返回 404。'))return;
  const next={...state.items};delete next[name];state.items=validateInventory(next);state.dirty=true;render();
  notice('已在本地删除 '+name+'，尚未提交 PR。','success');
}
function decode(text){return new TextDecoder().decode(Uint8Array.from(atob(text.replace(/\s/g,'')),c=>c.charCodeAt(0)));}
function encode(text){const bytes=new TextEncoder().encode(text);let result='';for(let i=0;i<bytes.length;i+=8192)result+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(result);}
async function github(path,{method='GET',token,body}={}){
  const headers={'Accept':'application/vnd.github+json'}; // Keep CORS preflight header allowlist minimal.
  if(token)headers.Authorization='Bearer '+token;
  if(body!==undefined)headers['Content-Type']='application/json';
  const response=await fetch('https://api.github.com'+path,{method,headers,cache:'no-store',body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw Error('GitHub API 请求失败：'+(data?.message||response.status));
  return data;
}
async function refresh(confirmDirty=true){
  if(confirmDirty&&state.dirty&&!confirm('当前有未提交修改，同步后会丢失，继续吗？'))return;
  $('refreshBtn').disabled=true;
  try{
    const file=await github(CONTENTS+'?ref=main');
    if(!file.content||!file.sha)throw Error('GitHub 没有返回有效的域名配置');
    state.items=parseJson(decode(file.content));state.sha=file.sha;state.dirty=false;render();
    if(confirmDirty)notice('已同步 GitHub main 分支。','success');
  }catch(e){
    if(confirmDirty)notice(message(e),'error');
    else{
      try{
        const result=await fetch('../src/domains.json',{cache:'no-store'});
        if(!result.ok)throw Error('本地配置不存在');
        state.items=parseJson(await result.text());state.sha=null;state.dirty=false;render();
        notice('GitHub 连接失败；已加载本地配置。提交 PR 前必须同步 GitHub。','error');
      }catch{render();notice('无法加载配置；可以手动导入 JSON。','error');}
    }
  }finally{$('refreshBtn').disabled=false;}
}
async function importFile(e){
  const file=e.target.files?.[0];e.target.value='';if(!file)return;
  if(file.size>5*1024*1024){notice('文件超过 5 MB，不予导入','error');return;}
  try{
    const incoming=state.fileType==='csv'?parseCsv(await file.text()):parseJson(await file.text());
    const result=applyImport(state.items,incoming,$('importMode').value);
    const summary='导入 '+result.imported+' 个，覆盖 '+result.overwritten.length+' 个，移除 '+result.removed.length+' 个。';
    if((result.overwritten.length||result.removed.length)&&!confirm(summary+'\n是否确认？'))return;
    state.items=result.data;state.dirty=true;render();notice('导入成功：'+summary+' 尚未更新 GitHub。','success');
  }catch(err){notice('导入失败：'+message(err),'error');}
}
function exportFile(format){
  try{
    const result=format==='csv'?toCsv(state.items):toJson(state.items);
    const blob=new Blob([result],{type:format==='csv'?'text/csv;charset=utf-8':'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob),anchor=document.createElement('a');
    anchor.href=url;anchor.download='domain-sale-domains.'+format;document.body.append(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    notice('已导出 '+format.toUpperCase()+'。','success');
  }catch(e){notice(message(e),'error');}
}
async function createPr(){
  if(!LOCAL.has(location.hostname)){notice('只能通过 localhost / 127.0.0.1 本地页面提交 PR。','error');return;}
  const token=$('tokenInput').value.trim();
  if(!token){notice('请填写 GitHub Fine-grained PAT','error');return;}
  if(!state.sha){notice('提交前必须先同步 GitHub 最新配置','error');return;}
  if(!state.dirty){notice('无本地修改，不需要提交 PR');return;}
  if(!confirm('将创建新分支与 Pull Request，不会直接合并或部署。继续吗？'))return;
  const submit=$('prBtn');submit.disabled=true;submit.textContent='正在提交…';
  let branch='';
  try{
    const [user,repo,file,head]=await Promise.all([
      github('/user',{token}),github('/repos/'+REPO,{token}),
      github(CONTENTS+'?ref=main',{token}),
      github('/repos/'+REPO+'/git/ref/heads/main',{token})
    ]);
    if(user.login!=='wwvvv')throw Error('只有 wwvvv 账号可提交更改');
    if(!repo.permissions?.push)throw Error('该授权没有仓库写入权限');
    if(file.sha!==state.sha)throw Error('main 的域名配置已变化，请先同步并核对更改');
    const content=toJson(state.items);
    if(content===toJson(parseJson(decode(file.content)))){
      state.dirty=false;render();notice('配置没有变化');return;
    }
    const timestamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\..*/,'').replace('T','-');
    const id=(crypto.randomUUID?.()||Date.now().toString()).slice(0,8);
    branch='domain-sale/manage-'+timestamp+'-'+id;
    await github('/repos/'+REPO+'/git/refs',{method:'POST',token,body:{ref:'refs/heads/'+branch,sha:head.object.sha}});
    await github(CONTENTS,{method:'PUT',token,body:{message:'chore(domains): update domain inventory',content:encode(content),sha:file.sha,branch}});
    const stats=getStatistics(state.items);
    const pr=await github('/repos/'+REPO+'/pulls',{method:'POST',token,body:{
      title:'chore(domains): 更新出售域名清单',head:branch,base:'main',
      body:'## 域名清单更新\n\n由本地管理界面提交，需审核价格和联系邮箱。\n\n- 全部：'+stats.total+
        '\n- 出售中：'+stats.for_sale+'\n- 暂停 / 预留：'+(stats.paused+stats.reserved)+
        '\n- 已售出：'+stats.sold+'\n\n请先检查 CI，再审核合并。'
    }});
    const parent=$('prResult');parent.replaceChildren();parent.hidden=false;
    const link=document.createElement('a');link.href=pr.html_url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='PR #'+pr.number+' · 在 GitHub 查看';
    parent.append(document.createTextNode('PR 已创建：'),link);
    state.sha=null;state.dirty=false;render();$('tokenInput').value='';
    notice('已创建审核 PR #'+pr.number+'。合并 main 前不会触发发布。','success');
  }catch(err){notice('PR 创建失败：'+message(err)+(branch?'\n可到 GitHub 检查分支 '+branch:''),'error');}
  finally{submit.disabled=false;submit.textContent='创建审核 PR ↗';}
}
function init(){
  $('addBtn').addEventListener('click',()=>openEditor());
  $('closeDialogBtn').addEventListener('click',closeEditor);
  $('cancelBtn').addEventListener('click',closeEditor);
  $('domainForm').addEventListener('submit',save);
  $('searchInput').addEventListener('input',render);
  $('filterSelect').addEventListener('change',render);
  $('refreshBtn').addEventListener('click',()=>refresh(true));
  for(const type of ['Json','Csv']){
    $('import'+type+'Btn').addEventListener('click',()=>{
      state.fileType=type.toLowerCase();$('fileInput').accept=type==='Csv'?'.csv,text/csv':'.json,application/json';$('fileInput').click();
    });
    $('export'+type+'Btn').addEventListener('click',()=>exportFile(type.toLowerCase()));
  }
  $('fileInput').addEventListener('change',importFile);
  $('prBtn').addEventListener('click',createPr);
  window.addEventListener('beforeunload',e=>{if(state.dirty){e.preventDefault();e.returnValue='';}});
  if(!LOCAL.has(location.hostname)){
    $('tokenInput').disabled=true;$('prBtn').disabled=true;
    notice('只能在本机 localhost / 127.0.0.1 使用 GitHub 提交功能。','error');
  }
  render();void refresh(false);
}
init();
