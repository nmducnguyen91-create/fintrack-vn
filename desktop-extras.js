// FinTrack VN — desktop extras: bảng kê, báo cáo, lịch, nhập nhanh, phím tắt, CSV
(function(){
  const GROUPS={personal:'Cá nhân',company:'Công ty',project:'Công việc'};
  let sort={col:'date',dir:-1};
  let selTxId=null,qaEditId=null,repGroup='',repMonth=new Date().toISOString().slice(0,7),calMonth=new Date().toISOString().slice(0,7),calDay=null;
  const acctName=id=>{const a=(db.accounts||[]).find(x=>x.id===id);return a?a.name:(id||'')};
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const dt=d=>{if(!d)return'';const p=d.split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:d};
  const monthLabel=m=>{const p=m.split('-');return'T'+(+p[1])+'/'+p[0]};

  // ══ INJECT UI ══
  const css=document.createElement('style');
  css.textContent=`
  .dx-card{background:var(--card);border:1px solid var(--bdr);border-radius:16px;box-shadow:0 2px 10px rgba(16,40,64,.05)}
  .dx-h{font-size:16px;font-weight:800;padding:16px 18px 0}
  .dx-sel{padding:10px 14px;border:1px solid var(--bdr);border-radius:10px;background:var(--light);font-size:14px;color:var(--text)}
  .dx-btn{padding:10px 18px;border:none;border-radius:10px;background:var(--navy);color:#fff;font-size:14px;font-weight:700;cursor:pointer}
  .dx-btn2{padding:10px 16px;border:1px solid var(--bdr);border-radius:10px;background:var(--light);color:var(--text);font-size:14px;font-weight:600;cursor:pointer}
  .dx-kbd{display:inline-block;background:var(--light);border:1px solid var(--bdr);border-radius:5px;padding:1px 6px;font-size:11px;font-weight:700;color:var(--muted)}
  #qa-panel{position:fixed;right:24px;bottom:24px;width:330px;z-index:1200;display:none;padding:16px;box-shadow:0 12px 40px rgba(16,40,64,.22)}
  #qa-panel.open{display:block}
  #qa-panel input,#qa-panel select,#qa-panel textarea{width:100%;padding:10px 13px;border:1px solid var(--bdr);border-radius:10px;background:var(--light);font-size:14.5px;color:var(--text);box-sizing:border-box}
  #tx-detail{position:fixed;right:24px;top:90px;width:310px;z-index:1150;display:none;padding:16px}
  #tx-detail.open{display:block}
  #csv-overlay{display:none;position:fixed;inset:0;background:rgba(10,20,32,.45);z-index:1300;align-items:center;justify-content:center}
  #csv-overlay.open{display:flex}
  .cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;padding:14px 16px 16px}
  .cal-cell{min-height:96px;border:1px solid var(--bdr);border-radius:10px;padding:8px 10px;font-size:13.5px;cursor:pointer;background:var(--card)}
  .cal-cell:hover{background:var(--light)}
  .cal-cell.sel{outline:2px solid var(--navy)}
  .cal-cell.today{background:var(--light)}
  .rep-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .tt-edit-input{width:110px;padding:4px 6px;border:1px solid var(--navy);border-radius:6px;font-size:13px}
  @media (max-width:900px){#nav-report,#nav-cal,#qa-panel,#tx-detail{display:none!important}}
  @media print{#qa-panel,#tx-detail,.dx-noprint{display:none!important}}`;
  document.head.appendChild(css);

  // Nav buttons
  const nav=document.querySelector('.bottom-nav');
  const mkNav=(id,label,svg,fn)=>{const b=document.createElement('button');b.className='nav-btn';b.id='nav-'+id;b.innerHTML=svg+label;b.onclick=fn;nav.appendChild(b)};
  mkNav('report','Báo cáo','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="4" y1="20" x2="20" y2="20"/><rect x="5" y="11" width="3" height="7"/><rect x="10.5" y="6" width="3" height="12"/><rect x="16" y="9" width="3" height="9"/></svg>',()=>{showTab('report');renderReport()});
  mkNav('cal','Lịch','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/></svg>',()=>{showTab('cal');renderCal()});

  // Screens
  const tableScr=document.getElementById('screen-table');
  const repScr=document.createElement('div');repScr.className='screen';repScr.id='screen-report';
  repScr.innerHTML=`
  <div class="card dx-noprint" style="padding:12px 16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
    <select id="rep-group" class="dx-sel"><option value="">Tất cả nhóm</option><option value="personal">Cá nhân</option><option value="company">Công ty</option><option value="project">Công việc</option></select>
    <input type="month" id="rep-month" class="dx-sel">
    <span style="flex:1"></span>
    <button class="dx-btn" onclick="window.print()">In / Xuất PDF</button>
  </div>
  <div class="card dx-noprint" style="padding:10px 16px;display:flex;gap:8px">
    <button class="dx-btn2" id="rep-tab-m" onclick="repView('month')">Theo tháng</button>
    <button class="dx-btn2" id="rep-tab-y" onclick="repView('year')">Cả năm</button>
    <button class="dx-btn2" id="rep-tab-f" onclick="repView('forecast')">Dự báo dòng tiền</button>
  </div>
  <div id="rep-view-month">
  <div class="card"><div class="dx-h">Dòng tiền 12 tháng</div><div id="rep-flow" style="padding:10px 16px 16px"></div></div>
  <div class="rep-grid" style="margin:0 12px 12px">
    <div class="dx-card"><div class="dx-h">So sánh tháng</div><div id="rep-compare" style="padding:10px 16px 16px"></div></div>
    <div class="dx-card"><div class="dx-h">Theo nhóm — <span id="rep-mlabel"></span></div><div id="rep-groups" style="padding:10px 16px 16px"></div></div>
    <div class="dx-card"><div class="dx-h">Cơ cấu chi tiêu</div><div id="rep-cats" style="padding:10px 16px 16px"></div></div>
    <div class="dx-card"><div class="dx-h">Top 10 khoản chi</div><div id="rep-top" style="padding:10px 16px 16px"></div></div>
  </div>
  </div>
  <div id="rep-view-year" style="display:none">
    <div class="card" style="padding:12px 16px;display:flex;gap:10px;align-items:center" >
      <button class="dx-btn2" onclick="repYearShift(-1)">‹</button><b id="rep-year-label" style="font-size:15px"></b><button class="dx-btn2" onclick="repYearShift(1)">›</button>
    </div>
    <div class="card"><div class="dx-h">Tổng kết năm</div><div id="rep-year-sum" style="padding:10px 16px 16px"></div></div>
    <div class="card"><div class="dx-h">Bảng thu chi 12 tháng</div><div style="overflow:auto"><table class="tt-table" id="rep-year-table"></table></div></div>
    <div class="card"><div class="dx-h">Xu hướng danh mục chi theo năm</div><div id="rep-year-cats" style="padding:10px 16px 16px"></div></div>
  </div>
  <div id="rep-view-forecast" style="display:none">
    <div class="card" style="padding:12px 16px;display:flex;gap:10px;align-items:center">
      <span style="font-size:13px;color:var(--muted)">Dự báo số dư khả dụng (tiền mặt + ngân hàng + ví) trong</span>
      <select id="fc-days" class="dx-sel" onchange="renderReport()"><option value="30">30 ngày</option><option value="60" selected>60 ngày</option><option value="90">90 ngày</option></select>
      <span style="font-size:12px;color:var(--muted)">— gồm giao dịch định kỳ, hạn thẻ tín dụng, dịch vụ đến hạn và mức chi tiêu trung bình</span>
    </div>
    <div class="card"><div class="dx-h">Đường số dư dự kiến</div><div id="fc-chart" style="padding:10px 16px 16px"></div></div>
    <div class="card"><div class="dx-h">Các khoản sắp tới</div><div id="fc-events" style="padding:6px 16px 14px"></div></div>
  </div>`;
  tableScr.after(repScr);
  const calScr=document.createElement('div');calScr.className='screen';calScr.id='screen-cal';
  calScr.innerHTML=`
  <div class="card dx-noprint" style="padding:12px 16px;display:flex;gap:10px;align-items:center">
    <button class="dx-btn2" onclick="calShift(-1)">‹</button>
    <input type="month" id="cal-month" class="dx-sel">
    <button class="dx-btn2" onclick="calShift(1)">›</button>
    <span style="font-size:12.5px;color:var(--muted)">Bấm vào ngày để xem giao dịch</span>
  </div>
  <div class="card"><div id="cal-grid-wrap"></div></div>
  <div class="card" id="cal-day-card" style="display:none"><div class="dx-h" id="cal-day-title"></div><div id="cal-day-list" style="padding:8px 16px 14px"></div></div>`;
  repScr.after(calScr);

  // Quick add panel
  const qa=document.createElement('div');qa.className='dx-card';qa.id='qa-panel';
  qa.innerHTML=`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
    <b style="font-size:14px" id="qa-title">Nhập nhanh</b>
    <span style="font-size:11.5px;color:var(--muted)"><span class="dx-kbd">Enter</span> lưu · <span class="dx-kbd">Esc</span> đóng</span>
  </div>
  <div style="display:grid;gap:9px">
    <div style="display:flex;gap:8px">
      <button class="dx-btn2" id="qa-out" style="flex:1" onclick="qaFlow('out')">Chi</button>
      <button class="dx-btn2" id="qa-in" style="flex:1" onclick="qaFlow('in')">Thu</button>
    </div>
    <input id="qa-amount" class="money-input" placeholder="Số tiền" inputmode="numeric" autocomplete="off">
    <div id="qa-amount-display" style="font-size:11.5px;color:var(--muted);margin:-4px 2px 0;min-height:14px"></div>
    <input id="qa-desc" placeholder="Nội dung" autocomplete="off">
    <div style="display:flex;gap:8px">
      <select id="qa-group" style="flex:1" onchange="qaFillCats()"><option value="personal">Cá nhân</option><option value="company">Công ty</option><option value="project">Công việc</option></select>
      <select id="qa-cat" style="flex:1"></select>
    </div>
    <div style="display:flex;gap:8px">
      <select id="qa-acct" style="flex:1"></select>
      <input type="date" id="qa-date" style="flex:1">
    </div>
    <input id="qa-note" placeholder="Ghi chú (tuỳ chọn)" autocomplete="off">
    <button class="dx-btn" onclick="qaSave()" id="qa-save">Lưu giao dịch (Enter)</button>
  </div>`;
  document.body.appendChild(qa);

  // Detail panel
  const det=document.createElement('div');det.className='dx-card';det.id='tx-detail';document.body.appendChild(det);

  // CSV import overlay
  const ov=document.createElement('div');ov.id='csv-overlay';
  ov.innerHTML=`<div class="dx-card" style="width:640px;max-width:92vw;max-height:86vh;overflow:auto;padding:18px" onclick="event.stopPropagation()">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><b style="font-size:15px">Nhập giao dịch từ CSV</b><button class="dx-btn2" onclick="csvClose()">Đóng</button></div>
    <div style="font-size:12.5px;color:var(--muted);margin-bottom:10px;line-height:1.6">Dán nội dung CSV / sao kê (mỗi dòng: <b>Ngày, Nội dung, Số tiền</b> — số âm hoặc có dấu − là chi) hoặc chọn file. Hỗ trợ ngày dd/mm/yyyy và yyyy-mm-dd, phân cách phẩy / chấm phẩy / tab.</div>
    <textarea id="csv-text" rows="6" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--bdr);border-radius:10px;background:var(--light);font-size:12.5px;font-family:monospace" placeholder="05/07/2026, Cà phê, -45000\n06/07/2026, Lương tháng 7, 25000000" oninput="csvPreview()"></textarea>
    <div style="display:flex;gap:10px;margin:10px 0;flex-wrap:wrap;align-items:center">
      <input type="file" id="csv-file" accept=".csv,.txt" style="font-size:12.5px">
      <select id="csv-group" class="dx-sel"><option value="personal">Cá nhân</option><option value="company">Công ty</option><option value="project">Công việc</option></select>
      <select id="csv-acct" class="dx-sel"></select>
    </div>
    <div id="csv-prev" style="font-size:12.5px"></div>
    <button class="dx-btn" id="csv-commit" style="margin-top:10px;display:none" onclick="csvCommit()"></button>
  </div>`;
  ov.onclick=()=>csvClose();
  document.body.appendChild(ov);
  document.getElementById('csv-file').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{document.getElementById('csv-text').value=ev.target.result;csvPreview()};r.readAsText(f,'utf-8')});

  // Thêm nút xuất CSV + nhập CSV vào thanh lọc bảng kê
  const ctr=document.querySelector('#tt-controls>div');
  if(ctr){const b1=document.createElement('button');b1.className='dx-btn2';b1.textContent='Xuất CSV';b1.onclick=()=>ttExportCSV();
    const b2=document.createElement('button');b2.className='dx-btn2';b2.textContent='Nhập CSV';b2.onclick=()=>csvOpen();
    ctr.insertBefore(b2,ctr.lastElementChild);ctr.insertBefore(b1,b2);}

  // ══ QUICK ADD ══
  let qaF='out';
  window.qaFlow=f=>{qaF=f;
    document.getElementById('qa-out').style.cssText='flex:1;'+(f==='out'?'background:var(--red);color:#fff;border-color:var(--red)':'');
    document.getElementById('qa-in').style.cssText='flex:1;'+(f==='in'?'background:var(--green);color:#fff;border-color:var(--green)':'');
    qaFillCats()};
  window.qaFillCats=()=>{const g=document.getElementById('qa-group').value;
    const cats=((DOMAIN_CATS[g]||DOMAIN_CATS.personal)[qaF==='in'?'in':'out'])||[];
    document.getElementById('qa-cat').innerHTML=cats.map(c=>'<option>'+esc(c[0])+'</option>').join('')};
  const qaFillAccts=()=>{document.getElementById('qa-acct').innerHTML=(db.accounts||[]).map(a=>`<option value="${a.id}"${a.id===mainAcctId()?' selected':''}>${esc(a.name)}</option>`).join('')};
  window.openQuickPanel=(txId)=>{
    qaEditId=txId||null;qaFillAccts();
    document.getElementById('qa-title').textContent=qaEditId?'Sửa giao dịch':'Nhập nhanh';
    document.getElementById('qa-save').textContent=qaEditId?'Cập nhật (Enter)':'Lưu giao dịch (Enter)';
    if(qaEditId){const t=db.transactions.find(x=>x.id===qaEditId);if(t){
      qaFlow(t.flow==='in'?'in':'out');
      document.getElementById('qa-group').value=t.group||'personal';qaFillCats();
      document.getElementById('qa-cat').value=t.category||'';
      setMoneyVal('qa-amount',t.amount);
      document.getElementById('qa-desc').value=t.desc||'';
      document.getElementById('qa-note').value=t.note||'';
      document.getElementById('qa-date').value=t.date||today();
      if(t.account)document.getElementById('qa-acct').value=t.account;
    }}else{qaFlow('out');document.getElementById('qa-date').value=today()}
    document.getElementById('qa-panel').classList.add('open');
    initMoneyInputs();
    setTimeout(()=>document.getElementById('qa-amount').focus(),50)};
  window.closeQuickPanel=()=>{qaEditId=null;document.getElementById('qa-panel').classList.remove('open')};
  window.qaSave=()=>{
    const amount=getMoneyVal('qa-amount');if(!amount)return toast('Nhập số tiền');
    const g=document.getElementById('qa-group').value;
    const o={amount,desc:document.getElementById('qa-desc').value||document.getElementById('qa-cat').value,
      category:document.getElementById('qa-cat').value,group:g,flow:qaF,
      date:document.getElementById('qa-date').value||today(),note:document.getElementById('qa-note').value,
      account:g==='personal'?document.getElementById('qa-acct').value:undefined};
    if(qaEditId){const t=db.transactions.find(x=>x.id===qaEditId);if(t)Object.assign(t,o);qaEditId=null;toast('Đã cập nhật ✓');closeQuickPanel()}
    else{db.transactions.push({id:Date.now(),...o});toast('Đã ghi ✓');
      setMoneyVal('qa-amount',0);document.getElementById('qa-desc').value='';document.getElementById('qa-note').value='';
      document.getElementById('qa-amount').focus()}
    save();renderAll();refreshCur()};
  qa.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.tagName!=='TEXTAREA'){e.preventDefault();qaSave()}});

  // ══ PHÍM TẮT ══
  document.addEventListener('keydown',e=>{
    const tag=(e.target.tagName||'').toLowerCase();
    if(e.key==='Escape'){closeQuickPanel();txDetClose();csvClose();return}
    if(tag==='input'||tag==='textarea'||tag==='select'||e.target.isContentEditable)return;
    if(e.metaKey||e.ctrlKey||e.altKey)return;
    if(e.key==='n'||e.key==='N'){e.preventDefault();openQuickPanel()}
    else if(e.key==='/'){e.preventDefault();showTab('table');renderTxTable();setTimeout(()=>document.getElementById('tt-search').focus(),50)}
    else if(/^[1-9]$/.test(e.key)){const btns=[...document.querySelectorAll('.nav-btn')];const b=btns[+e.key-1];if(b)b.click()}});

  // ══ BẢNG KÊ ══
  window.ttSetSort=function(col){if(sort.col===col)sort.dir*=-1;else{sort.col=col;sort.dir=col==='date'?-1:1}renderTxTable()};
  let lastRows=[];
  window.renderTxTable=function(){
    const scr=document.getElementById('screen-table');if(!scr)return;
    const accSel=document.getElementById('tt-acct');
    if(accSel){const cur=accSel.value;
      accSel.innerHTML='<option value="">Tất cả tài khoản</option>'+(db.accounts||[]).map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('');
      accSel.value=cur;}
    const q=(document.getElementById('tt-search').value||'').toLowerCase();
    const g=document.getElementById('tt-group').value;
    const f=document.getElementById('tt-flow').value;
    const ac=accSel?accSel.value:'';
    const m=document.getElementById('tt-month').value;
    let rows=(db.transactions||[]).filter(t=>{
      if(g&&t.group!==g)return false;
      if(f&&t.flow!==f)return false;
      if(ac&&t.account!==ac&&t.from!==ac&&t.to!==ac)return false;
      if(m&&(t.date||'').slice(0,7)!==m)return false;
      if(q){const hay=((t.desc||'')+' '+(t.category||'')+' '+(t.note||'')+' '+acctName(t.account)).toLowerCase();if(!hay.includes(q))return false}
      return true});
    const key=t=>{switch(sort.col){case 'amount':return +t.amount||0;case 'desc':return (t.desc||'').toLowerCase();case 'category':return (t.category||'').toLowerCase();case 'group':return t.group||'';case 'acct':return acctName(t.account).toLowerCase();default:return t.date||''}};
    rows.sort((a,b)=>{const x=key(a),y=key(b);return ((x<y?-1:x>y?1:0)*sort.dir)||((b.id||0)-(a.id||0))});
    lastRows=rows;
    let tin=0,tout=0;rows.forEach(t=>{if(t.flow==='in')tin+=+t.amount||0;else if(t.flow==='out')tout+=+t.amount||0});
    document.getElementById('tt-summary').innerHTML=`<div style="display:flex;gap:26px;flex-wrap:wrap;padding:13px 16px;border-bottom:1px solid var(--bdr);font-size:13px">
      <span style="font-size:14px">Số dòng <b>${rows.length}</b></span>
      <span>Tổng thu <b style="color:var(--green)">${fmtK(tin)} đ</b></span>
      <span>Tổng chi <b style="color:var(--red)">${fmtK(tout)} đ</b></span>
      <span>Chênh lệch <b style="color:${tin-tout>=0?'var(--green)':'var(--red)'}">${tin-tout<0?'−':''}${fmtK(Math.abs(tin-tout))} đ</b></span>
      <span style="margin-left:auto;color:var(--muted);font-size:11.5px">Bấm dòng: chi tiết · Bấm đúp ô: sửa nhanh</span></div>`;
    const arrow=c=>sort.col===c?(sort.dir>0?' ↑':' ↓'):'';
    const th=(c,label,align)=>`<th onclick="ttSetSort('${c}')" style="text-align:${align||'left'}">${label}${arrow(c)}</th>`;
    const flowCell=t=>t.flow==='in'?'<span style="color:var(--green);font-weight:700">Thu</span>':t.flow==='out'?'<span style="color:var(--red);font-weight:700">Chi</span>':'<span style="color:var(--muted);font-weight:700">CK</span>';
    const amtCell=t=>{const v=fmtK(+t.amount||0)+' đ';
      return t.flow==='in'?`<b style="color:var(--green)">+${v}</b>`:t.flow==='out'?`<b style="color:var(--red)">−${v}</b>`:`<b style="color:var(--muted)">${v}</b>`};
    const accCell=t=>t.flow==='xfer'?esc(acctName(t.from))+' → '+esc(acctName(t.to)):esc(acctName(t.account));
    document.getElementById('tt-table').innerHTML=`<thead><tr>
      ${th('date','Ngày')}${th('desc','Nội dung')}${th('category','Danh mục')}${th('group','Nhóm')}${th('acct','Tài khoản')}<th>Loại</th>${th('amount','Số tiền','right')}
      </tr></thead><tbody>${rows.map(t=>`<tr data-id="${t.id}" onclick="txDetOpen('${t.id}')">
      <td style="white-space:nowrap">${dt(t.date)}</td>
      <td ondblclick="ttEdit(event,'${t.id}','desc')">${esc(t.desc)}${t.note?`<div style="font-size:11.5px;color:var(--muted)">${esc(t.note)}</div>`:''}</td>
      <td>${esc(t.category)}</td><td>${GROUPS[t.group]||esc(t.group)}</td>
      <td>${accCell(t)}</td><td>${flowCell(t)}</td>
      <td style="text-align:right;white-space:nowrap" ondblclick="ttEdit(event,'${t.id}','amount')">${amtCell(t)}</td></tr>`).join('')||'<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:30px">Không có giao dịch phù hợp</td></tr>'}</tbody>`;
  };
  // Sửa nhanh trong ô
  window.ttEdit=function(ev,id,field){
    ev.stopPropagation();
    const t=db.transactions.find(x=>String(x.id)===String(id));if(!t)return;
    const td=ev.currentTarget;
    const cur=field==='amount'?formatMoney(t.amount):(t.desc||'');
    td.innerHTML=`<input class="tt-edit-input" value="${esc(cur)}" style="${field==='amount'?'text-align:right':'width:90%'}">`;
    const inp=td.querySelector('input');inp.focus();inp.select();
    const commit=()=>{if(field==='amount'){const v=parseMoney(inp.value);if(v)t.amount=v}else t.desc=inp.value;
      save();renderAll();renderTxTable()};
    inp.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter')commit();if(e.key==='Escape')renderTxTable()});
    inp.addEventListener('blur',commit);
    if(field==='amount'){inp.addEventListener('input',function(){const n=parseMoney(this.value);this.value=n?formatMoney(n):''})}};
  // Panel chi tiết
  window.txDetOpen=function(id){
    const t=db.transactions.find(x=>String(x.id)===String(id));if(!t)return;selTxId=t.id;
    det.innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><b style="font-size:14px">Chi tiết giao dịch</b><button class="dx-btn2" onclick="txDetClose()" style="padding:4px 10px">✕</button></div>
      <div style="font-size:19px;font-weight:800;color:${t.flow==='in'?'var(--green)':t.flow==='out'?'var(--red)':'var(--muted)'};margin-bottom:8px">${t.flow==='in'?'+':t.flow==='out'?'−':''}${fmt(+t.amount||0)}</div>
      <div style="font-size:13.5px;font-weight:700;margin-bottom:10px">${esc(t.desc)}</div>
      <div style="font-size:12.5px;line-height:2;color:var(--muted)">
        <div style="display:flex;justify-content:space-between"><span>Ngày</span><b style="color:var(--text)">${dt(t.date)}</b></div>
        <div style="display:flex;justify-content:space-between"><span>Danh mục</span><b style="color:var(--text)">${esc(t.category)}</b></div>
        <div style="display:flex;justify-content:space-between"><span>Nhóm</span><b style="color:var(--text)">${GROUPS[t.group]||esc(t.group)}</b></div>
        <div style="display:flex;justify-content:space-between"><span>Tài khoản</span><b style="color:var(--text)">${t.flow==='xfer'?esc(acctName(t.from))+' → '+esc(acctName(t.to)):esc(acctName(t.account))||'—'}</b></div>
        ${t.note?`<div style="display:flex;justify-content:space-between;gap:10px"><span>Ghi chú</span><b style="color:var(--text);text-align:right">${esc(t.note)}</b></div>`:''}
      </div>
      <div style="display:flex;gap:8px;margin-top:14px">
        ${t.flow!=='xfer'?`<button class="dx-btn" style="flex:1" onclick="openQuickPanel(${JSON.stringify(t.id)});txDetClose()">Sửa</button>`:''}
        <button class="dx-btn2" style="flex:1;color:var(--red)" onclick="txDetDel()">Xoá</button>
      </div>`;
    det.classList.add('open')};
  window.txDetClose=()=>{selTxId=null;det.classList.remove('open')};
  window.txDetDel=()=>{if(!selTxId)return;if(!confirm('Xoá giao dịch này?'))return;
    const i=db.transactions.findIndex(x=>x.id===selTxId);if(i>=0)db.transactions.splice(i,1);
    txDetClose();save();renderAll();renderTxTable();toast('Đã xoá ✓')};
  // Xuất CSV
  window.ttExportCSV=function(){
    const head='Ngày;Nội dung;Danh mục;Nhóm;Tài khoản;Loại;Số tiền;Ghi chú';
    const lines=lastRows.map(t=>[dt(t.date),t.desc,t.category,GROUPS[t.group]||t.group,
      t.flow==='xfer'?acctName(t.from)+' -> '+acctName(t.to):acctName(t.account),
      t.flow==='in'?'Thu':t.flow==='out'?'Chi':'CK',
      (t.flow==='out'?-1:1)*(+t.amount||0),t.note||''].map(v=>String(v==null?'':v).replace(/;/g,',')).join(';'));
    const blob=new Blob(['\ufeff'+head+'\n'+lines.join('\n')],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='fintrack-bangke.csv';a.click();
    toast('Đã xuất '+lastRows.length+' dòng ✓')};
  window.printTxTable=function(){window.print()};

  // ══ CSV IMPORT ══
  let csvRows=[];
  window.csvOpen=()=>{document.getElementById('csv-acct').innerHTML=(db.accounts||[]).map(a=>`<option value="${a.id}"${a.id===mainAcctId()?' selected':''}>${esc(a.name)}</option>`).join('');document.getElementById('csv-overlay').classList.add('open')};
  window.csvClose=()=>document.getElementById('csv-overlay').classList.remove('open');
  const parseDate=s=>{s=(s||'').trim();let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);if(m)return m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');
    m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);if(m)return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');return null};
  window.csvPreview=function(){
    const text=document.getElementById('csv-text').value.trim();csvRows=[];
    if(!text){document.getElementById('csv-prev').innerHTML='';document.getElementById('csv-commit').style.display='none';return}
    const lines=text.split(/\r?\n/).filter(l=>l.trim());
    const first=lines[0];const delim=[';','\t',','].reduce((a,b)=>first.split(b).length>first.split(a).length?b:a);
    lines.forEach(l=>{
      const parts=l.split(delim).map(x=>x.trim().replace(/^"|"$/g,''));
      if(parts.length<3)return;
      const date=parseDate(parts[0]);if(!date)return; // bỏ dòng tiêu đề / không hợp lệ
      const amtRaw=parts[parts.length-1].replace(/[^\d\-−]/g,'').replace('−','-');
      const amt=parseInt(amtRaw)||0;if(!amt)return;
      csvRows.push({date,desc:parts.slice(1,parts.length-1).join(' ').trim()||'Giao dịch nhập',amount:Math.abs(amt),flow:amt<0?'out':'in'})});
    document.getElementById('csv-prev').innerHTML=csvRows.length?
      `<table class="tt-table"><thead><tr><th>Ngày</th><th>Nội dung</th><th>Loại</th><th style="text-align:right">Số tiền</th></tr></thead><tbody>
      ${csvRows.slice(0,8).map(r=>`<tr><td>${dt(r.date)}</td><td>${esc(r.desc)}</td><td>${r.flow==='in'?'Thu':'Chi'}</td><td style="text-align:right"><b style="color:${r.flow==='in'?'var(--green)':'var(--red)'}">${fmtK(r.amount)} đ</b></td></tr>`).join('')}
      ${csvRows.length>8?`<tr><td colspan="4" style="color:var(--muted)">… và ${csvRows.length-8} dòng nữa</td></tr>`:''}</tbody></table>`
      :'<div style="color:var(--red)">Không nhận diện được dòng nào — kiểm tra định dạng.</div>';
    const btn=document.getElementById('csv-commit');btn.style.display=csvRows.length?'':'none';btn.textContent='Nhập '+csvRows.length+' giao dịch'};
  window.csvCommit=function(){
    const g=document.getElementById('csv-group').value,ac=document.getElementById('csv-acct').value;
    let base=Date.now();
    csvRows.forEach((r,i)=>db.transactions.push({id:base+i,amount:r.amount,desc:r.desc,category:'Khác',group:g,flow:r.flow,date:r.date,note:'Nhập CSV',account:g==='personal'?ac:undefined}));
    save();renderAll();renderTxTable();csvClose();toast('Đã nhập '+csvRows.length+' giao dịch ✓')};

  // ══ BÁO CÁO ══
  const sumMonth=(m,g)=>{let tin=0,tout=0;(db.transactions||[]).forEach(t=>{
    if(t.flow==='xfer')return;if((t.date||'').slice(0,7)!==m)return;if(g&&t.group!==g)return;
    if(t.flow==='in')tin+=+t.amount||0;else tout+=+t.amount||0});return{tin,tout}};
  window.renderReport=function(){
    const gSel=document.getElementById('rep-group'),mSel=document.getElementById('rep-month');
    if(!gSel.dataset.wired){gSel.dataset.wired=1;gSel.onchange=()=>{repGroup=gSel.value;renderReport()};mSel.onchange=()=>{repMonth=mSel.value;renderReport()}}
    gSel.value=repGroup;mSel.value=repMonth;
    document.getElementById('rep-mlabel').textContent=monthLabel(repMonth);
    // 12 tháng
    const months=[];const d=new Date(repMonth+'-01T12:00:00');
    for(let i=11;i>=0;i--){const x=new Date(d.getFullYear(),d.getMonth()-i,1);months.push(x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0'))}
    const data=months.map(m=>({m,...sumMonth(m,repGroup)}));
    const max=Math.max(1,...data.map(x=>Math.max(x.tin,x.tout)));
    document.getElementById('rep-flow').innerHTML=`
      <div style="display:flex;align-items:flex-end;gap:8px;height:190px">${data.map(x=>`
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer" onclick="repMonthSet('${x.m}')" title="Thu ${fmtK(x.tin)} · Chi ${fmtK(x.tout)}">
          <div style="display:flex;align-items:flex-end;gap:3px;height:150px;width:100%;justify-content:center">
            <div style="width:38%;max-width:22px;background:var(--green);border-radius:4px 4px 0 0;height:${Math.round(x.tin/max*150)}px;min-height:${x.tin?2:0}px"></div>
            <div style="width:38%;max-width:22px;background:var(--red);border-radius:4px 4px 0 0;height:${Math.round(x.tout/max*150)}px;min-height:${x.tout?2:0}px"></div>
          </div>
          <div style="font-size:12px;color:${x.m===repMonth?'var(--navy)':'var(--muted)'};font-weight:${x.m===repMonth?800:400}">${'T'+(+x.m.split('-')[1])}</div>
        </div>`).join('')}</div>
      <div style="display:flex;gap:18px;font-size:13px;color:var(--muted);margin-top:10px"><span><span style="display:inline-block;width:10px;height:10px;background:var(--green);border-radius:3px"></span> Thu</span><span><span style="display:inline-block;width:10px;height:10px;background:var(--red);border-radius:3px"></span> Chi</span><span style="margin-left:auto">Bấm cột để chọn tháng</span></div>`;
    // So sánh tháng
    const cur=sumMonth(repMonth,repGroup);
    const pd=new Date(d.getFullYear(),d.getMonth()-1,1);const pm=pd.getFullYear()+'-'+String(pd.getMonth()+1).padStart(2,'0');
    const prev=sumMonth(pm,repGroup);
    const delta=(a,b)=>b?Math.round((a-b)/b*100):null;
    const dRow=(label,a,b,goodUp)=>{const dl=delta(a,b);
      return`<div style="display:flex;justify-content:space-between;align-items:baseline;padding:9px 0;border-bottom:1px dashed var(--bdr)">
        <span style="font-size:14.5px;color:var(--muted)">${label}</span>
        <span style="text-align:right"><b style="font-size:16px">${fmtK(a)} đ</b>
        ${dl!=null?`<span style="font-size:11.5px;font-weight:700;margin-left:7px;color:${(dl>=0)===goodUp?'var(--green)':'var(--red)'}">${dl>=0?'+':''}${dl}%</span>`:''}</span></div>`};
    document.getElementById('rep-compare').innerHTML=
      `<div style="font-size:11.5px;color:var(--muted);margin-bottom:5px">${monthLabel(repMonth)} so với ${monthLabel(pm)}</div>`+
      dRow('Tổng thu',cur.tin,prev.tin,true)+dRow('Tổng chi',cur.tout,prev.tout,false)+
      `<div style="display:flex;justify-content:space-between;padding:11px 0"><b style="font-size:14.5px">Tích luỹ</b><b style="font-size:16px;color:${cur.tin-cur.tout>=0?'var(--green)':'var(--red)'}">${cur.tin-cur.tout<0?'−':''}${fmtK(Math.abs(cur.tin-cur.tout))} đ</b></div>`;
    // Theo nhóm
    document.getElementById('rep-groups').innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">${Object.entries(GROUPS).map(([k,label])=>{
      const s=sumMonth(repMonth,k);return`<div style="background:var(--light);border-radius:12px;padding:11px 12px">
        <div style="font-size:13.5px;font-weight:700;margin-bottom:6px">${label}</div>
        <div style="font-size:13.5px;color:var(--green)">+${fmtK(s.tin)}</div>
        <div style="font-size:13.5px;color:var(--red)">−${fmtK(s.tout)}</div>
        <div style="font-size:15px;font-weight:800;margin-top:5px;color:${s.tin-s.tout>=0?'var(--green)':'var(--red)'}">${s.tin-s.tout<0?'−':''}${fmtK(Math.abs(s.tin-s.tout))} đ</div></div>`}).join('')}</div>`;
    // Cơ cấu chi
    const byCat={};(db.transactions||[]).forEach(t=>{if(t.flow!=='out')return;if((t.date||'').slice(0,7)!==repMonth)return;if(repGroup&&t.group!==repGroup)return;byCat[t.category||'Khác']=(byCat[t.category||'Khác']||0)+(+t.amount||0)});
    const cats=Object.entries(byCat).sort((a,b)=>b[1]-a[1]);const catTot=cats.reduce((s,c)=>s+c[1],0)||1;
    document.getElementById('rep-cats').innerHTML=cats.length?cats.map(([c,v],i)=>`
      <div style="margin-bottom:11px"><div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px"><span>${esc(c)}</span><b>${fmtK(v)} đ · ${Math.round(v/catTot*100)}%</b></div>
      <div style="height:10px;background:var(--light);border-radius:5px"><div style="height:10px;width:${Math.max(2,Math.round(v/cats[0][1]*100))}%;background:${CAT_COLORS[i%CAT_COLORS.length]};border-radius:4px"></div></div></div>`).join('')
      :'<div style="color:var(--muted);font-size:13px">Chưa có khoản chi trong tháng này</div>';
    // Top 10
    const top=(db.transactions||[]).filter(t=>t.flow==='out'&&(t.date||'').slice(0,7)===repMonth&&(!repGroup||t.group===repGroup)).sort((a,b)=>b.amount-a.amount).slice(0,10);
    document.getElementById('rep-top').innerHTML=top.length?top.map((t,i)=>`
      <div style="display:flex;gap:10px;align-items:baseline;padding:8px 0;border-bottom:1px dashed var(--bdr);font-size:14px">
        <span style="color:var(--muted);width:20px">${i+1}.</span><span style="flex:1">${esc(t.desc)}<span style="color:var(--muted);font-size:12.5px"> · ${dt(t.date)}</span></span>
        <b style="color:var(--red)">${fmtK(t.amount)} đ</b></div>`).join('')
      :'<div style="color:var(--muted);font-size:13px">Không có dữ liệu</div>';
  };
  window.repMonthSet=m=>{repMonth=m;renderReport()};

  // ══ CHẾ ĐỘ XEM BÁO CÁO ══
  let repMode='month',repYear=new Date().getFullYear();
  window.repView=v=>{repMode=v;renderReport()};
  window.repGoMonth=m=>{repMonth=m;repMode='month';renderReport()};
  window.repYearShift=n=>{repYear+=n;renderReport()};
  const _renderReportM=window.renderReport;
  window.renderReport=function(){
    ['month','year','forecast'].forEach(v=>{
      document.getElementById('rep-view-'+v).style.display=repMode===v?'':'none';
      const b=document.getElementById('rep-tab-'+v[0]);
      b.style.cssText=repMode===v?'background:var(--navy);color:#fff;border-color:var(--navy)':''});
    if(repMode==='month')_renderReportM();
    else if(repMode==='year')renderYearReport();
    else renderForecast()};

  // ══ BÁO CÁO NĂM ══
  function renderYearReport(){
    document.getElementById('rep-year-label').textContent='Năm '+repYear;
    const months=[];for(let i=1;i<=12;i++)months.push(repYear+'-'+String(i).padStart(2,'0'));
    const data=months.map(m=>({m,...sumMonth(m,repGroup)}));
    const tin=data.reduce((s,x)=>s+x.tin,0),tout=data.reduce((s,x)=>s+x.tout,0);
    const best=data.reduce((a,b)=>b.tout>a.tout?b:a,data[0]);
    const net=tin-tout;
    const prevY=months.map(m=>(repYear-1)+m.slice(4));
    const ptin=prevY.reduce((s,m)=>s+sumMonth(m,repGroup).tin,0),ptout=prevY.reduce((s,m)=>s+sumMonth(m,repGroup).tout,0);
    const dl=(a,b)=>b?Math.round((a-b)/b*100):null;
    const tile=(label,val,color,sub)=>`<div style="background:var(--light);border-radius:12px;padding:15px 17px"><div style="font-size:12.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.3px">${label}</div><div style="font-size:21px;font-weight:800;color:${color};margin-top:5px">${val}</div>${sub?`<div style="font-size:12.5px;color:var(--muted);margin-top:3px">${sub}</div>`:''}</div>`;
    document.getElementById('rep-year-sum').innerHTML=`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
      ${tile('Tổng thu',fmtK(tin)+' đ','var(--green)',dl(tin,ptin)!=null?(dl(tin,ptin)>=0?'+':'')+dl(tin,ptin)+'% so với '+(repYear-1):'')}
      ${tile('Tổng chi',fmtK(tout)+' đ','var(--red)',dl(tout,ptout)!=null?(dl(tout,ptout)>=0?'+':'')+dl(tout,ptout)+'% so với '+(repYear-1):'')}
      ${tile('Tích luỹ ròng',(net<0?'−':'')+fmtK(Math.abs(net))+' đ',net>=0?'var(--green)':'var(--red)','TB '+fmtK(net/12)+' đ/tháng')}
      ${tile('Chi nhiều nhất',best&&best.tout?monthLabel(best.m):'—','var(--text)',best&&best.tout?fmtK(best.tout)+' đ':'')}
    </div>`;
    document.getElementById('rep-year-table').innerHTML=`<thead><tr><th>Tháng</th><th style="text-align:right">Thu</th><th style="text-align:right">Chi</th><th style="text-align:right">Chênh lệch</th></tr></thead><tbody>
      ${data.map(x=>{const n=x.tin-x.tout;return`<tr style="cursor:pointer" onclick="repGoMonth('${x.m}')"><td>${monthLabel(x.m)}</td><td style="text-align:right;color:var(--green)">${x.tin?'+'+fmtK(x.tin):'—'}</td><td style="text-align:right;color:var(--red)">${x.tout?'−'+fmtK(x.tout):'—'}</td><td style="text-align:right;font-weight:700;color:${n>=0?'var(--green)':'var(--red)'}">${x.tin||x.tout?(n<0?'−':'+')+fmtK(Math.abs(n)):'—'}</td></tr>`}).join('')}
      <tr style="background:var(--light);font-weight:800"><td>Cả năm</td><td style="text-align:right;color:var(--green)">+${fmtK(tin)}</td><td style="text-align:right;color:var(--red)">−${fmtK(tout)}</td><td style="text-align:right;color:${net>=0?'var(--green)':'var(--red)'}">${(net<0?'−':'+')+fmtK(Math.abs(net))}</td></tr></tbody>`;
    // Xu hướng danh mục: tổng chi theo danh mục cả năm + sparkline 12 tháng
    const byCat={};(db.transactions||[]).forEach(t=>{if(t.flow!=='out')return;const m=(t.date||'').slice(0,7);if(!m.startsWith(String(repYear)))return;if(repGroup&&t.group!==repGroup)return;
      const c=t.category||'Khác';byCat[c]=byCat[c]||{total:0,per:{}};byCat[c].total+=+t.amount||0;byCat[c].per[m]=(byCat[c].per[m]||0)+(+t.amount||0)});
    const cats=Object.entries(byCat).sort((a,b)=>b[1].total-a[1].total).slice(0,8);
    document.getElementById('rep-year-cats').innerHTML=cats.length?cats.map(([c,v],ci)=>{
      const vals=months.map(m=>v.per[m]||0);const mx=Math.max(1,...vals);
      return`<div style="display:flex;align-items:center;gap:14px;padding:7px 0;border-bottom:1px dashed var(--bdr)">
        <span style="width:150px;font-size:14px">${esc(c)}</span>
        <div style="flex:1;display:flex;align-items:flex-end;gap:3px;height:34px">${vals.map(x=>`<div style="flex:1;background:${CAT_COLORS[ci%CAT_COLORS.length]};opacity:${x?1:.15};border-radius:2px 2px 0 0;height:${Math.max(x?3:2,Math.round(x/mx*34))}px"></div>`).join('')}</div>
        <b style="width:100px;text-align:right;font-size:14px">${fmtK(v.total)} đ</b></div>`}).join('')
      :'<div style="color:var(--muted);font-size:13px">Chưa có dữ liệu chi trong năm '+repYear+'</div>'}

  // ══ DỰ BÁO DÒNG TIỀN ══
  function renderForecast(){
    const days=+document.getElementById('fc-days').value||60;
    const td=new Date();td.setHours(12,0,0,0);
    const fmtD=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    let bal=(db.accounts||[]).filter(a=>a.type!=='credit').reduce((s,a)=>s+acctBalance(a),0);
    // sự kiện tương lai
    const events=[];
    (db.recurring||[]).forEach(r=>{
      let last=r.lastDate||r.anchorDate||fmtD(td);
      for(let k=0;k<24;k++){const nx=nextOccurrence(last,r.freq||'monthly',r.day);if(r.endDate&&nx>r.endDate)break;
        const nd=new Date(nx+'T12:00:00');if((nd-td)/864e5>days)break;
        if(nd>td){const isIn=(r.flow||(r.type==='income'?'in':'out'))==='in';
          events.push({date:nx,label:r.desc||'Định kỳ',amt:(isIn?1:-1)*(+r.amount||0),kind:'Định kỳ'})}
        last=nx}});
    (db.accounts||[]).forEach(a=>{if(a.type!=='credit')return;const due=nextDueDate(a);if(!due)return;
      const pay=Math.max(0,-acctBalance(a))+cardInstDue(a);if(!pay)return;
      const nd=due;if((nd-td)/864e5<=days&&nd>td)events.push({date:fmtD(nd),label:'Thanh toán thẻ '+a.name,amt:-pay,kind:'Hạn thẻ'})});
    (db.services||[]).forEach(sv=>{if(sv.status==='done'||sv.status==='cancel'||!sv.deadline)return;
      const nd=new Date(sv.deadline+'T12:00:00');if(nd<=td||(nd-td)/864e5>days)return;
      const amt=(+sv.fee||+sv.amount||0);if(!amt)return;
      events.push({date:sv.deadline,label:sv.name||'Dịch vụ',amt:-amt,kind:'Dịch vụ'})});
    // chi tiêu trung bình/ngày (90 ngày qua, trừ các khoản đã là định kỳ)
    const from=new Date(td);from.setDate(from.getDate()-90);
    const recurKeys=new Set((db.recurring||[]).map(r=>((r.desc||'').trim().toLowerCase())));
    let spent=0;(db.transactions||[]).forEach(t=>{if(t.flow!=='out')return;const d=new Date((t.date||'')+'T12:00:00');
      if(d<from||d>td)return;if(recurKeys.has((t.desc||'').trim().toLowerCase()))return;spent+=+t.amount||0});
    const daily=spent/90;
    // build đường số dư
    const byDay={};events.forEach(e=>{(byDay[e.date]=byDay[e.date]||[]).push(e)});
    const pts=[];let b=bal,minB=bal,minD=null;
    for(let i=0;i<=days;i++){const d=new Date(td);d.setDate(d.getDate()+i);const ds=fmtD(d);
      if(i>0){b-=daily;(byDay[ds]||[]).forEach(e=>b+=e.amt)}
      pts.push({ds,d,b});if(b<minB){minB=b;minD=ds}}
    // SVG
    const W=980,H=240,P=42;
    const lo=Math.min(0,minB),hi=Math.max(...pts.map(p=>p.b),bal);
    const X=i=>P+i/(pts.length-1)*(W-P-14),Y=v=>H-30-(v-lo)/((hi-lo)||1)*(H-58);
    const line=pts.map((p,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+Y(p.b).toFixed(1)).join(' ');
    const zeroY=Y(0);
    const marks=events.map(e=>{const i=pts.findIndex(p=>p.ds===e.date);return i<0?'':`<circle cx="${X(i).toFixed(1)}" cy="${Y(pts[i].b).toFixed(1)}" r="4" fill="${e.amt>=0?'var(--green)':'var(--red)'}" opacity=".85"><title>${esc(e.label)}: ${e.amt<0?'−':'+'}${fmtK(Math.abs(e.amt))} đ (${dt(e.date)})</title></circle>`}).join('');
    const gridLines=[0,.25,.5,.75,1].map(f=>{const v=lo+(hi-lo)*f;return`<line x1="${P}" y1="${Y(v)}" x2="${W-14}" y2="${Y(v)}" stroke="var(--bdr)" stroke-dasharray="3 4"/><text x="${P-6}" y="${Y(v)+4}" text-anchor="end" font-size="12" fill="var(--muted)">${fmtK(v)}</text>`}).join('');
    const dLabels=pts.filter((p,i)=>i%Math.ceil(days/8)===0).map(p=>{const i=pts.indexOf(p);return`<text x="${X(i)}" y="${H-10}" text-anchor="middle" font-size="12" fill="var(--muted)">${p.d.getDate()}/${p.d.getMonth()+1}</text>`}).join('');
    document.getElementById('fc-chart').innerHTML=`
      <div style="display:flex;gap:26px;flex-wrap:wrap;font-size:14.5px;margin-bottom:12px">
        <span>Hiện tại <b>${fmtK(bal)} đ</b></span>
        <span>Thấp nhất <b style="color:${minB<0?'var(--red)':'var(--amber,#e67e22)'}">${minB<0?'−':''}${fmtK(Math.abs(minB))} đ</b>${minD?` <span style="color:var(--muted)">(${dt(minD)})</span>`:''}</span>
        <span>Cuối kỳ <b style="color:${pts[pts.length-1].b>=0?'var(--green)':'var(--red)'}">${pts[pts.length-1].b<0?'−':''}${fmtK(Math.abs(pts[pts.length-1].b))} đ</b></span>
        <span style="color:var(--muted)">Chi TB ${fmtK(daily)} đ/ngày (90 ngày qua)</span>
      </div>
      ${minB<0?`<div style="background:var(--dbg,#fdecea);color:var(--red);border-radius:10px;padding:9px 13px;font-size:13px;font-weight:600;margin-bottom:10px">⚠ Dự kiến hụt tiền từ ${dt(minD)} — cân đối lại các khoản chi hoặc chuẩn bị nguồn thu.</div>`:''}
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">
        ${gridLines}
        ${zeroY>20&&zeroY<H-20?`<line x1="${P}" y1="${zeroY}" x2="${W-14}" y2="${zeroY}" stroke="var(--red)" stroke-width="1.2"/>`:''}
        <path d="${line} L ${X(pts.length-1)} ${H-30} L ${P} ${H-30} Z" fill="var(--navy)" opacity=".07"/>
        <path d="${line}" fill="none" stroke="var(--navy)" stroke-width="2.4" stroke-linejoin="round"/>
        ${marks}${dLabels}
      </svg>`;
    const evs=events.sort((a,b)=>a.date.localeCompare(b.date));
    document.getElementById('fc-events').innerHTML=evs.length?evs.map(e=>`
      <div style="display:flex;gap:12px;align-items:baseline;padding:9px 0;border-bottom:1px dashed var(--bdr);font-size:14px">
        <span style="width:84px;color:var(--muted)">${dt(e.date)}</span>
        <span style="flex:1">${esc(e.label)} <span style="font-size:11px;background:var(--light);border-radius:6px;padding:1px 7px;color:var(--muted)">${e.kind}</span></span>
        <b style="color:${e.amt>=0?'var(--green)':'var(--red)'}">${e.amt<0?'−':'+'}${fmtK(Math.abs(e.amt))} đ</b></div>`).join('')
      :'<div style="color:var(--muted);font-size:13px;padding:6px 0">Không có khoản định kỳ / hạn thanh toán nào trong khoảng này — dự báo chỉ dựa trên mức chi trung bình.</div>'}

  // ══ LỊCH ══
  window.calShift=n=>{const p=calMonth.split('-');const x=new Date(+p[0],+p[1]-1+n,1);calMonth=x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0');calDay=null;renderCal()};
  window.renderCal=function(){
    const mi=document.getElementById('cal-month');
    if(!mi.dataset.wired){mi.dataset.wired=1;mi.onchange=()=>{calMonth=mi.value;calDay=null;renderCal()}}
    mi.value=calMonth;
    const [y,mo]=calMonth.split('-').map(Number);
    const first=new Date(y,mo-1,1);const dim=new Date(y,mo,0).getDate();
    const off=(first.getDay()+6)%7; // T2 đầu tuần
    const perDay={};(db.transactions||[]).forEach(t=>{if((t.date||'').slice(0,7)!==calMonth||t.flow==='xfer')return;
      const day=+t.date.slice(8,10);perDay[day]=perDay[day]||{tin:0,tout:0};
      if(t.flow==='in')perDay[day].tin+=+t.amount||0;else perDay[day].tout+=+t.amount||0});
    const dues={};(db.accounts||[]).forEach(a=>{if(a.type==='credit'&&a.dueDay&&a.dueDay<=dim){(dues[a.dueDay]=dues[a.dueDay]||[]).push(a.name)}});
    const tdY=new Date();const isCurM=tdY.getFullYear()===y&&tdY.getMonth()===mo-1;
    let cells='<div class="cal-grid" style="padding-bottom:4px">'+['T2','T3','T4','T5','T6','T7','CN'].map(w=>`<div style="text-align:center;font-size:11.5px;font-weight:700;color:var(--muted)">${w}</div>`).join('')+'</div><div class="cal-grid" style="padding-top:0">';
    for(let i=0;i<off;i++)cells+='<div></div>';
    for(let day=1;day<=dim;day++){
      const s=perDay[day];const du=dues[day];
      cells+=`<div class="cal-cell${calDay===day?' sel':''}${isCurM&&tdY.getDate()===day?' today':''}" onclick="calSel(${day})">
        <div style="font-weight:800;font-size:12.5px;margin-bottom:3px">${day}</div>
        ${s&&s.tin?`<div style="color:var(--green);font-weight:700">+${fmtK(s.tin)}</div>`:''}
        ${s&&s.tout?`<div style="color:var(--red);font-weight:700">−${fmtK(s.tout)}</div>`:''}
        ${du?du.map(n=>`<div style="margin-top:3px;font-size:10.5px;background:var(--wbg,#fff8e1);color:var(--amber,#e67e22);border-radius:6px;padding:1px 5px;font-weight:700">Hạn ${esc(n)}</div>`).join(''):''}
      </div>`}
    cells+='</div>';
    document.getElementById('cal-grid-wrap').innerHTML=cells;
    const dayCard=document.getElementById('cal-day-card');
    if(calDay){
      const ds=calMonth+'-'+String(calDay).padStart(2,'0');
      const list=(db.transactions||[]).filter(t=>t.date===ds).sort((a,b)=>b.amount-a.amount);
      document.getElementById('cal-day-title').textContent='Giao dịch ngày '+dt(ds);
      document.getElementById('cal-day-list').innerHTML=list.length?list.map(t=>`
        <div style="display:flex;gap:10px;align-items:baseline;padding:9px 0;border-bottom:1px dashed var(--bdr);font-size:14px;cursor:pointer" onclick="txDetOpen('${t.id}')">
          <span style="flex:1">${esc(t.desc)}<span style="color:var(--muted);font-size:11.5px"> · ${esc(t.category)} · ${GROUPS[t.group]||''}</span></span>
          <b style="color:${t.flow==='in'?'var(--green)':t.flow==='out'?'var(--red)':'var(--muted)'}">${t.flow==='in'?'+':t.flow==='out'?'−':''}${fmtK(t.amount)} đ</b></div>`).join('')
        :'<div style="color:var(--muted);font-size:13px;padding:6px 0">Không có giao dịch</div>';
      dayCard.style.display='';
    }else dayCard.style.display='none';
  };
  window.calSel=d=>{calDay=calDay===d?null:d;renderCal()};

  // ══ REFRESH KHI DỮ LIỆU ĐỔI ══
  const refreshCur=()=>{if(curTab==='table')renderTxTable();else if(curTab==='report')renderReport();else if(curTab==='cal')renderCal()};
  const _ra=window.renderAll;
  window.renderAll=function(){_ra.apply(this,arguments);refreshCur()};

  // Công tắc chuyển về bản điện thoại (cuối sidebar + trong Cài đặt)
  const sw=document.createElement('button');
  sw.className='dx-btn2';sw.style.cssText='margin:14px 12px 0;display:flex;align-items:center;gap:9px;justify-content:center';
  sw.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="7" y="2" width="10" height="20" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/></svg>Bản điện thoại';
  sw.onclick=()=>{if(confirm('Chuyển sang bản điện thoại? Dữ liệu vẫn đồng bộ chung.'))location.href='fintrack-vn.html'};
  nav.appendChild(sw);
  const setScr=document.getElementById('screen-settings');
  if(setScr){const c=document.createElement('div');c.className='card';c.style.cssText='padding:14px 16px;display:flex;align-items:center;gap:12px';
    c.innerHTML='<div style="flex:1"><div style="font-size:13.5px;font-weight:700">Chế độ hiển thị</div><div style="font-size:12px;color:var(--muted)">Đang dùng bản Desktop — dữ liệu đồng bộ chung với bản điện thoại</div></div><button class="dx-btn" onclick="location.href=\'fintrack-vn.html\'">Chuyển sang bản App</button>';
    setScr.insertBefore(c,setScr.firstChild)}

  // Gợi ý phím tắt ở cuối sidebar
  const hint=document.createElement('div');
  hint.style.cssText='margin-top:auto;padding:12px;font-size:11px;color:var(--muted);line-height:2';
  hint.innerHTML='<span class="dx-kbd">N</span> nhập nhanh &nbsp;<span class="dx-kbd">/</span> tìm kiếm<br><span class="dx-kbd">1</span>–<span class="dx-kbd">9</span> chuyển tab &nbsp;<span class="dx-kbd">Esc</span> đóng';
  nav.appendChild(hint);
})();
