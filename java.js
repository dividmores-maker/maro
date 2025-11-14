/* Keys and initial state */
const LS = { teams:'lg_teams', groups:'lg_groups', standings:'lg_standings', matches:'lg_matches', knockout:'lg_knockout' };
const AUTH = {user:'admin', pass:'1234'};
const state = {
  teams: JSON.parse(localStorage.getItem(LS.teams) || '[]'),
  groups: JSON.parse(localStorage.getItem(LS.groups) || '[]'),
  standings: JSON.parse(localStorage.getItem(LS.standings) || '[]'),
  matches: JSON.parse(localStorage.getItem(LS.matches) || '[]'), // per-group matches schedule
  knockout: JSON.parse(localStorage.getItem(LS.knockout) || '{}')
};
function saveAll(){
  localStorage.setItem(LS.teams, JSON.stringify(state.teams));
  localStorage.setItem(LS.groups, JSON.stringify(state.groups));
  localStorage.setItem(LS.standings, JSON.stringify(state.standings));
  localStorage.setItem(LS.matches, JSON.stringify(state.matches));
  localStorage.setItem(LS.knockout, JSON.stringify(state.knockout));
}

/* Navigation */
function show(id){
  document.querySelectorAll('[id^="page-"]').forEach(e=>e.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}
function goHome(){ show('page-main') }
function enterOrganizer(){ show('page-login') }
function enterAudience(){ show('page-audience'); renderAudience(); }
function doLogin(){
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pass').value.trim();
  if(u===AUTH.user && p===AUTH.pass){ show('page-org'); renderOrganizer(); }
  else alert('بيانات الدخول غلط');
}

/* Teams */
function addTeam(){
  const v = document.getElementById('team-input').value.trim();
  if(!v) return;
  if(state.teams.includes(v)){ alert('الفريق موجود'); return; }
  state.teams.push(v);
  document.getElementById('team-input').value='';
  saveAll(); renderTeamsList();
}
function renderTeamsList(){
  const wrap = document.getElementById('teams-list'); wrap.innerHTML='';
  state.teams.forEach((t,i)=>{
    const el = document.createElement('div'); el.className='tag'; el.style.display='inline-flex'; el.style.gap='8px';
    el.innerHTML = `<span>⚽ ${t}</span> <button class="ghost" onclick="removeTeam(${i})">حذف</button>`;
    wrap.appendChild(el);
  });
}
function removeTeam(i){ state.teams.splice(i,1); saveAll(); renderTeamsList(); }

/* Draw groups & create schedule (each pair once) */
function runGroupsDraw(){
  if(state.teams.length < 4){ alert('سجل 4 فرق على الأقل'); return; }
  const shuffled = [...state.teams].sort(()=>Math.random()-0.5);
  state.groups = [];
  for(let i=0;i<shuffled.length;i+=4) state.groups.push(shuffled.slice(i,i+4));
  // create empty standings
  state.standings = state.groups.map(g => g.map(name=>({name, played:0, win:0, draw:0, lose:0, gf:0, ga:0, pts:0, yellow:0, red:0})));
  // create schedule (all unique pairs per group)
  state.matches = state.groups.map(g=>{
    const pairs = [];
    for(let i=0;i<g.length;i++){
      for(let j=i+1;j<g.length;j++){
        pairs.push({a:g[i], b:g[j], sA:null, sB:null, yA:0, yB:0, rA:0, rB:0, played:false});
      }
    }
    return pairs;
  });
  state.knockout = {}; // clear previous brackets
  saveAll(); renderGroupsOrg(); renderAudience();
  alert('تم عمل القرعة وإنشاء جدول المباريات لكل مجموعة');
}

/* Sorting rules */
function sortGroup(arr){
  return arr.slice().sort((A,B)=>{
    const gdA = A.gf - A.ga, gdB = B.gf - B.ga;
    if(B.pts !== A.pts) return B.pts - A.pts;
    if(gdB !== gdA) return gdB - gdA;
    if(A.red !== B.red) return A.red - B.red;
    if(A.yellow !== B.yellow) return A.yellow - B.yellow;
    if(B.gf !== A.gf) return B.gf - A.gf;
    return A.name.localeCompare(B.name,'ar');
  });
}

/* Recalculate standings from all recorded matches */
function rebuildStandings(){
  // reset standings
  state.standings = state.groups.map(g => g.map(name=>({name, played:0, win:0, draw:0, lose:0, gf:0, ga:0, pts:0, yellow:0, red:0})));
  // apply all matches
  state.matches.forEach((groupMatches, gi)=>{
    groupMatches.forEach(m=>{
      if(m.played && Number.isFinite(m.sA) && Number.isFinite(m.sB)){
        const g = state.standings[gi];
        const A = g.find(x=>x.name===m.a);
        const B = g.find(x=>x.name===m.b);
        if(!A || !B) return;
        A.played++; B.played++;
        A.gf += m.sA; A.ga += m.sB; B.gf += m.sB; B.ga += m.sA;
        A.yellow += (m.yA||0); B.yellow += (m.yB||0);
        A.red += (m.rA||0); B.red += (m.rB||0);
        if(m.sA > m.sB){ A.win++; B.lose++; A.pts += 3; }
        else if(m.sA < m.sB){ B.win++; A.lose++; B.pts += 3; }
        else { A.draw++; B.draw++; A.pts++; B.pts++; }
      }
    });
  });
  saveAll();
}

/* Organizer: render groups + schedule + match editors */
function renderGroupsOrg(){
  const host = document.getElementById('org-groups'); host.innerHTML='';
  if(!state.groups.length){ host.innerHTML='<div class="muted">لا توجد مجموعات بعد — قم بالقرعة</div>'; return; }
  state.groups.forEach((g, gi)=>{
    const c = document.createElement('div'); c.className='card';
    // table
    const sorted = sortGroup(state.standings[gi] || []);
    let html = `<h3>المجموعة ${gi+1}</h3>
      <div class="table"><table><thead><tr>
      <th>الفريق</th><th>لعب</th><th>فوز</th><th>تعادل</th><th>خسارة</th>
      <th>له</th><th>عليه</th><th>فرق</th><th>نقاط</th><th>إنذار</th><th>طرد</th>
      </tr></thead><tbody>`;
    sorted.forEach(t=>{
      html += `<tr><td>${t.name}</td><td>${t.played}</td><td>${t.win}</td><td>${t.draw}</td><td>${t.lose}</td>
        <td>${t.gf}</td><td>${t.ga}</td><td>${t.gf - t.ga}</td><td><b>${t.pts}</b></td><td>${t.yellow}</td><td>${t.red}</td></tr>`;
    });
    html += `</tbody></table></div>`;
    // schedule (matches)
    html += `<div style="margin-top:10px"><h4>جدول المباريات (Schedule)</h4>`;
    const matches = state.matches[gi] || [];
    if(!matches.length) html += `<div class="muted">لا توجد مباريات</div>`;
    matches.forEach((m, mi)=>{
      html += `<div class="pair" id="m-${gi}-${mi}">
        <span>${m.a}</span>
        <span class="vs">—</span>
        <span>${m.b}</span>
        <input type="number" id="m-${gi}-${mi}-a" placeholder="أهداف ${m.a}" style="width:90px" value="${m.sA===null?'':m.sA}" />
        <input type="number" id="m-${gi}-${mi}-b" placeholder="أهداف ${m.b}" style="width:90px" value="${m.sB===null?'':m.sB}" />
        <input type="number" id="m-${gi}-${mi}-yA" placeholder="إنذارات ${m.a}" style="width:120px" value="${m.yA||0}" />
        <input type="number" id="m-${gi}-${mi}-yB" placeholder="إنذارات ${m.b}" style="width:120px" value="${m.yB||0}" />
        <input type="number" id="m-${gi}-${mi}-rA" placeholder="طرد ${m.a}" style="width:100px" value="${m.rA||0}" />
        <input type="number" id="m-${gi}-${mi}-rB" placeholder="طرد ${m.b}" style="width:100px" value="${m.rB||0}" />
        <button onclick="saveMatchResult(${gi},${mi})">${m.played? 'تحديث' : 'حفظ'}</button>
        <button class="ghost" onclick="clearMatchResult(${gi},${mi})">مسح نتيجة</button>
      </div>`;
    });
    html += `</div>`;
    c.innerHTML = html;
    host.appendChild(c);
  });
}

/* Save match result, then rebuild standings from all matches */
function saveMatchResult(gi, mi){
  const m = state.matches[gi][mi];
  const sA = document.getElementById(`m-${gi}-${mi}-a`).value;
  const sB = document.getElementById(`m-${gi}-${mi}-b`).value;
  if(sA === '' || sB === '') { if(!confirm('سجل الأهداف كـ0 إذا تريد ذلك؟')) return; }
  const a = parseInt(sA||'0',10), b = parseInt(sB||'0',10);
  const yA = parseInt(document.getElementById(`m-${gi}-${mi}-yA`).value||'0',10);
  const yB = parseInt(document.getElementById(`m-${gi}-${mi}-yB`).value||'0',10);
  const rA = parseInt(document.getElementById(`m-${gi}-${mi}-rA`).value||'0',10);
  const rB = parseInt(document.getElementById(`m-${gi}-${mi}-rB`).value||'0',10);
  m.sA = a; m.sB = b; m.yA = yA; m.yB = yB; m.rA = rA; m.rB = rB; m.played = true;
  // rebuild full standings to avoid double-counting / support edits
  rebuildStandings();
  renderGroupsOrg(); renderAudience(); saveAll();
}

/* Clear a match (make it unplayed) and rebuild standings */
function clearMatchResult(gi, mi){
  if(!confirm('هل أنت متأكد من مسح نتيجة هذه المباراة؟')) return;
  const m = state.matches[gi][mi];
  m.sA = null; m.sB = null; m.yA=0; m.yB=0; m.rA=0; m.rB=0; m.played=false;
  rebuildStandings(); renderGroupsOrg(); renderAudience(); saveAll();
}

/* Knockout functions (كما في النسخة السابقة) */
function topTwoFromGroupIndex(gi){ return sortGroup(state.standings[gi]||[]).slice(0,2).map(x=>x.name) }

function createKnockoutFromGroups(){
  if(!state.groups.length) { alert('لا توجد مجموعات'); return; }
  const qualified = []; for(let i=0;i<state.groups.length;i++) qualified.push(...topTwoFromGroupIndex(i));
  if(qualified.length < 2) { alert('المتأهلون أقل من اللازم'); return; }
  const shuffled = qualified.sort(()=>Math.random()-0.5);
  const pairs = []; for(let i=0;i<shuffled.length;i+=2) if(shuffled[i+1]) pairs.push({a:shuffled[i], b:shuffled[i+1], sA:null,sB:null, winner:null, loser:null});
  state.knockout.R2 = pairs; saveAll(); renderBracketsOrg(); renderAudience(); alert('تم إنشاء الدور الثاني من المتأهلين');
}

function advanceKnockout(fromKey,toKey){
  const from = state.knockout[fromKey];
  if(!from || !from.length){ alert('لا توجد مباريات في هذا الدور'); return; }
  const winners = from.filter(p=>p.winner).map(p=>p.winner);
  if(winners.length !== from.length){ alert('سجّل نتائج كل مباريات هذا الدور أولا'); return; }
  const shuffled = winners.sort(()=>Math.random()-0.5);
  const next = []; for(let i=0;i<shuffled.length;i+=2) if(shuffled[i+1]) next.push({a:shuffled[i], b:shuffled[i+1], sA:null,sB:null, winner:null, loser:null});
  state.knockout[toKey] = next; saveAll(); renderBracketsOrg(); renderAudience(); alert('تم إنشاء الدور التالي');
}

function advanceFinals(){
  const sf = state.knockout.SF; if(!sf || !sf.length){ alert('لا يوجد نصف نهائي'); return; }
  if(sf.some(p=>!p.winner)){ alert('سجل نتائج نصف النهائي أولاً'); return; }
  const winners = sf.map(p=>p.winner), losers = sf.map(p=>p.loser);
  state.knockout.F = [{a:winners[0], b:winners[1], sA:null,sB:null, winner:null, loser:null}];
  state.knockout.P3 = [{a:losers[0], b:losers[1], sA:null,sB:null, winner:null, loser:null}];
  saveAll(); renderBracketsOrg(); renderAudience(); alert('تم إنشاء النهائي ومباراة المركز الثالث');
}

function renderBracketsOrg(){
  const host = document.getElementById('org-brackets'); host.innerHTML='';
  const order = [['R2','الدور الثاني'],['R3','الدور الثالث'],['SF','نصف النهائي'],['F','النهائي'],['P3','مركز ثالث']];
  order.forEach(([k,label])=>{
    const list = state.knockout[k] || [];
    const card = document.createElement('div'); card.className='card';
    let html = `<h4>${label}</h4>`;
    if(!list.length) html += `<div class="muted">لا يوجد</div>`;
    list.forEach((p, idx)=>{
      html += `<div class="pair">
        <span>${p.a}</span><input type="number" id="${k}-a-${idx}" placeholder="أهداف ${p.a}" style="width:80px" value="${p.sA===null?'':p.sA}" />
        <span class="vs">:</span>
        <input type="number" id="${k}-b-${idx}" placeholder="أهداف ${p.b}" style="width:80px" value="${p.sB===null?'':p.sB}" />
        <button onclick="saveBracketResult('${k}',${idx})">حفظ</button>
        ${p.winner? `<span class="ok">الفائز: ${p.winner}</span>` : ''}
        ${p.loser? `<span class="bad">الخاسر: ${p.loser}</span>` : ''}
      </div>`;
    });
    card.innerHTML = html; host.appendChild(card);
  });
}

function saveBracketResult(stage, idx){
  const list = state.knockout[stage]; if(!list) return;
  const p = list[idx];
  const sA = parseInt(document.getElementById(`${stage}-a-${idx}`).value||'0',10);
  const sB = parseInt(document.getElementById(`${stage}-b-${idx}`).value||'0',10);
  if(isNaN(sA) || isNaN(sB)){ alert('أدخل أرقام صحيحة'); return; }
  p.sA = sA; p.sB = sB;
  if(sA===sB){ alert('الأدوار الإقصائية تحتاج فائز (سجّل نتيجة مختلفة أو ضع نتيجة بعد ضربات الترجيح)'); return; }
  p.winner = sA>sB? p.a : p.b; p.loser = sA>sB? p.b : p.a;
  saveAll(); renderBracketsOrg(); renderAudience();
}

/* Audience render */
function renderAudience(){
  // groups
  const gHost = document.getElementById('audience-groups'); gHost.innerHTML='';
  state.groups.forEach((g, gi)=>{
    const sorted = sortGroup(state.standings[gi] || []);
    const card = document.createElement('div'); card.className='card';
    let html = `<h3>المجموعة ${gi+1}</h3><div class="table"><table><thead><tr>
      <th>الفريق</th><th>لعب</th><th>فوز</th><th>تعادل</th><th>خسارة</th><th>له</th><th>عليه</th><th>فرق</th><th>نقاط</th><th>إنذار</th><th>طرد</th>
      </tr></thead><tbody>`;
    sorted.forEach(t=> html += `<tr><td>${t.name}</td><td>${t.played}</td><td>${t.win}</td><td>${t.draw}</td><td>${t.lose}</td>
      <td>${t.gf}</td><td>${t.ga}</td><td>${t.gf - t.ga}</td><td><b>${t.pts}</b></td><td>${t.yellow}</td><td>${t.red}</td></tr>`);
    html += `</tbody></table></div><details style="margin-top:10px"><summary>عرض جدول المباريات</summary>`;
    const matches = state.matches[gi] || [];
    matches.forEach(m=> html += `<div class="pair">${m.a} ${m.played? '('+m.sA+':'+m.sB+')' : '(لم تُسجّل)'} <span style="margin-inline:8px">—</span> ${m.b}</div>`);
    html += `</details>`;
    card.innerHTML = html; gHost.appendChild(card);
  });

  // brackets
  const bHost = document.getElementById('audience-brackets'); bHost.innerHTML='';
  const order = [['R2','الدور الثاني'],['R3','الدور الثالث'],['SF','نصف النهائي'],['F','النهائي'],['P3','مركز ثالث']];
  order.forEach(([k,label])=>{
    const list = state.knockout[k]; if(!list || !list.length) return;
    const card = document.createElement('div'); card.className='card';
    let html = `<h3>${label}</h3>`;
    list.forEach(p=> html += `<div class="pair">${p.a} ${(p.sA===null?'':'('+p.sA+':'+p.sB+')')} — ${p.b} ${p.winner? `<span class="ok"> (فائز: ${p.winner})</span>`:''}</div>`);
    card.innerHTML = html; bHost.appendChild(card);
  });
}

/* Organizer render */
function renderOrganizer(){ renderTeamsList(); renderGroupsOrg(); renderBracketsOrg(); }

/* Reset all */
function resetAll(){
  if(!confirm('مسح كل البيانات؟')) return;
  state.teams=[]; state.groups=[]; state.standings=[]; state.matches=[]; state.knockout={};
  saveAll(); renderOrganizer(); renderAudience(); alert('تم المسح');
}

/* init */
renderTeamsList();
