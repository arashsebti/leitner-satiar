'use strict';
const KEY='satiar-leitner-v1', DAY=86400000, INTERVALS=[1,2,4,8,16];
let cards=load(), editing=null, queue=[], current=null, revealed=false, sessionWrong=new Set(), sessionSeen=0, sessionCorrect=0;
function load(){try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x.filter(valid):[]}catch{return []}}
function valid(c){return c&&typeof c.id==='string'&&typeof c.front==='string'&&typeof c.back==='string'&&typeof c.subject==='string'&&Number.isInteger(c.level)&&c.level>=0&&c.level<=4&&Number.isFinite(c.due)}
function save(){try{localStorage.setItem(KEY,JSON.stringify(cards));return true}catch{alert('ذخیره‌سازی ممکن نشد. فضای مرورگر یا تنظیمات آن را بررسی کنید.');return false}}
function el(id){return document.getElementById(id)}
function clean(s){return String(s||'').trim()}
function notify(s){const m=el('message');m.textContent=s;m.style.display='block';setTimeout(()=>m.style.display='none',2500)}
function tab(name){document.querySelectorAll('section').forEach(x=>x.classList.toggle('active',x.id===name));if(name==='home')renderStats();if(name==='cards')renderCards();if(name==='review'){subjects();startReview()}}
function resetForm(){editing=null;el('cardForm').reset();el('formTitle').textContent='ساخت کارت'}
el('cardForm').addEventListener('submit',e=>{e.preventDefault();const subject=clean(el('subject').value),chapter=clean(el('chapter').value),front=clean(el('front').value),back=clean(el('back').value);if(!subject||!front||!back)return;const old=cards.find(c=>c.id===editing);if(old)Object.assign(old,{subject,chapter,front,back});else cards.push({id:crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random(),subject,chapter,front,back,level:0,due:Date.now(),reviews:0,correct:0,history:[]});if(save()){resetForm();renderStats();notify('کارت ذخیره شد 🌟');tab('cards')}});
function renderStats(){const due=cards.length;const totalReviews=cards.reduce((s,c)=>s+(c.reviews||0),0);const correct=cards.reduce((s,c)=>s+(c.correct||0),0);el('stats').innerHTML='';[['کل کارت‌ها',cards.length],['قابل تمرین همین حالا',due],['مرورهای انجام‌شده',totalReviews],['درصد پاسخ درست',totalReviews?Math.round(correct/totalReviews*100)+'٪':'—']].forEach(([label,value])=>{const d=document.createElement('div');const b=document.createElement('b');b.textContent=value;const p=document.createElement('p');p.textContent=label;d.append(b,p);el('stats').append(d)})}
function subjects(){const sel=el('reviewSubject'),v=sel.value;sel.replaceChildren();const all=document.createElement('option');all.value='';all.textContent='همه درس‌ها';sel.append(all);[...new Set(cards.map(c=>c.subject))].sort((a,b)=>a.localeCompare(b,'fa')).forEach(s=>{const o=document.createElement('option');o.value=s;o.textContent=s;sel.append(o)});sel.value=[...sel.options].some(o=>o.value===v)?v:''}
// Difficulty = smoothed error rate, with extra weight for the last mistake.
function counts(c){const n=Math.max(0,Number(c.reviews)||0),good=Math.min(n,Math.max(0,Number(c.correct)||0));return {n,good,bad:n-good,rate:n?(n-good)/n:0}}
function priority(c){const x=counts(c);return (x.bad+1)/(x.n+2)+(c.lastWrong?0.20:0)+(4-c.level)*0.025}
// Every card appears at least once. Difficult cards appear 2–3 times per round.
// Interleave repeats so a card does not normally appear twice in a row.
function startReview(){
 const subject=el('reviewSubject').value;
 const selected=cards.filter(c=>!subject||c.subject===subject).sort((a,b)=>priority(b)-priority(a)||a.id.localeCompare(b.id));
 const passes=[[],[],[]];
 selected.forEach(c=>{const x=counts(c);passes[0].push(c.id);if(x.n>=1&&priority(c)>=0.45)passes[1].push(c.id);if(x.n>=2&&priority(c)>=0.68)passes[2].push(c.id)});
 queue=[];
 for(let i=0;i<passes.length;i++){for(const id of passes[i]){if(queue.at(-1)===id&&passes[i].length>1)continue;queue.push(id)} }
 // If only one difficult card exists, its repeats are still intentionally included.
 if(selected.length===1){queue=passes.flat()}
 sessionWrong=new Set();sessionSeen=0;sessionCorrect=0;
 next();
}
function next(){current=queue.shift()||null;revealed=false;showReview()}
function showReview(){
 const a=el('reviewArea');a.replaceChildren();
 if(!current){
  const p=document.createElement('p');p.textContent=cards.length?'🎉 این دور مرور تمام شد!':'هنوز کارتی نساخته‌ای.';a.append(p);
  if(sessionSeen){const summary=document.createElement('p');summary.className='muted';summary.textContent=`در این دور: ${sessionCorrect} پاسخ درست از ${sessionSeen} کارت. ${sessionWrong.size} کارت نیازمند تمرین بیشتر است.`;a.append(summary)}
  if(cards.length){const b=document.createElement('button');b.textContent='🔁 مرور دوباره (ابتدا پاسخ‌های نادرست)';b.onclick=startReview;a.append(b)}
  return;
 }
 const c=cards.find(x=>x.id===current);if(!c){next();return}
 const meta=document.createElement('p');meta.className='muted';meta.textContent=`${c.subject} / ${c.chapter||'بدون فصل'} — مرحله ${c.level+1} از ۵ — ${queue.length+1} پرسش باقی‌مانده — سابقه: ${counts(c).good} درست، ${counts(c).bad} نادرست از ${counts(c).n} پاسخ`;
 const box=document.createElement('div');box.className='card';box.tabIndex=0;const sideLabel=document.createElement('div');sideLabel.className='card-side-label'+(revealed?' answer':'');sideLabel.textContent=revealed?'جواب':'سؤال';const content=document.createElement('div');content.className='card-content';content.textContent=revealed?c.back:c.front;box.append(sideLabel,content);
 box.onclick=()=>{if(!revealed){revealed=true;showReview()}};
 box.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();box.click()}};
 a.append(meta,box);
 if(!revealed){const b=document.createElement('button');b.textContent='نمایش پاسخ';b.onclick=()=>{revealed=true;showReview()};a.append(b)}
 else{const row=document.createElement('div');row.className='row';[['بلد نبودم',false],['بلد بودم',true]].forEach(([label,ok])=>{const b=document.createElement('button');b.textContent=label;b.className=ok?'':'danger';b.onclick=()=>grade(ok);row.append(b)});a.append(row)}
}
function grade(ok){
 const c=cards.find(x=>x.id===current);if(!c)return next();
 c.reviews=(c.reviews||0)+1;sessionSeen++;
 if(ok){c.correct=(c.correct||0)+1;c.level=Math.min(4,c.level+1);c.lastWrong=false;sessionCorrect++}
 else{c.level=0;c.lastWrong=true;sessionWrong.add(c.id)}
 if(!Array.isArray(c.history))c.history=[];c.history.push({at:new Date().toISOString(),ok:!!ok});c.lastReviewed=Date.now();c.due=Date.now(); // compatible with v1 backups; no waiting
 if(save()){renderStats();next()}
}
function renderCards(){const q=clean(el('search').value).toLowerCase(),list=el('cardList');list.replaceChildren();const matching=cards.filter(c=>[c.subject,c.chapter,c.front,c.back].some(s=>String(s||'').toLowerCase().includes(q)));if(!matching.length){list.textContent='کارتی پیدا نشد.';return}matching.forEach(c=>{const div=document.createElement('div');div.className='item';const title=document.createElement('b');title.textContent=`${c.subject} / ${c.chapter||'بدون فصل'} — مرحله ${c.level+1}`;const p=document.createElement('p');p.textContent=c.front;const small=document.createElement('p');small.className='muted';const x=counts(c);small.textContent=`کل پاسخ‌ها: ${x.n} | درست: ${x.good} | نادرست: ${x.bad} | درصد نادرست: ${x.n?Math.round(x.rate*100)+'٪':'—'} | اولویت: ${priority(c)>=0.68?'خیلی زیاد':priority(c)>=0.45?'زیاد':'معمولی'}`;const edit=document.createElement('button');edit.className='secondary';edit.textContent='ویرایش';edit.onclick=()=>{editing=c.id;el('subject').value=c.subject;el('chapter').value=c.chapter||'';el('front').value=c.front;el('back').value=c.back;el('formTitle').textContent='ویرایش کارت';tab('add')};const del=document.createElement('button');del.className='danger';del.textContent='حذف';del.onclick=()=>{if(confirm('این کارت حذف شود؟')){cards=cards.filter(x=>x.id!==c.id);if(save()){renderCards();renderStats()}}};const graph=document.createElement('button');graph.className='secondary';graph.textContent='📈 نمودار پیشرفت';graph.onclick=()=>showChart(c.id);div.append(title,p,small,graph,edit,del);list.append(div)})}
function exportData(){const blob=new Blob([JSON.stringify({format:'satiar-leitner-v1',schemaVersion:5,exportedAt:new Date().toISOString(),cards},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='satiar-leitner-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function importData(){const file=el('importFile').files[0];if(!file)return alert('فایل را انتخاب کنید');if(file.size>10*1024*1024)return alert('حجم فایل بیش از حد مجاز است');try{const data=JSON.parse(await file.text());if(data.format!=='satiar-leitner-v1'||!Array.isArray(data.cards)||data.cards.length>20000||!data.cards.every(valid))throw Error('فرمت نامعتبر');if(!confirm(`تعداد ${data.cards.length} کارت از فایل خوانده شد. ادغام انجام شود؟`))return;const map=new Map(cards.map(c=>[c.id,c]));data.cards.forEach(c=>map.set(c.id,{...c,chapter:clean(c.chapter),reviews:Number.isFinite(c.reviews)?Math.max(0,Math.floor(c.reviews)):0,correct:Number.isFinite(c.correct)?Math.max(0,Math.min(Math.floor(c.correct),Math.floor(c.reviews||0))):0,history:sanitizeHistory(c.history)}));const merged=[...map.values()];const before=cards;cards=merged;if(!save()){cards=before;return}renderStats();notify('اطلاعات وارد شد');tab('cards')}catch(e){alert('فایل پشتیبان معتبر نیست: '+e.message)}}

function sanitizeHistory(h){if(!Array.isArray(h))return [];return h.slice(-20000).filter(x=>x&&typeof x.at==='string'&&!Number.isNaN(Date.parse(x.at))&&typeof x.ok==='boolean').map(x=>({at:x.at,ok:x.ok}))}
function showChart(id){
 const c=cards.find(x=>x.id===id);if(!c)return;
 const h=sanitizeHistory(c.history), root=el('chartContent');root.replaceChildren();
 el('chartTitle').textContent='نمودار پیشرفت: '+c.front;
 const total=counts(c),legacy=Math.max(0,total.n-h.length),legacyGood=Math.max(0,total.good-h.filter(x=>x.ok).length);
 const info=document.createElement('p');info.className='muted';info.textContent=`کل پاسخ‌ها: ${total.n} | درست: ${total.good} | نادرست: ${total.bad} | ثبت جزئیات از نسخه ۴: ${h.length} پاسخ`;
 root.append(info);
 if(!h.length){const msg=document.createElement('p');msg.textContent='برای این کارت هنوز تاریخچه پاسخ‌های نسخه ۴ وجود ندارد. پس از اولین مرور، نمودار شکل می‌گیرد. شمارنده‌های نسخه‌های قبلی محفوظ هستند.';root.append(msg);tab('chart');return}
 const help=document.createElement('p');help.className='muted';help.textContent='خط آبی: درصد پاسخ صحیح تجمعی در تاریخچه ثبت‌شده؛ خط سبز: درصد پاسخ صحیح در ۵ پاسخ اخیر. محور افقی شماره پاسخ است.';root.append(help);
 const NS='http://www.w3.org/2000/svg',W=740,H=300,L=54,R=20,T=20,B=45;
 const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.setAttribute('role','img');svg.setAttribute('aria-label','نمودار درصد پاسخ‌های درست به تفکیک مرور');svg.style.cssText='width:100%;height:auto;background:#f8faff;border-radius:12px';
 function node(tag,attrs,text){const e=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));if(text!==undefined)e.textContent=text;svg.append(e);return e}
 for(let y=0;y<=100;y+=25){const py=T+(100-y)/100*(H-T-B);node('line',{x1:L,y1:py,x2:W-R,y2:py,stroke:'#d7dfec','stroke-width':1});node('text',{x:L-8,y:py+4,'text-anchor':'end','font-size':12,fill:'#52647c'},y+'٪')}
 const cum=[],recent=[];let good=0;h.forEach((x,i)=>{if(x.ok)good++;cum.push(good/(i+1)*100);recent.push(h.slice(Math.max(0,i-4),i+1).filter(z=>z.ok).length/Math.min(i+1,5)*100)});
 function path(arr){return arr.map((y,i)=>`${i?'L':'M'}${L+(arr.length===1?0.5:i/(arr.length-1))*(W-L-R)},${T+(100-y)/100*(H-T-B)}`).join(' ')}
 node('path',{d:path(cum),stroke:'#3264b7','stroke-width':3,fill:'none','stroke-linecap':'round'});node('path',{d:path(recent),stroke:'#15946b','stroke-width':3,fill:'none','stroke-linecap':'round'});
 node('text',{x:L,y:H-13,'font-size':12,fill:'#52647c'},'۱');node('text',{x:W-R,y:H-13,'text-anchor':'end','font-size':12,fill:'#52647c'},String(h.length));
 root.append(svg);
 const summary=document.createElement('p');summary.textContent=`در ${h.length} پاسخ ثبت‌شده جدید، میزان پاسخ صحیح ${Math.round(cum.at(-1))}٪ و در حداکثر ۵ پاسخ اخیر ${Math.round(recent.at(-1))}٪ بوده است.`;root.append(summary);
 if(legacy){const note=document.createElement('p');note.className='muted';note.textContent=`${legacy} پاسخ قدیمی‌تر (${legacyGood} درست) فقط به‌صورت شمارنده موجود است؛ تاریخچه زمانی آن در نسخه‌های قبل ذخیره نشده و قابل بازسازی نیست.`;root.append(note)}
 tab('chart');
}
renderStats();if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
