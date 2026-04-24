const _imgProxy = new Proxy({}, { set(){ return true; }, get(){ return ''; } });

const CONFIG = {
ORG_NAME:     localStorage.getItem('cfg_org_name')     || 'Subprocuradoria Contenciosa — Município de Porto Velho',
PROC_PADRAO:  localStorage.getItem('cfg_proc_nome')    || 'Dr. Junior',
PROC_WPP:     localStorage.getItem('cfg_proc_wpp')     || '',
};
let dados        = [];
let procuradores = {};
let usuarios     = [];
let currentUser  = null;
let accessToken  = null;
let editIdx      = null;
let editProcKey  = null;
let editUserIdx  = null;
let lastSync     = null;
const HOJE = new Date(); HOJE.setHours(0,0,0,0);
const dataBr   = s => { if(!s) return ''; const p=s.split('-'); return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:s; };
const dataISO  = s => { if(!s) return ''; const p=s.split('/'); return p.length===3?`${p[2]}-${p[1]}-${p[0]}`:s; };
const parseData= s => { if(!s) return null; const d=new Date(s+'T00:00:00'); return isNaN(d)?null:d; };
const normNome = s => (s||'').trim().toLowerCase();
const hojeISO  = () => HOJE.toISOString().slice(0,10);
const amanhaISO= () => { const d=new Date(HOJE); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); };
const fimSemana= () => { const d=new Date(HOJE); d.setDate(d.getDate()+(6-d.getDay())); return d; };
function copiar(txt){ navigator.clipboard.writeText(txt).then(()=>alert(`"${txt}" copiado!`)); }
const isEditor = () => currentUser && ['editor','admin'].includes(currentUser.role);
const isAdmin  = () => currentUser && currentUser.role === 'admin';
function wppDe(nome){
const k=normNome(nome);
if(procuradores[k]?.wpp) return procuradores[k].wpp;
if(k===normNome(CONFIG.PROC_PADRAO)) return CONFIG.PROC_WPP;
return '';
}
function registrarProcurador(nome,wpp){
if(!nome) return;
const k=normNome(nome);
if(!procuradores[k]) procuradores[k]={nome:nome.trim(),wpp:''};
if(wpp && wpp.replace(/\D/g,'').length>=10) procuradores[k].wpp=wpp.replace(/\D/g,'');
}
const svgWpp=`<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
<circle cx="16" cy="16" r="16" fill="#25D366"/>
<path d="M23.5 8.5C21.6 6.6 19.1 5.5 16.4 5.5C10.8 5.5 6.2 10.1 6.2 15.7C6.2 17.6 6.7 19.4 7.6 21L6.1 26.5L11.7 25C13.2 25.8 14.8 26.2 16.4 26.2C22 26.2 26.6 21.6 26.6 16C26.6 13.3 25.4 10.8 23.5 8.5ZM16.4 24.4C14.9 24.4 13.5 24 12.2 23.3L11.9 23.1L8.6 24L9.5 20.8L9.3 20.5C8.5 19.1 8.1 17.5 8.1 15.8C8.1 11.2 11.9 7.4 16.5 7.4C18.7 7.4 20.8 8.3 22.3 9.8C23.9 11.3 24.7 13.4 24.7 15.7C24.7 20.3 20.9 24.4 16.4 24.4ZM20.8 17.8C20.6 17.7 19.4 17.1 19.2 17C19 16.9 18.9 16.9 18.7 17.1C18.6 17.3 18.1 17.9 18 18C17.9 18.2 17.7 18.2 17.5 18.1C16.3 17.5 15.5 17 14.7 15.7C14.5 15.4 14.9 15.4 15.2 14.8C15.3 14.7 15.2 14.5 15.2 14.4C15.2 14.3 14.7 13.1 14.5 12.6C14.3 12.1 14.1 12.2 13.9 12.2C13.8 12.2 13.6 12.2 13.5 12.2C13.3 12.2 13 12.3 12.8 12.5C12.6 12.7 12 13.3 12 14.5C12 15.7 12.8 16.8 12.9 17C13 17.1 14.6 19.6 17.1 20.6C19 21.4 19.7 21.3 20.2 21.2C20.9 21.1 22 20.5 22.2 19.9C22.4 19.3 22.4 18.8 22.3 18.7C22.2 18.6 21 18 20.8 17.8Z" fill="white"/>
</svg>`;
function carregarUsuariosLocal(){
try { return JSON.parse(localStorage.getItem('local_usuarios')||'[]'); } catch(e){ return []; }
}
function salvarUsuariosLocal(lista){
localStorage.setItem('local_usuarios', JSON.stringify(lista));
}
function garantirAdminPadrao(){
let lista = carregarUsuariosLocal();
if(!lista.find(u=>u.usuario==='admin')){
lista.push({usuario:'admin', senha:'admin123', nome:'Administrador', role:'admin', data: new Date().toLocaleDateString('pt-BR')});
salvarUsuariosLocal(lista);
}
return lista;
}
function fazerLogin(){
const usr = document.getElementById('loginUser').value.trim();
const sen = document.getElementById('loginSenha').value;
const err = document.getElementById('loginError');
err.style.display='none';
if(!usr||!sen){ err.textContent='Preencha usuário e senha.'; err.style.display='block'; return; }
const lista = garantirAdminPadrao();
const found = lista.find(u=>u.usuario===usr && u.senha===sen);
if(!found){ err.textContent='Usuário ou senha incorretos.'; err.style.display='block'; return; }
entrar({name: found.nome||found.usuario, usuario: found.usuario, picture:'', role: found.role||'leitor'});
}
function mostrarErroLogin(msg){
const el = document.getElementById('loginError');
el.textContent = msg;
el.style.display = 'block';
}
function inicializarTelaLogin(){
garantirAdminPadrao();
document.getElementById('loginUser').value='';
document.getElementById('loginSenha').value='';
document.getElementById('loginError').style.display='none';
}
function salvarEIniciarLogin(){}
function redefinirClientId(){}
function iniciarLoginGoogle(){}
function buscarPerfilComToken(){}
function processarLoginGoogle(){}
function parseJwt(){}
function salvarConfigInicial(){}
async function entrar(user){
currentUser = user;
document.getElementById('loginScreen').style.display='none';
document.getElementById('appShell').style.display='flex';
const initials = (user.name||'?').split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase();
const avatarEl = document.getElementById('userAvatarText');
if(avatarEl) avatarEl.textContent = initials;
document.getElementById('userName').textContent = user.name;
const roleBadge = document.getElementById('userRoleBadge');
if(roleBadge){ roleBadge.textContent = ({admin:'Admin',editor:'Editor',leitor:'Leitor'}[user.role]||user.role); }
if(isAdmin()){ const n=document.getElementById('nav-usuarios'); if(n) n.style.display=''; }
const hd = document.getElementById('headerDate');
if(hd) hd.textContent = new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
aplicarPermissoes();
await sincronizar();
switchTab('dashboard');
}
function aplicarPermissoes(){
document.querySelectorAll('.editor-only').forEach(el=>{ el.style.display=isEditor()?'':'none'; });
const et=document.getElementById('editorToolbar');if(et)et.style.display=isEditor()?'flex':'none';
const rn=document.getElementById('readerNotice');if(rn)rn.style.display=isEditor()?'none':'block';
}
function logout(){
currentUser=null; accessToken=null;
document.getElementById('appShell').style.display='none';
document.getElementById('loginScreen').style.display='flex';
const le=document.getElementById('loginError');if(le)le.style.display='none';
inicializarTelaLogin();
}
function setSyncStatus(estado, msg){
const dot=document.getElementById('syncDot');
const txt=document.getElementById('syncMsg');
if(!dot||!txt) return;
dot.className='status-dot';
if(estado==='loading'){dot.classList.add('spin');txt.textContent=msg;}
else if(estado==='ok'){dot.classList.add('ok');txt.textContent=msg;const st=document.getElementById('syncTime');if(st)st.textContent=' · '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});}
else{dot.classList.add('err');txt.textContent=msg;}
}
function rowToAud(r){
return {
_id: r.id, processo: r.processo||'', data: r.data||'', hora: r.hora||'',
vara: r.vara||'', tipo: r.tipo||'Instrução e Julgamento',
partes: r.partes||'', procurador: r.procurador||'',
wppProcurador: r.wpp_procurador||'', link: r.link||'',
situacao: r.situacao||'Agendada', resultado: r.resultado||'',
obs: r.obs||'', _rowId: r.id
};
}
function audToRow(r){
return {
processo: r.processo, data: r.data||null, hora: r.hora,
vara: r.vara, tipo: r.tipo, partes: r.partes,
procurador: r.procurador, wpp_procurador: r.wppProcurador,
link: r.link, situacao: r.situacao, resultado: r.resultado, obs: r.obs
};
}
async function sincronizar(){
if(typeof supabase === 'undefined'){
setSyncStatus('err','Biblioteca Supabase não carregada. Verifique sua conexão.');
return;
}
setSyncStatus('loading','Conectando ao banco...');
try {
const { data: rows, error } = await supa.from('audiencias').select('*').order('data').order('hora');
if(error) throw error;
dados = (rows||[]).map(rowToAud);
const { data: procs } = await supa.from('agenda_procuradores').select('*');
procuradores = {};
(procs||[]).forEach(p=>{ procuradores[normNome(p.nome)]={nome:p.nome,wpp:p.wpp||''}; });
registrarProcurador(CONFIG.PROC_PADRAO, CONFIG.PROC_WPP);
setSyncStatus('ok', `${dados.length} audiências carregadas.`);
atualizar(); renderUsuarios(); atualizarResumoXlsx(); renderDashboard();
} catch(e){
setSyncStatus('err','Erro ao conectar: '+e.message);
}
}
async function dbSalvarAudiencia(r){
const row = audToRow(r);
if(r._id){
const { error } = await supa.from('audiencias').update(row).eq('id',r._id);
if(error) throw error;
return r._id;
} else {
const { data, error } = await supa.from('audiencias').insert(row).select().single();
if(error) throw error;
return data.id;
}
}
async function dbDeletarAudiencia(id){
const { error } = await supa.from('audiencias').delete().eq('id',id);
if(error) throw error;
}
async function dbSalvarProcurador(nome, wpp){
await supa.from('agenda_procuradores').upsert({nome,wpp},{onConflict:'nome'});
}
function salvarLocal(){ localStorage.setItem('local_audiencias', JSON.stringify(dados)); }
function carregarLocal(){}
async function salvarAudienciasNoSheet(){ setSyncStatus('ok','Salvo.'); }
async function salvarProcuradoresNoSheet(){}
async function salvarUsuariosNoSheet(){}
async function limparTodosDados(){
if(!confirm('Isso apagará TODAS as audiências do banco. Deseja continuar?')) return;
const { error } = await supa.from('audiencias').delete().neq('id','00000000-0000-0000-0000-000000000000');
if(error){ alert('Erro: '+error.message); return; }
dados=[]; atualizar(); setSyncStatus('ok','Todos os dados apagados.');
}
function salvarSheetId(){}
function detectarConflitos(){
const g={};
dados.forEach((r,i)=>{
if(!r.data||!r.hora||['Cancelada','Realizada'].includes(r.situacao))return;
const ch=r.data+'|'+r.hora;
if(!g[ch])g[ch]=[];
g[ch].push({...r,_idx:i});
});
const c={};
Object.entries(g).forEach(([ch,lista])=>{
if([...new Set(lista.map(r=>r.vara))].length>1) c[ch]=lista;
});
return c;
}
function idxsConflito(){
const s=new Set();
Object.values(detectarConflitos()).forEach(l=>l.forEach(r=>s.add(r._idx)));
return s;
}
function atualizarStats(){
const hj=hojeISO(),fs=fimSemana();
document.getElementById('sTotal').textContent=dados.length;
document.getElementById('sHoje').textContent=dados.filter(r=>r.data===hj).length;
document.getElementById('sSemana').textContent=dados.filter(r=>{const d=parseData(r.data);return d&&d>=HOJE&&d<=fs}).length;
document.getElementById('sRealizadas').textContent=dados.filter(r=>r.situacao==='Realizada').length;
document.getElementById('sCanceladas').textContent=dados.filter(r=>r.situacao==='Cancelada').length;
const nc=Object.keys(detectarConflitos()).length;
document.getElementById('sConflitos').textContent=nc;
const bars=document.getElementById('alertBars'); bars.innerHTML='';
const am=amanhaISO();
const prox=dados.filter(r=>r.situacao==='Agendada'&&(r.data===hj||r.data===am));
if(prox.length) bars.innerHTML+=`<div class="alert aviso">Atenção: ${prox.length} audiência(s) agendada(s) para hoje ou amanhã.</div>`;
if(nc) bars.innerHTML+=`<div class="alert conflito">⚠️ Conflito detectado: ${nc} horário(s) com audiências simultâneas em varas distintas.</div>`;
const nb=document.getElementById('navBadgeConflitos');
if(nb){nb.textContent=nc;nb.style.display=nc>0?'':'none';}
}
function renderTabela(){
const txt=document.getElementById('filtroTexto').value.toLowerCase();
const dt =document.getElementById('filtroData').value;
const sit=document.getElementById('filtroSituacao').value;
const pr =document.getElementById('filtroProcurador').value;
const hj =hojeISO(), am=amanhaISO();
const cIdx=idxsConflito();
const filtrado=dados.map((r,i)=>({...r,_idx:i}))
.filter(r=>{
if(txt&&!(r.processo+r.partes+r.vara+r.procurador).toLowerCase().includes(txt))return false;
if(dt&&r.data!==dt)return false;
if(sit&&r.situacao!==sit)return false;
if(pr&&r.procurador!==pr)return false;
return true;
})
.sort((a,b)=>(a.data||'').localeCompare(b.data||'')||(a.hora||'').localeCompare(b.hora||''));
document.getElementById('emptyMsg').style.display=filtrado.length===0?'block':'none';
if(_viewMode==='cards'){
const cv=document.getElementById('cardsView');
if(!cv) return;
cv.innerHTML='';
filtrado.forEach(r=>{
const idx=r._idx, isC=cIdx.has(idx);
const uc=urgClass(r);
const div=document.createElement('div');
div.className=`aud-card ${uc}`;
div.onclick=()=>{ switchTab('pauta'); setView('tabela'); setTimeout(()=>{ document.getElementById('filtroTexto').value=r.processo; renderTabela(); setTimeout(()=>toggleExpand(idx),150); },50); };
div.innerHTML=`
<div class="aud-card-top">
<span class="aud-card-hora">${r.hora||'—'}</span>
<span class="badge ${(r.situacao||'agendada').toLowerCase()}">${r.situacao||'Agendada'}</span>
</div>
<div class="aud-card-proc">${r.processo||'—'}</div>
<div class="aud-card-vara">${r.vara||'—'}</div>
<div class="aud-card-bottom">
<span style="font-size:11px;color:var(--text-2)">${dataBr(r.data)||'—'}</span>
${urgBadge(r)}
${isC?'<span class="urg-badge v">Conflito</span>':''}
</div>`;
cv.appendChild(div);
});
return;
}
const tbody=document.getElementById('corpoTabela');
tbody.innerHTML='';
filtrado.forEach(r=>{
const idx=r._idx, isC=cIdx.has(idx);
const u=calcUrgencia(r);
let tags='';
if(r.situacao==='Agendada'){
if(r.data===hj) tags+=`<span class="tag hoje">HOJE</span>`;
else if(r.data===am) tags+=`<span class="tag amanha">AMANHÃ</span>`;
}
if(isC) tags+=`<span class="tag conf">CONFLITO</span>`;
const linkHtml=r.link?`<a href="${r.link}" class="icon-link" target="_blank" title="Acessar audiência virtual">🔗</a>`:`<span style="color:var(--text-3)">—</span>`;
const tr=document.createElement('tr');
const uc=urgClass(r);
if(isC) tr.className='conflito-row';
tr.dataset.idx=idx;
tr.style.cursor='pointer';
tr.onclick=(e)=>{ if(e.target.tagName==='BUTTON'||e.target.tagName==='A')return; toggleExpand(idx); };
tr.innerHTML=`
<td>
<div style="display:flex;align-items:center;gap:6px">
<div style="width:3px;height:28px;border-radius:2px;background:${u==='vermelho'?'var(--red)':u==='amarelo'?'var(--amber)':u==='verde'?'var(--green)':'var(--text-3)'};flex-shrink:0"></div>
<span style="font-size:11px;font-family:monospace">${r.processo||'—'}</span>
</div>
</td>
<td style="font-size:12px">${dataBr(r.data)||'—'}${tags}</td>
<td style="font-size:12px">${r.hora||'—'}</td>
<td style="font-size:12px">${r.vara||'—'}</td>
<td style="font-size:12px">${r.tipo||'—'}</td>
<td style="font-size:12px">${(r.partes||'—').slice(0,60)}</td>
<td style="font-size:12px">${r.procurador||'—'}</td>
<td>
<span class="badge ${(r.situacao||'agendada').toLowerCase()}">${r.situacao||'Agendada'}</span>
${urgBadge(r)}
</td>
<td style="text-align:center">${linkHtml}</td>
<td>
<span style="font-size:11px;color:var(--text-3)">▸ detalhes</span>
</td>`;
tbody.appendChild(tr);
});
}
function atualizarFiltroProcurador(){
const procs=[...new Set(dados.map(r=>r.procurador).filter(Boolean))].sort();
['filtroProcurador','relProcurador'].forEach(id=>{
const sel=document.getElementById(id); if(!sel)return;
const val=sel.value;
sel.innerHTML='<option value="">Todos</option>';
procs.forEach(p=>{const o=document.createElement('option');o.value=p;o.textContent=p;sel.appendChild(o);});
sel.value=val;
});
}
function renderConflitos(){
const conflitos=detectarConflitos(); const chaves=Object.keys(conflitos).sort();
let html='';
if(!chaves.length){html='<div class="empty">Nenhum conflito de horário detectado.</div>';}
else{
html+=`<div class="alert conflito" style="margin-bottom:1rem">${chaves.length} conflito(s) detectado(s). Providencie designação de procurador substituto com antecedência.</div>`;
chaves.forEach((ch,i)=>{
const lista=conflitos[ch]; const[data,hora]=ch.split('|');
html+=`<div class="card conflito-card"><h3>Conflito ${i+1}: ${dataBr(data)} às ${hora} — ${lista.length} audiências em varas distintas</h3>`;
lista.forEach(r=>{
const temWpp=!!(r.wppProcurador||wppDe(r.procurador));
html+=`<div class="conflito-item">
<strong>${r.processo||'—'}</strong> — ${r.vara||'—'}<br>
<span style="color:var(--text-2)">Partes: ${r.partes||'—'} | Procurador: <strong>${r.procurador||'—'}</strong>${temWpp?' ✓':' — sem WhatsApp'}</span>
${r.link?`<br><a href="${r.link}" target="_blank" style="font-size:12px;color:var(--blue-600)">Acessar link virtual</a>`:''}
<div style="margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
<button class="btn-wpp sm ${temWpp?'':'disabled'}" onclick="${temWpp?`enviarWpp(${r._idx},'cobertura')`:'void(0)'}" title="Solicitar cobertura por WhatsApp">${svgWpp}</button>
<span style="font-size:12px;color:var(--text-2)">Solicitar cobertura</span>
${isEditor()?`<button class="btn sm" onclick="editarAudiencia(${r._idx})">Editar / Designar procurador</button>`:''}
</div>
</div>`;
});
html+='</div>';
});
}
document.getElementById('conflitosConteudo').innerHTML=html;
}
function renderDistribuicao(){
const procs={};
dados.forEach(r=>{const p=r.procurador||'(não atribuído)';if(!procs[p])procs[p]={total:0,realizadas:0,agendadas:0,canceladas:0};procs[p].total++;procs[p][r.situacao?.toLowerCase()]=(procs[p][r.situacao?.toLowerCase()]||0)+1;});
const maxT=Math.max(...Object.values(procs).map(v=>v.total),1);
const keys=Object.keys(procs).sort((a,b)=>procs[b].total-procs[a].total);
let html='';
if(!keys.length){html='<div class="empty">Nenhum dado disponível.</div>';}
else{
html='<div style="border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;background:#fff"><div style="padding:1rem">';
keys.forEach(p=>{
const v=procs[p]; const pct=Math.round((v.total/maxT)*100);
html+=`<div class="dist-row"><div style="flex:1;font-weight:600">${p}</div><div class="dist-bar-wrap"><div class="dist-fill" style="width:${pct}%"></div></div><div style="color:var(--blue-600);font-weight:700;min-width:28px;text-align:right">${v.total}</div><div style="font-size:11px;color:var(--text-3);min-width:140px;text-align:right">${v.agendadas||0} agend. · ${v.realizadas||0} realiz. · ${v.canceladas||0} canc.</div></div>`;
});
html+='</div></div>';
}
document.getElementById('distConteudo').innerHTML=html;
}
function renderHistorico(){
const sit=document.getElementById('histFiltroSit').value;
const filtrado=dados.filter(r=>!sit||r.situacao===sit).sort((a,b)=>(b.data||'').localeCompare(a.data||''));
let html='';
if(!filtrado.length){html='<div class="empty">Nenhuma audiência encontrada.</div>';}
else filtrado.forEach(r=>{
const idx=dados.indexOf(r); const temWpp=!!(r.wppProcurador||wppDe(r.procurador));
html+=`<div class="card">
<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:4px;margin-bottom:6px">
<div>
<span style="font-size:12px;font-weight:700;font-family:monospace">${r.processo||'—'}</span>
<span class="badge ${(r.situacao||'').toLowerCase()}" style="margin-left:8px">${r.situacao||'—'}</span>
${r.resultado?`<span class="badge" style="margin-left:4px;background:var(--bg-2);color:var(--text-2)">${r.resultado}</span>`:''}
${r.link?`<a href="${r.link}" target="_blank" style="color:var(--blue-600);font-size:12px;margin-left:8px">Link virtual</a>`:''}
</div>
<span style="font-size:12px;color:var(--text-2)">${dataBr(r.data)||'—'} ${r.hora||''}</span>
</div>
<p style="font-size:12px;font-weight:600;margin-bottom:2px">${r.partes||'—'}</p>
<p style="font-size:12px;color:var(--text-2)">${r.vara||'—'} · ${r.tipo||'—'} · ${r.procurador||'—'}</p>
${r.obs?`<p style="font-size:12px;margin-top:6px;border-top:1px solid var(--border);padding-top:6px">${r.obs}</p>`:''}
<div style="margin-top:8px;display:flex;align-items:center;gap:8px">
<button class="btn-wpp sm ${temWpp?'':'disabled'}" onclick="${temWpp?`enviarWpp(${idx},'aviso')`:'void(0)'}">${svgWpp}</button>
<span style="font-size:12px;color:var(--text-2)">Enviar alerta por WhatsApp</span>
</div>
</div>`;
});
document.getElementById('histConteudo').innerHTML=html;
}
function renderProcuradores(){
const tbody=document.getElementById('procCorpo');
const keys=Object.keys(procuradores).sort((a,b)=>procuradores[a].nome.localeCompare(procuradores[b].nome));
if(!keys.length){tbody.innerHTML=`<tr><td colspan="4" class="empty">Nenhum procurador cadastrado.</td></tr>`;return;}
tbody.innerHTML='';
keys.forEach(k=>{
const p=procuradores[k]; const qtd=dados.filter(r=>normNome(r.procurador)===k).length;
const isPadrao=normNome(p.nome)===normNome(CONFIG.PROC_PADRAO);
const tr=document.createElement('tr');
tr.innerHTML=`
<td style="font-weight:600">${p.nome}${isPadrao?'<span class="badge agendada" style="margin-left:8px;font-size:10px">padrão</span>':''}</td>
<td style="font-family:monospace;font-size:12px">${p.wpp?'('+p.wpp.slice(0,2)+') '+p.wpp.slice(2,7)+'-'+p.wpp.slice(7):'—'}</td>
<td>${qtd}</td>
<td style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
${isEditor()?`<button class="btn sm" onclick="abrirModalProc('${k}')">Editar</button>`:''}
${p.wpp?`<button class="btn-wpp sm" onclick="testarWpp('${k}')" title="Testar WhatsApp">${svgWpp}</button>`:''}
${isAdmin()?`<button class="btn sm danger" onclick="excluirProc('${k}')">Excluir</button>`:''}
</td>`;
tbody.appendChild(tr);
});
}
function montarMensagem(r, tipo){
const lk=r.link?`\n*Link de acesso:* ${r.link}`:'';
const ob=r.obs?`\n*Obs.:* ${r.obs}`:'';
if(tipo==='cobertura') return encodeURIComponent(`*SUBPROCURADORIA CONTENCIOSA — SOLICITAÇÃO DE COBERTURA*\n\nPrezado(a) Procurador(a),\n\nSolicita-se cobertura da seguinte audiência por conflito de horário:\n\n*Processo:* ${r.processo||'—'}\n*Data:* ${dataBr(r.data)}\n*Horário:* ${r.hora||'—'}\n*Vara / Juízo:* ${r.vara||'—'}\n*Tipo:* ${r.tipo||'—'}\n*Partes:* ${r.partes||'—'}${lk}${ob}\n\nAguardamos confirmação.\n\n_Subprocuradoria Contenciosa_`);
return encodeURIComponent(`*SUBPROCURADORIA CONTENCIOSA — AVISO DE AUDIÊNCIA*\n\n*Procurador(a):* ${r.procurador||CONFIG.PROC_PADRAO}\n*Processo:* ${r.processo||'—'}\n*Data:* ${dataBr(r.data)}\n*Horário:* ${r.hora||'—'}\n*Vara / Juízo:* ${r.vara||'—'}\n*Tipo:* ${r.tipo||'—'}\n*Partes:* ${r.partes||'—'}${lk}${ob}\n\n_Agenda de Audiências — Subprocuradoria Contenciosa_`);
}
function enviarWpp(idx, tipo){
const r=dados[idx];
const num=(r.wppProcurador||wppDe(r.procurador)||CONFIG.PROC_WPP).replace(/\D/g,'');
if(!num||num.length<10){alert('WhatsApp não cadastrado. Edite a audiência.');return;}
window.open(`https://wa.me/55${num}?text=${montarMensagem(r,tipo)}`,'_blank');
}
function testarWpp(k){
const p=procuradores[k]; if(!p?.wpp){alert('WhatsApp não cadastrado.');return;}
window.open(`https://wa.me/55${p.wpp}?text=${encodeURIComponent('Olá '+p.nome+'. Teste da Agenda de Audiências — Subprocuradoria Contenciosa.')}`,'_blank');
}
function acProc(val){
const list=document.getElementById('acList');
if(!val||val.length<2){list.style.display='none';return;}
const m=Object.values(procuradores).filter(p=>p.nome.toLowerCase().includes(val.toLowerCase()));
if(!m.length){list.style.display='none';return;}
list.innerHTML='';
m.forEach(p=>{
const item=document.createElement('div'); item.className='ac-item';
item.innerHTML=`${p.nome}<br><span class="ac-sub">${p.wpp?'WPP: ('+p.wpp.slice(0,2)+') '+p.wpp.slice(2,7)+'-'+p.wpp.slice(7):'Sem WhatsApp'}</span>`;
item.onmousedown=()=>selecionarProc(p);
list.appendChild(item);
});
list.style.display='block';
}
function fecharAc(){document.getElementById('acList').style.display='none';}
function selecionarProc(p){
document.getElementById('fProc2').value=p.nome;
document.getElementById('fWpp').value=p.wpp||'';
document.getElementById('wppHint').className='hint ok';
document.getElementById('wppHint').textContent=p.wpp?'WhatsApp encontrado no banco.':'Sem WhatsApp — informe abaixo.';
fecharAc();
}
function onWppChange(){
const nome=document.getElementById('fProc2').value.trim();
const wpp=document.getElementById('fWpp').value.replace(/\D/g,'');
const h2=document.getElementById('wppHint2');
if(wpp.length>=10&&nome){h2.className='hint new';h2.textContent='Número será salvo no banco ao confirmar.';}
else h2.textContent='';
}
function abrirModal(idx=null){
if(!isEditor()){alert('Seu perfil é de Leitor. Não é possível editar audiências.');return;}
editIdx=idx; const r=idx!==null?dados[idx]:{};
document.getElementById('modalTitulo').textContent=idx!==null?'Editar audiência':'Nova audiência';
document.getElementById('fProc').value=r.processo||'';
document.getElementById('fData').value=r.data||'';
document.getElementById('fHora').value=r.hora||'';
document.getElementById('fVara').value=r.vara||'';
document.getElementById('fTipo').value=r.tipo||'Instrução e Julgamento';
const nomePr=r.procurador||(idx===null?CONFIG.PROC_PADRAO:'');
document.getElementById('fProc2').value=nomePr;
document.getElementById('fWpp').value=r.wppProcurador||wppDe(nomePr)||'';
document.getElementById('fLink').value=r.link||'';
document.getElementById('fPartes').value=r.partes||'';
document.getElementById('fSituacao').value=r.situacao||'Agendada';
document.getElementById('fResultado').value=r.resultado||'';
document.getElementById('fObs').value=r.obs||'';
document.getElementById('wppHint').textContent='';
document.getElementById('wppHint2').textContent='';
document.getElementById('modalBg').classList.add('open');
}
function editarAudiencia(idx){abrirModal(idx);}
function fecharModal(){document.getElementById('modalBg').classList.remove('open');editIdx=null;}
async function salvarAudiencia(){
const proc=document.getElementById('fProc').value.trim();
const data=document.getElementById('fData').value;
if(!proc||!data){alert('Preencha ao menos o número do processo e a data.');return;}
const nomePr=document.getElementById('fProc2').value.trim()||CONFIG.PROC_PADRAO;
const wppPr=document.getElementById('fWpp').value.replace(/\D/g,'');
registrarProcurador(nomePr,wppPr);
const reg={processo:proc,data,hora:document.getElementById('fHora').value,vara:document.getElementById('fVara').value.trim(),tipo:document.getElementById('fTipo').value,procurador:nomePr,wppProcurador:wppPr||wppDe(nomePr),link:document.getElementById('fLink').value.trim(),partes:document.getElementById('fPartes').value.trim(),situacao:document.getElementById('fSituacao').value,resultado:document.getElementById('fResultado').value,obs:document.getElementById('fObs').value.trim()};
if(editIdx!==null) reg._id=dados[editIdx]._id;
fecharModal();
setSyncStatus('loading','Salvando...');
try {
const id = await dbSalvarAudiencia(reg);
reg._id=reg._id||id; reg._rowId=reg._id;
if(editIdx!==null) dados[editIdx]={...reg}; else dados.push(reg);
await dbSalvarProcurador(nomePr, wppPr||wppDe(nomePr));
setSyncStatus('ok','Audiência salva.'); atualizar();
} catch(e){ setSyncStatus('err','Erro ao salvar: '+e.message); }
}
function abrirModalProc(k=null){
if(!isEditor()){alert('Acesso restrito.');return;}
editProcKey=k; const p=k?procuradores[k]:{};
document.getElementById('modalProcTitulo').textContent=k?'Editar procurador':'Novo procurador';
document.getElementById('pNome').value=p.nome||'';
document.getElementById('pWpp').value=p.wpp||'';
document.getElementById('modalProcBg').classList.add('open');
}
function fecharModalProc(){document.getElementById('modalProcBg').classList.remove('open');editProcKey=null;}
async function salvarProc(){
const nome=document.getElementById('pNome').value.trim();
const wpp=document.getElementById('pWpp').value.replace(/\D/g,'');
if(!nome){alert('Informe o nome.');return;}
procuradores[normNome(nome)]={nome,wpp};
fecharModalProc();
await dbSalvarProcurador(nome,wpp);
renderProcuradores(); atualizar();
}
function excluirProc(k){
if(!confirm(`Excluir "${procuradores[k].nome}"?`))return;
delete procuradores[k];
salvarProcuradoresNoSheet();
renderProcuradores();
}
function abrirModalUsuario(idx=null){
editUserIdx=idx;
const lista = carregarUsuariosLocal();
const u = idx!==null ? lista[idx] : {};
document.getElementById('modalUserTitulo').textContent=idx!==null?'Editar usuário':'Adicionar usuário';
document.getElementById('uNome').value=u.nome||'';
document.getElementById('uEmail').value=u.usuario||'';
document.getElementById('uSenha').value=idx!==null?u.senha||'':'';
document.getElementById('uSenhaHint').textContent=idx!==null?'Deixe em branco para manter a senha atual.':'Mínimo 4 caracteres. Informe ao usuário após criar.';
document.getElementById('uRole').value=u.role||'leitor';
document.getElementById('modalUserBg').classList.add('open');
}
function fecharModalUser(){document.getElementById('modalUserBg').classList.remove('open');editUserIdx=null;}
async function salvarUsuario(){
const nome=document.getElementById('uNome').value.trim();
const usr=document.getElementById('uEmail').value.trim().replace(/\s/g,'');
const senha=document.getElementById('uSenha').value;
const role=document.getElementById('uRole').value;
if(!nome||!usr){alert('Preencha nome e usuário.');return;}
const lista = carregarUsuariosLocal();
if(editUserIdx!==null){
lista[editUserIdx].nome=nome;
lista[editUserIdx].usuario=usr;
lista[editUserIdx].role=role;
if(senha.length>=4) lista[editUserIdx].senha=senha;
else if(senha.length>0 && senha.length<4){alert('Senha muito curta (mínimo 4 caracteres).');return;}
} else {
if(senha.length<4){alert('Informe uma senha com pelo menos 4 caracteres.');return;}
if(lista.find(u=>u.usuario===usr)){alert('Já existe um usuário com esse login.');return;}
lista.push({usuario:usr, senha, nome, role, data:new Date().toLocaleDateString('pt-BR')});
}
salvarUsuariosLocal(lista);
usuarios = lista.map(u=>({nome:u.nome||u.usuario, email:u.usuario, role:u.role, data:u.data||''}));
fecharModalUser();
renderUsuarios();
}
function excluirUsuario(idx){
const lista = carregarUsuariosLocal();
if(lista[idx]?.usuario===currentUser?.usuario){alert('Não é possível remover o próprio usuário.');return;}
if(!confirm(`Remover "${lista[idx]?.nome||lista[idx]?.usuario}"?`))return;
lista.splice(idx,1);
salvarUsuariosLocal(lista);
usuarios = lista.map(u=>({nome:u.nome||u.usuario, email:u.usuario, role:u.role, data:u.data||''}));
renderUsuarios();
}
function renderUsuarios(){
const tbody=document.getElementById('usersCorpo'); if(!tbody) return;
const lista = carregarUsuariosLocal();
if(!lista.length){tbody.innerHTML=`<tr><td colspan="5" class="empty">Nenhum usuário cadastrado.</td></tr>`;return;}
tbody.innerHTML='';
lista.forEach((u,i)=>{
const roleTxt={'admin':'Admin','editor':'Editor','leitor':'Leitor'}[u.role]||u.role;
const tr=document.createElement('tr');
tr.innerHTML=`
<td style="font-weight:600">${u.nome||u.usuario}</td>
<td style="font-size:12px;font-family:monospace">${u.usuario}</td>
<td><span class="badge ${u.role==='admin'?'agendada':u.role==='editor'?'realizada':'remarcada'}">${roleTxt}</span></td>
<td style="font-size:12px;color:var(--text-2)">${u.data||'—'}</td>
<td style="display:flex;gap:6px;flex-wrap:wrap">
<button class="btn sm" onclick="abrirModalUsuario(${i})">Editar</button>
${u.usuario!==currentUser?.usuario?`<button class="btn sm danger" onclick="excluirUsuario(${i})">Remover</button>`:'<span style="font-size:11px;color:var(--text-3)">você</span>'}
</td>`;
tbody.appendChild(tr);
});
}
async function importarArquivo(event){
const file=event.target.files[0]; if(!file)return; event.target.value='';
if(file.name.toLowerCase().endsWith('.pdf')) await importarPDF(file);
else importarCSVFile(file);
}
async function importarPDF(file){
if(typeof pdfjsLib==='undefined'){alert('Biblioteca PDF não carregada. Tente novamente.');return;}
pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const ab = await file.arrayBuffer();
const pdfDoc = await pdfjsLib.getDocument({data:ab}).promise;
const procRe = /\d{7}-\s*\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/;
const dataRe = /^(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}:\d{2})$/;
const COL_BREAKS = [0, 0.09, 0.19, 0.32, 0.59, 0.68, 0.78, 0.88, 1.01];
function getCol(x, pageW){ for(let i=0;i<COL_BREAKS.length-1;i++){ if(x/pageW>=COL_BREAKS[i]&&x/pageW<COL_BREAKS[i+1])return i; } return 7; }
function normProc(s){ return s.replace(/-\s+/,'-'); }
function mapSit(s){
s=(s||'').toLowerCase();
if(s.includes('não-realizada')||s.includes('nao-realizada'))return 'Cancelada';
if(s.includes('realizada'))return 'Realizada';
if(s.includes('redesignada'))return 'Remarcada';
return 'Agendada';
}
const novos = [];
for(let pi=1; pi<=pdfDoc.numPages; pi++){
const page = await pdfDoc.getPage(pi);
const viewport = page.getViewport({scale:1});
const content = await page.getTextContent();
const W = viewport.width;
const linhaMap = {};
for(const item of content.items){
if(!item.str.trim()) continue;
const y = Math.round(item.transform[5]/4)*4;
if(!linhaMap[y]) linhaMap[y] = [];
linhaMap[y].push({x: item.transform[4], str: item.str.trim()});
}
const ysOrdenados = Object.keys(linhaMap).map(Number).sort((a,b)=>b-a);
let regAtual = null;
for(const y of ysOrdenados){
const itens = linhaMap[y].sort((a,b)=>a.x-b.x);
const celulas = Array(8).fill('');
for(const it of itens){
const col = getCol(it.x, W);
celulas[col] = (celulas[col] ? celulas[col]+' ' : '') + it.str;
}
const m = dataRe.exec(celulas[0].trim());
if(m){
if(regAtual) novos.push(regAtual);
const ano = 2000+parseInt(m[3]);
const dataISO = `${ano}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
const pm = procRe.exec(celulas[1]);
if(!pm){ regAtual=null; continue; }
regAtual = {
processo: normProc(pm[0]),
data: dataISO, hora: m[4],
vara: celulas[2].replace(/Porto Velho\s*-\s*/i,'').trim().slice(0,80),
partes: celulas[3].slice(0,200),
tipo: celulas[5].replace(/^\d+\.\s*/,'').trim().slice(0,80)||'Instrução e Julgamento',
procurador: CONFIG.PROC_PADRAO, wppProcurador: CONFIG.PROC_WPP, link:'',
situacao: mapSit(celulas[7]),
resultado:'', obs: celulas[6].trim().slice(0,80),
_rowId: normProc(pm[0])+'_'+dataISO+'_'+m[4]
};
} else if(regAtual){
for(let c=0;c<8;c++){
if(!celulas[c]) continue;
if(c===2) regAtual.vara = (regAtual.vara+' '+celulas[c]).trim().slice(0,80);
if(c===3) regAtual.partes = (regAtual.partes+' '+celulas[c]).trim().slice(0,200);
if(c===5 && !regAtual.tipo.length) regAtual.tipo = celulas[c].replace(/^\d+\.\s*/,'').trim().slice(0,80);
if(c===7 && celulas[7]) regAtual.situacao = mapSit(celulas[7]);
}
}
}
if(regAtual) novos.push(regAtual);
}
if(!novos.length){
alert('Não foi possível identificar audiências neste PDF. Verifique se é uma Pauta de Audiência do PJe.');
return;
}
if(!confirm(`Importar ${novos.length} audiência(s) do PDF?\nOs dados serão ADICIONADOS à lista existente.`)) return;
setSyncStatus('loading','Salvando no banco...');
try {
const rows = novos.map(r=>({processo:r.processo,data:r.data||null,hora:r.hora,vara:r.vara,tipo:r.tipo,partes:r.partes,procurador:r.procurador,wpp_procurador:r.wppProcurador,link:r.link,situacao:r.situacao,resultado:r.resultado,obs:r.obs}));
const chunks=[];
for(let i=0;i<rows.length;i+=50) chunks.push(rows.slice(i,i+50));
for(const chunk of chunks){
const {error}=await supa.from('audiencias').upsert(chunk,{onConflict:'processo,data,hora',ignoreDuplicates:true});
if(error) throw error;
}
await sincronizar();
} catch(e){ setSyncStatus('err','Erro ao salvar: '+e.message); }
}
function importarCSVFile(file){
const reader=new FileReader();
reader.onload=async e=>{
const lines=e.target.result.split('\n').filter(l=>l.trim());
if(lines.length<2){alert('Arquivo vazio.');return;}
const header=lines[0].split(',').map(h=>h.trim().toLowerCase().replace(/['"]/g,''));
const map={processo:['processo','nº processo','numero processo'],data:['data','data audiencia'],hora:['hora','horario'],vara:['vara','juizo','juízo'],tipo:['tipo','tipo audiencia'],partes:['partes','parte','autor'],procurador:['procurador','advogado','responsavel'],link:['link','link audiencia','url'],situacao:['situacao','situação','status'],resultado:['resultado','desfecho'],obs:['obs','observacoes','observações','resumo']};
const fc=campo=>{for(const a of map[campo]||[]){const i=header.indexOf(a);if(i>=0)return i;}return-1;};
const cols={}; Object.keys(map).forEach(k=>{cols[k]=fc(k);});
const novos=[];
for(let i=1;i<lines.length;i++){
const cells=lines[i].split(',').map(c=>c.trim().replace(/^"|"$/g,''));
const get=k=>cols[k]>=0?cells[cols[k]]||'':'';
let dv=get('data'); if(dv&&dv.includes('/'))dv=dataISO(dv);
const nomePr=get('procurador')||CONFIG.PROC_PADRAO;
novos.push({processo:get('processo'),data:dv,hora:get('hora'),vara:get('vara'),tipo:get('tipo'),partes:get('partes'),procurador:nomePr,wppProcurador:wppDe(nomePr),link:get('link'),situacao:get('situacao')||'Agendada',resultado:get('resultado'),obs:get('obs'),_rowId:Date.now()+i});
}
if(!novos.length){alert('Nenhuma audiência encontrada.');return;}
dados=[...dados,...novos];
await salvarAudienciasNoSheet();
atualizar();
alert(`${novos.length} audiência(s) importadas com sucesso.`);
};
reader.readAsText(file,'UTF-8');
}
function exportarCSV(){
if(!dados.length){alert('Não há dados.');return;}
const header=['Processo','Data','Hora','Vara/Juízo','Tipo','Partes','Procurador','WhatsApp','Link','Situação','Resultado','Observações'];
const rows=dados.map(r=>[r.processo,dataBr(r.data),r.hora,r.vara,r.tipo,r.partes,r.procurador,r.wppProcurador,r.link,r.situacao,r.resultado,r.obs].map(v=>'"'+(v||'').replace(/"/g,'""')+'"'));
const csv=[header,...rows].map(r=>r.join(',')).join('\n');
const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
const url=URL.createObjectURL(blob);
const a=document.createElement('a');a.href=url;a.download=`pauta_${hojeISO()}.csv`;a.click();
URL.revokeObjectURL(url);
}
function exportarPDFTabela(){ gerarRelatorioPDF(true); }
async function gerarRelatorioPDF(soPauta=false){
if(typeof PDFLib==='undefined'){alert('Biblioteca PDF ainda carregando. Aguarde.');return;}
const btn=document.getElementById('btnGerarRel');
if(btn){btn.innerHTML='Gerando...<span class="spinner"></span>';btn.disabled=true;}
const {PDFDocument,StandardFonts,rgb,PageSizes}=PDFLib;
const doc=await PDFDocument.create();
const fR=await doc.embedFont(StandardFonts.Helvetica);
const fB=await doc.embedFont(StandardFonts.HelveticaBold);
const W=PageSizes.A4[0],H=PageSizes.A4[1];
const mL=45,mR=45,mT=50,mB=40;
const cAzul=rgb(0.05,0.27,0.49),cCinza=rgb(0.55,0.55,0.55),cLinha=rgb(0.88,0.88,0.88);
const cVerde=rgb(0.23,0.43,0.07),cVerm=rgb(0.64,0.18,0.18),cAmbar=rgb(0.73,0.46,0.09);
let page=doc.addPage([W,H]);let y=H-mT;
function rodape(){page.drawText(`${CONFIG.ORG_NAME} | Gerado em ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`,{x:mL,y:25,size:7,font:fR,color:cCinza});page.drawLine({start:{x:mL,y:35},end:{x:W-mR,y:35},thickness:0.5,color:cLinha});}
function novaPg(){page=doc.addPage([W,H]);y=H-mT;rodape();}
function ck(n=20){if(y-n<mB)novaPg();}
function subtit(txt){ck(24);page.drawText(txt,{x:mL,y,size:11,font:fB,color:cAzul});y-=16;page.drawLine({start:{x:mL,y},end:{x:W-mR,y},thickness:0.5,color:cLinha});y-=8;}
function txt(t,sz=9,cor=rgb(.15,.15,.15),xE=0){
ck(sz+6);const maxW=W-mL-mR-xE;const words=t.split(' ');let ln='';
words.forEach(w=>{const tent=(ln?ln+' ':'')+w;if(fR.widthOfTextAtSize(tent,sz)>maxW&&ln){page.drawText(ln,{x:mL+xE,y,size:sz,font:fR,color:cor});y-=sz+4;ck(sz+4);ln=w;}else ln=tent;});
if(ln){page.drawText(ln,{x:mL+xE,y,size:sz,font:fR,color:cor});y-=sz+4;}
}
const agora=new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'});
page.drawRectangle({x:0,y:H-80,width:W,height:80,color:cAzul});
page.drawText(CONFIG.ORG_NAME,{x:mL,y:H-35,size:13,font:fB,color:rgb(1,1,1)});
page.drawText('RELATÓRIO DE PAUTA DE AUDIÊNCIAS — CONTENCIOSO EM MASSA',{x:mL,y:H-54,size:10,font:fR,color:rgb(.8,.88,.95)});
page.drawText(agora,{x:mL,y:H-70,size:9,font:fR,color:rgb(.7,.8,.9)});
y=H-110;rodape();
const dI=document.getElementById('relDataIni')?.value||'';
const dF=document.getElementById('relDataFim')?.value||'';
const sit2=document.getElementById('relSituacao')?.value||'';
const pr2=document.getElementById('relProcurador')?.value||'';
let ds=dados.filter(r=>{
if(sit2&&r.situacao!==sit2)return false;
if(pr2&&r.procurador!==pr2)return false;
if(dI&&r.data<dI)return false;
if(dF&&r.data>dF)return false;
return true;
});
if(soPauta||document.getElementById('rOpcSumario').checked){
subtit('1. Sumário Executivo');
txt(dI&&dF?`Período: ${dataBr(dI)} a ${dataBr(dF)}`:'Período: todas as audiências registradas',9,cCinza);y-=4;
const total=ds.length,ag=ds.filter(r=>r.situacao==='Agendada').length,re=ds.filter(r=>r.situacao==='Realizada').length,ca=ds.filter(r=>r.situacao==='Cancelada').length;
const nc=Object.keys(detectarConflitos()).length;
const cW=(W-mL-mR)/4;
[[`Total: ${total}`,'Audiências',cAzul],[`${ag}`,'Agendadas',rgb(.07,.37,.65)],[`${re}`,'Realizadas',cVerde],[`${ca}`,'Canceladas',cVerm]].forEach(([v,l,c],i)=>{
const x=mL+i*cW;
page.drawRectangle({x:x+2,y:y-44,width:cW-8,height:44,color:rgb(.96,.97,.99),borderColor:cLinha,borderWidth:.5});
page.drawText(v,{x:x+8,y:y-18,size:16,font:fB,color:c});
page.drawText(l,{x:x+8,y:y-32,size:8,font:fR,color:cCinza});
});
y-=56;
if(nc>0){ck(20);page.drawText(`Atenção: ${nc} conflito(s) de horário detectado(s).`,{x:mL,y,size:9,font:fB,color:cAmbar});y-=16;}
y-=8;
}
if(soPauta||document.getElementById('rOpcPauta').checked){
subtit('2. Pauta de Audiências');
const sorted=ds.sort((a,b)=>(a.data||'').localeCompare(b.data||'')||(a.hora||'').localeCompare(b.hora||''));
const cIdx2=idxsConflito();
if(!sorted.length){txt('Nenhuma audiência encontrada.');}
else sorted.forEach((r,i)=>{
const isC=cIdx2.has(dados.indexOf(r));
ck(56);
page.drawRectangle({x:mL,y:y-50,width:W-mL-mR,height:52,color:isC?rgb(.98,.94,.88):rgb(.97,.98,1),borderColor:isC?cAmbar:cLinha,borderWidth:.5});
page.drawText(`${i+1}. Processo: ${r.processo||'—'}`,{x:mL+8,y:y-14,size:9,font:fB,color:cAzul});
if(isC)page.drawText('CONFLITO DE HORÁRIO',{x:W-mR-112,y:y-14,size:8,font:fB,color:cAmbar});
page.drawText(`Data: ${dataBr(r.data)||'—'}   Hora: ${r.hora||'—'}   Vara: ${(r.vara||'—').slice(0,40)}`,{x:mL+8,y:y-26,size:8,font:fR,color:rgb(.15,.15,.15)});
page.drawText(`Partes: ${(r.partes||'—').slice(0,55)}   Tipo: ${r.tipo||'—'}`,{x:mL+8,y:y-37,size:8,font:fR,color:rgb(.15,.15,.15)});
page.drawText(`Procurador: ${r.procurador||'—'}   Situação: ${r.situacao||'—'}${r.resultado?' | '+r.resultado:''}`,{x:mL+8,y:y-48,size:8,font:fR,color:cCinza});
y-=60;
});
y-=6;
}
if(!soPauta&&document.getElementById('rOpcConflitos').checked){
const conf=detectarConflitos();const chs=Object.keys(conf).sort();
subtit('3. Conflitos de Horário');
if(!chs.length){txt('Nenhum conflito de horário registrado.');}
else{
txt(`${chs.length} conflito(s) identificado(s):`,9,cCinza);y-=6;
chs.forEach((ch,i)=>{
const lista=conf[ch];const[data,hora]=ch.split('|');
ck(30+lista.length*26);
page.drawText(`Conflito ${i+1}: ${dataBr(data)} às ${hora}`,{x:mL,y,size:9,font:fB,color:cAmbar});y-=14;
lista.forEach(r=>{page.drawText(`  Processo ${r.processo||'—'} — ${r.vara||'—'} | Procurador: ${r.procurador||'—'}`,{x:mL,y,size:8,font:fR,color:rgb(.15,.15,.15)});y-=14;});
y-=4;
});
}
y-=6;
}
if(!soPauta&&document.getElementById('rOpcDistribuicao').checked){
const prcs={};dados.forEach(r=>{const p=r.procurador||'(não atribuído)';if(!prcs[p])prcs[p]={total:0,realizadas:0,agendadas:0,canceladas:0};prcs[p].total++;if(r.situacao==='Realizada')prcs[p].realizadas++;if(r.situacao==='Agendada')prcs[p].agendadas++;if(r.situacao==='Cancelada')prcs[p].canceladas++;});
subtit('4. Distribuição por Procurador');
const ks=Object.keys(prcs).sort((a,b)=>prcs[b].total-prcs[a].total);
if(!ks.length){txt('Nenhum dado disponível.');}
else ks.forEach(p=>{
const v=prcs[p];ck(20);
page.drawText(p,{x:mL,y,size:9,font:fB,color:rgb(.15,.15,.15)});
page.drawText(`Total: ${v.total}  |  Agendadas: ${v.agendadas}  |  Realizadas: ${v.realizadas}  |  Canceladas: ${v.canceladas}`,{x:mL+180,y,size:8,font:fR,color:cCinza});
y-=16;page.drawLine({start:{x:mL,y:y+4},end:{x:W-mR,y:y+4},thickness:.3,color:cLinha});
});
y-=6;
}
if(!soPauta&&document.getElementById('rOpcResultados').checked){
const real=dados.filter(r=>r.situacao==='Realizada'&&r.resultado);
subtit('5. Resultados e Desfechos');
if(!real.length){txt('Nenhuma audiência com resultado registrado.');}
else{
const ct={};real.forEach(r=>{ct[r.resultado]=(ct[r.resultado]||0)+1;});
Object.entries(ct).sort((a,b)=>b[1]-a[1]).forEach(([res,qtd])=>{ck(16);page.drawText(`${res}:`,{x:mL,y,size:9,font:fB,color:rgb(.15,.15,.15)});page.drawText(`${qtd} audiência(s)`,{x:mL+180,y,size:9,font:fR,color:cCinza});y-=16;});
y-=6;
real.slice(0,15).forEach(r=>{ck(40);page.drawText(`Proc. ${r.processo||'—'} — ${dataBr(r.data)}`,{x:mL,y,size:8,font:fB,color:cAzul});y-=12;page.drawText(`Desfecho: ${r.resultado||'—'} | ${r.vara||'—'} | ${r.procurador||'—'}`,{x:mL+8,y,size:8,font:fR,color:cCinza});y-=14;page.drawLine({start:{x:mL,y:y+2},end:{x:W-mR,y:y+2},thickness:.3,color:cLinha});});
}
y-=6;
}
if(!soPauta&&document.getElementById('rOpcObs').checked){
const obs=dados.filter(r=>r.obs&&r.obs.trim());
subtit('6. Observações Registradas');
if(!obs.length){txt('Nenhuma observação registrada.');}
else obs.forEach(r=>{ck(40);page.drawText(`Proc. ${r.processo||'—'} — ${dataBr(r.data)} ${r.hora||''}`,{x:mL,y,size:8,font:fB,color:cAzul});y-=12;txt(r.obs,8,rgb(.2,.2,.2),8);y-=2;page.drawLine({start:{x:mL,y:y+2},end:{x:W-mR,y:y+2},thickness:.3,color:cLinha});});
}
const bytes=await doc.save();
const blob=new Blob([bytes],{type:'application/pdf'});
const url=URL.createObjectURL(blob);
const a=document.createElement('a');a.href=url;a.download=`relatorio_audiencias_${hojeISO()}.pdf`;a.click();
URL.revokeObjectURL(url);
if(btn){btn.innerHTML='Gerar relatório em PDF';btn.disabled=false;}
}
function salvarConfig(){
CONFIG.ORG_NAME=document.getElementById('cfgOrgao').value.trim();
CONFIG.PROC_PADRAO=document.getElementById('cfgProcNome').value.trim();
CONFIG.PROC_WPP=document.getElementById('cfgProcWpp').value.replace(/\D/g,'');
localStorage.setItem('cfg_org_name',CONFIG.ORG_NAME);
localStorage.setItem('cfg_proc_nome',CONFIG.PROC_PADRAO);
localStorage.setItem('cfg_proc_wpp',CONFIG.PROC_WPP);
registrarProcurador(CONFIG.PROC_PADRAO,CONFIG.PROC_WPP);
alert('Configurações salvas.');
atualizar();
}
function atualizar(){atualizarStats();atualizarFiltroProcurador();renderTabela();}
function switchTab(nome){
const nomes=['dashboard','pauta','conflitos','distribuicao','historico','relatorio','planilha','procuradores','usuarios','config'];
nomes.forEach(n=>{ const el=document.getElementById('nav-'+n); if(el) el.classList.toggle('active',n===nome); });
document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
const pg=document.getElementById('tab-'+nome); if(pg) pg.classList.add('active');
const titles={dashboard:'Início',pauta:'Pauta de Audiências',conflitos:'Conflitos de Horário',distribuicao:'Por Procurador',historico:'Histórico',relatorio:'Relatório PDF',planilha:'Importar Planilha',procuradores:'Procuradores',usuarios:'Usuários',config:'Configurações'};
const ht=document.getElementById('pageHeaderTitle');if(ht)ht.textContent=titles[nome]||nome;
if(nome==='dashboard')renderDashboard();
if(nome==='conflitos')renderConflitos();
if(nome==='distribuicao')renderDistribuicao();
if(nome==='historico')renderHistorico();
if(nome==='procuradores')renderProcuradores();
if(nome==='usuarios')renderUsuarios();
if(nome==='planilha')atualizarResumoXlsx();
if(nome==='config'){
document.getElementById('cfgProcNome').value=CONFIG.PROC_PADRAO;
document.getElementById('cfgProcWpp').value=CONFIG.PROC_WPP;
document.getElementById('cfgOrgao').value=CONFIG.ORG_NAME;
}
}
['modalBg','modalProcBg','modalUserBg'].forEach(id=>{
document.getElementById(id).addEventListener('click',function(e){if(e.target===this)this.classList.remove('open');});
});
const DADOS_PLANILHA_INICIAL = [];
function carregarDadosPlanilha() {
const existente = localStorage.getItem('local_audiencias');
if(!existente || JSON.parse(existente).length === 0) {
dados = JSON.parse(JSON.stringify(DADOS_PLANILHA_INICIAL));
salvarLocal();
}
}
function importarXlsx(file) {
if(!file) return;
const status = document.getElementById('xlsxStatus');
const preview = document.getElementById('xlsxPreview');
status.style.display = 'block';
status.style.background = 'var(--blue-50)';
status.style.borderColor = 'var(--blue-200)';
status.style.color = 'var(--blue-800)';
status.textContent = '⏳ Lendo planilha...';
preview.style.display = 'none';
const reader = new FileReader();
reader.onload = function(e) {
try {
const wb = XLSX.read(e.target.result, {type:'array', cellDates:true});
const novos = [];
const procRe = /\d{7}-\s*\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/;
const linkRe = /https?:\/\/meet\.google\.com\/[a-z0-9\-]+/i;
wb.SheetNames.forEach(sheetName => {
const ws = wb.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
if(rows.length < 2) return;
rows.forEach((row, i) => {
if(i === 0) return;
const dataHora = row[0];
if(!dataHora) return;
let dataObj;
if(dataHora instanceof Date) {
dataObj = dataHora;
} else if(typeof dataHora === 'number') {
dataObj = new Date(Math.round((dataHora - 25569) * 86400 * 1000));
} else {
try { dataObj = new Date(dataHora); } catch(e) { return; }
}
if(isNaN(dataObj.getTime())) return;
const varaRaw = String(row[1]||'').replace(/\n/g,' ').trim();
const procPartes = String(row[2]||'').replace(/\n/g,' ').trim();
const procurador = String(row[3]||'').trim();
const resumo = String(row[4]||'').replace(/\n/g,' ').trim();
const obsLink = String(row[5]||'').replace(/\n/g,' ').trim();
const mProc = procPartes.match(procRe);
const processo = mProc ? mProc[0] : '';
const partes = procPartes.replace(processo,'').trim();
const mTipo = varaRaw.match(/\(([^)]+)\)/);
const tipo = mTipo ? mTipo[1].trim() : 'Instrução e Julgamento';
const vara = varaRaw.replace(/\s*\([^)]+\)/,'').trim();
const mLink = linkRe.exec(obsLink) || linkRe.exec(resumo);
const link = mLink ? mLink[0] : '';
const obs = (!linkRe.test(obsLink) ? obsLink : '').slice(0,400) || resumo.slice(0,400);
const dataStr = dataObj.toISOString().slice(0,10);
const hora = dataObj.toTimeString().slice(0,5);
novos.push({
processo, data: dataStr, hora, vara, tipo,
partes: partes.slice(0,200),
procurador, wppProcurador:'', link,
situacao:'Agendada', resultado:'',
obs: obs.slice(0,400),
_rowId: (processo||Date.now()) + '_' + dataStr + '_' + hora
});
});
});
if(!novos.length) {
status.style.background='var(--red-bg)';status.style.borderColor='rgba(235,87,87,.2)';status.style.color='var(--red)';
status.textContent='❌ Nenhuma audiência encontrada. Verifique se o arquivo é a PAUTA_DE_AUDIÊNCIAS_2026.xlsx correta.';
return;
}
if(!confirm(`Importar ${novos.length} audiências da planilha? Os dados atuais serão substituídos.`)) return;
setSyncStatus('loading','Salvando no banco...');
try {
const chunks = [];
for(let i=0;i<novos.length;i+=50) chunks.push(novos.slice(i,i+50));
for(const chunk of chunks){
const rows = chunk.map(r=>({processo:r.processo,data:r.data||null,hora:r.hora,vara:r.vara,tipo:r.tipo,partes:r.partes,procurador:r.procurador,wpp_procurador:r.wppProcurador,link:r.link,situacao:r.situacao,resultado:r.resultado,obs:r.obs}));
const {error} = await supa.from('audiencias').upsert(rows,{onConflict:'processo,data,hora',ignoreDuplicates:false});
if(error) throw error;
}
await sincronizar();
} catch(e){ setSyncStatus('err','Erro ao salvar: '+e.message); }
status.style.background='var(--green-bg)';status.style.borderColor='rgba(39,174,96,.2)';status.style.color='var(--green)';
status.textContent=`✅ ${novos.length} audiências importadas com sucesso!`;
atualizarResumoXlsx();
preview.style.display='block';
preview.innerHTML=`<div style="font-size:12px;color:var(--text-2);margin-top:8px;background:var(--card-bg-2);padding:12px;border-radius:8px;border:1px solid var(--border)">
<strong>Prévia dos dados importados:</strong><br>
${novos.slice(0,5).map(r=>`• ${r.processo||'—'} — ${r.data} ${r.hora} — ${r.vara.slice(0,40)}`).join('<br>')}
${novos.length>5?`<br><em>...e mais ${novos.length-5} audiências.</em>`:''}
</div>`;
} catch(err) {
status.style.background='var(--red-bg)';status.style.borderColor='rgba(235,87,87,.2)';status.style.color='var(--red)';
status.textContent='❌ Erro ao ler o arquivo: '+err.message;
}
};
reader.readAsArrayBuffer(file);
}
function atualizarResumoXlsx() {
const el = document.getElementById('xlsxResumo');
if(!el) return;
const total = dados.length;
const meses = {};
dados.forEach(r=>{ if(r.data) { const m=r.data.slice(0,7); meses[m]=(meses[m]||0)+1; } });
const mesesStr = Object.entries(meses).sort().map(([m,q])=>{
const [ano,mes]=m.split('-');
const nomes=['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
return `${nomes[+mes]}/${ano}: ${q}`;
}).join(' &nbsp;·&nbsp; ');
el.innerHTML=`<strong>${total}</strong> audiências carregadas &nbsp;|&nbsp; ${mesesStr||'—'}`;
}
let _urgCache = {};
function calcUrgencia(r){
if(r.situacao !== 'Agendada') return 'cinza';
const d = parseData(r.data);
if(!d) return 'cinza';
const diff = Math.floor((d - HOJE) / 86400000);
if(diff < 0)  return 'cinza';
if(diff === 0) return 'vermelho';
if(diff <= 2)  return 'vermelho';
if(diff <= 7)  return 'amarelo';
return 'verde';
}
function urgClass(r){ return {vermelho:'urgV',amarelo:'urgA',verde:'urgG',cinza:'urgC'}[calcUrgencia(r)]||''; }
function urgBadge(r){
const u = calcUrgencia(r);
const labels = {vermelho:'Urgente',amarelo:'Em breve',verde:'OK',cinza:'Concluída'};
const cls    = {vermelho:'v',amarelo:'a',verde:'g',cinza:'c'};
return `<span class="urg-badge ${cls[u]}">${labels[u]}</span>`;
}
let _viewMode = 'tabela';
let _expandIdx = null;
function setView(mode){
_viewMode = mode;
document.getElementById('vtTabela').classList.toggle('active', mode==='tabela');
document.getElementById('vtCards').classList.toggle('active', mode==='cards');
const tw = document.querySelector('.table-wrap');
const cv = document.getElementById('cardsView');
if(tw) tw.style.display = mode==='tabela' ? '' : 'none';
if(cv) cv.style.display = mode==='cards'  ? 'grid' : 'none';
renderTabela();
}
function toggleExpand(idx){
const existing = document.getElementById('expandRow_' + idx);
if(existing){ existing.remove(); _expandIdx=null; return; }
if(_expandIdx !== null){
const old = document.getElementById('expandRow_' + _expandIdx);
if(old) old.remove();
}
_expandIdx = idx;
const r = dados[idx];
if(!r) return;
const tbody = document.getElementById('corpoTabela');
const rows = tbody.querySelectorAll('tr[data-idx]');
let targetRow = null;
rows.forEach(tr => { if(parseInt(tr.dataset.idx)===idx) targetRow=tr; });
if(!targetRow) return;
const temWpp = !!(r.wppProcurador||wppDe(r.procurador));
const tr = document.createElement('tr');
tr.id = 'expandRow_' + idx;
tr.className = 'expand-row';
tr.innerHTML = `<td colspan="10">
<div class="expand-inner">
<div class="expand-grid">
<div class="expand-field"><label>Partes</label><span>${r.partes||'—'}</span></div>
<div class="expand-field"><label>Procurador</label><span>${r.procurador||'—'}</span></div>
<div class="expand-field"><label>Tipo</label><span>${r.tipo||'—'}</span></div>
<div class="expand-field"><label>Sala</label><span>${r.obs||'—'}</span></div>
${r.resultado?`<div class="expand-field"><label>Resultado</label><span>${r.resultado}</span></div>`:''}
</div>
<div class="status-btns">
${isEditor()?`
<button class="btn sm" onclick="editarAudiencia(${idx})">Editar</button>
<button class="sbtn R" onclick="mudarSituacao(${idx},'Realizada')">✓ Realizada</button>
<button class="sbtn C" onclick="mudarSituacao(${idx},'Cancelada')">✕ Cancelada</button>
<button class="sbtn M" onclick="mudarSituacao(${idx},'Remarcada')">↺ Remarcada</button>`:''}
${temWpp?`<button class="btn-wpp sm" onclick="enviarWpp(${idx},'aviso')">${svgWpp}</button>`:''}
${r.link?`<a href="${r.link}" target="_blank" class="btn sm">🔗 Entrar na audiência</a>`:''}
</div>
</div>
</td>`;
targetRow.after(tr);
}
async function mudarSituacao(idx, novoStatus){
dados[idx].situacao = novoStatus;
const old = document.getElementById('expandRow_'+idx);
if(old) old.remove();
_expandIdx = null;
setSyncStatus('loading','Salvando...');
try {
await dbSalvarAudiencia(dados[idx]);
setSyncStatus('ok', `Situação: ${novoStatus}`);
atualizar();
} catch(e){ setSyncStatus('err','Erro: '+e.message); atualizar(); }
}
let _searchIdx = -1;
function abrirBusca(){
document.getElementById('searchOverlay').classList.add('open');
setTimeout(()=>document.getElementById('searchInput').focus(), 80);
renderBusca();
}
function fecharBusca(){
document.getElementById('searchOverlay').classList.remove('open');
document.getElementById('searchInput').value='';
_searchIdx=-1;
}
function renderBusca(){
const q = document.getElementById('searchInput').value.toLowerCase().trim();
const el = document.getElementById('searchResults');
if(!q){ el.innerHTML='<div class="search-empty">Digite para buscar audiências</div>'; return; }
const res = dados.map((r,i)=>({...r,_idx:i})).filter(r=>{
return (r.processo+r.partes+r.vara+r.procurador+r.tipo+dataBr(r.data)).toLowerCase().includes(q);
}).slice(0,12);
if(!res.length){ el.innerHTML='<div class="search-empty">Nenhuma audiência encontrada</div>'; return; }
el.innerHTML = res.map((r,i)=>{
const urg = urgClass(r);
return `<div class="search-result-item${i===_searchIdx?' active':''}" data-sidx="${i}" onclick="irParaAudiencia(${r._idx})">
<span class="urg-badge ${urg==='urgV'?'v':urg==='urgA'?'a':urg==='urgG'?'g':'c'}" style="min-width:54px;justify-content:center">${r.situacao||'—'}</span>
<div style="flex:1;min-width:0">
<div style="font-size:12px;font-weight:600;font-family:monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.processo||'—'}</div>
<div style="font-size:11px;color:var(--text-2)">${dataBr(r.data)||'—'} ${r.hora||''} · ${r.vara||'—'}</div>
</div>
<span style="font-size:11px;color:var(--text-3)">↵</span>
</div>`;
}).join('');
_searchIdx = -1;
}
function navBusca(e){
const items = document.querySelectorAll('.search-result-item');
if(e.key==='ArrowDown'){ e.preventDefault(); _searchIdx=Math.min(_searchIdx+1,items.length-1); }
else if(e.key==='ArrowUp'){ e.preventDefault(); _searchIdx=Math.max(_searchIdx-1,0); }
else if(e.key==='Enter'){ e.preventDefault(); if(items[_searchIdx]) items[_searchIdx].click(); return; }
else if(e.key==='Escape'){ fecharBusca(); return; }
items.forEach((it,i)=>it.classList.toggle('active',i===_searchIdx));
}
function irParaAudiencia(idx){
fecharBusca();
switchTab('pauta');
document.getElementById('filtroTexto').value = dados[idx]?.processo||'';
renderTabela();
setTimeout(()=>{
const row = document.querySelector(`tr[data-idx="${idx}"]`);
if(row){ row.scrollIntoView({behavior:'smooth',block:'center'}); toggleExpand(idx); }
}, 200);
}
let _calAno, _calMes;
function renderDashboard(){
const hj = hojeISO();
const fs = fimSemana();
const nc = Object.keys(detectarConflitos()).length;
document.getElementById('dsHoje').textContent      = dados.filter(r=>r.data===hj&&r.situacao==='Agendada').length;
document.getElementById('dsSemana').textContent    = dados.filter(r=>{const d=parseData(r.data);return d&&d>=HOJE&&d<=fs&&r.situacao==='Agendada'}).length;
document.getElementById('dsConflitos').textContent = nc;
document.getElementById('dsRealizadas').textContent= dados.filter(r=>r.situacao==='Realizada').length;
const proximas = dados
.filter(r=>r.situacao==='Agendada'&&r.data>=hj)
.sort((a,b)=>(a.data+a.hora).localeCompare(b.data+b.hora))
.slice(0,8);
const cIdx = idxsConflito();
const diasNome=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const el = document.getElementById('dashProximas');
if(!proximas.length){ el.innerHTML='<div class="empty" style="padding:2rem">Nenhuma audiência agendada.</div>'; }
else {
el.innerHTML = proximas.map(r=>{
const idx = dados.indexOf(r);
const u = calcUrgencia(r);
const uc = {vermelho:'urgV',amarelo:'urgA',verde:'urgG',cinza:'urgC'}[u];
const d = parseData(r.data);
const dow = d ? diasNome[d.getDay()] : '';
const dom = r.data ? r.data.slice(8) : '';
const temConf = cIdx.has(idx);
return `<div class="prox-card ${uc}" onclick="irParaAudiencia(${idx})">
<div class="prox-date-box ${uc}">
<div class="dow">${dow}</div>
<div class="dom">${dom}</div>
</div>
<div class="prox-sep"></div>
<div style="font-size:12px;font-weight:600;color:var(--text-2);min-width:38px">${r.hora||'—'}</div>
<div style="flex:1;min-width:0">
<div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.processo||'—'}</div>
<div style="font-size:11px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.vara||'—'} · ${r.tipo||'—'}</div>
</div>
${temConf?'<span class="urg-badge v">Conflito</span>':urgBadge(r)}
</div>`;
}).join('');
}
const hoje = new Date();
if(!_calAno){ _calAno=hoje.getFullYear(); _calMes=hoje.getMonth(); }
renderCal();
}
function calMes(delta){
_calMes += delta;
if(_calMes>11){ _calMes=0; _calAno++; }
if(_calMes<0) { _calMes=11; _calAno--; }
renderCal();
}
function renderCal(){
const meses=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
document.getElementById('calTitulo').textContent = `${meses[_calMes]} ${_calAno}`;
const primeiroDia = new Date(_calAno, _calMes, 1).getDay();
const diasNoMes  = new Date(_calAno, _calMes+1, 0).getDate();
const hoje = new Date(); hoje.setHours(0,0,0,0);
const hj = hojeISO();
const diaMap = {};
const cIdx = idxsConflito();
dados.forEach((r,idx)=>{
if(!r.data||r.data.slice(0,7)!==`${_calAno}-${String(_calMes+1).padStart(2,'0')}`) return;
const dia = parseInt(r.data.slice(8));
if(!diaMap[dia]) diaMap[dia]={aud:0,conf:false};
diaMap[dia].aud++;
if(cIdx.has(idx)) diaMap[dia].conf=true;
});
const dow=['D','S','T','Q','Q','S','S'];
let html = dow.map(d=>`<div class="cal-dow">${d}</div>`).join('');
for(let i=0;i<primeiroDia;i++) html+=`<div class="cal-day outro-mes"></div>`;
for(let d=1;d<=diasNoMes;d++){
const isoD = `${_calAno}-${String(_calMes+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
let cls='cal-day';
if(isoD===hj) cls+=' hoje';
if(diaMap[d]?.conf) cls+=' has-conf';
else if(diaMap[d]?.aud) cls+=' has-aud';
html+=`<div class="${cls}" onclick="filtrarDia('${isoD}')" title="${diaMap[d]?diaMap[d].aud+' audiência(s)':''}">${d}</div>`;
}
document.getElementById('calGrid').innerHTML = html;
}
function filtrarDia(iso){
switchTab('pauta');
document.getElementById('filtroData').value = iso;
renderTabela();
}
document.addEventListener('keydown', e=>{
if((e.ctrlKey||e.metaKey)&&e.key==='k'){ e.preventDefault(); abrirBusca(); }
if(e.key==='Escape'){ fecharBusca(); }
});
window.addEventListener('load', async () => {
garantirAdminPadrao();
await entrar({name:'Usuário', usuario:'admin', role:'admin'});
});