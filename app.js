const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const picker = $('#photoPicker');
const home = $('#screenHome');
const deck = $('#screenDeck');
const cardStack = $('#cardStack');
const emptyDeck = $('#emptyDeck');
const swipeActions = $('#swipeActions');
const queueBar = $('#queueBar');
const trashCount = $('#trashCount');
const deckProgress = $('#deckProgress');
const deckTitle = $('#deckTitle');
const reviewGrid = $('#reviewGrid');
const reviewSubtitle = $('#reviewSubtitle');
const toast = $('#toast');
const floatingAdd = $('#pickPhotosTop');

let items = [];
let working = [];
let index = 0;
let trash = [];
let lastAction = null;
let filter = 'all';

const monthColors = ['red','green','yellow','lilac','forest','pink','ice','navy'];
const monthNames = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

function showToast(message){
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(showToast.t);
  showToast.t = setTimeout(() => toast.classList.add('hidden'), 2200);
}

function openPicker(){ picker.click(); }
$('#pickPhotosTop').addEventListener('click', openPicker);
$('#pickPhotosDeck').addEventListener('click', openPicker);

picker.addEventListener('change', () => {
  const chosen = [...picker.files].map((file, i) => ({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${i}`,
    file,
    url: URL.createObjectURL(file),
    date: new Date(file.lastModified || Date.now()),
    type: 'photos'
  }));
  items.push(...chosen);
  buildMonths();
  working = [...items];
  index = 0;
  showDeck('Tus fotos');
  renderCard();
  picker.value = '';
});

function buildMonths(){
  const counts = new Map();
  items.forEach(it => {
    const key = `${it.date.getFullYear()}-${String(it.date.getMonth()+1).padStart(2,'0')}`;
    counts.set(key, (counts.get(key)||0)+1);
  });

  const sorted = [...counts.keys()].sort().reverse();
  const list = $('#monthList');
  if(sorted.length){
    list.innerHTML = sorted.map((key, idx) => {
      const [y,m] = key.split('-').map(Number);
      return `<button class="month-card ${monthColors[idx%monthColors.length]}" data-month="${key}"><span>${monthNames[m-1]} ’${String(y).slice(-2)}</span><small>${counts.get(key)} fotos</small></button>`;
    }).join('');
  }
  bindMonthCards();
}

function bindMonthCards(){
  $$('.month-card').forEach(btn => btn.addEventListener('click', () => {
    if(!items.length){ openPicker(); return; }
    const key = btn.dataset.month;
    working = items.filter(it => `${it.date.getFullYear()}-${String(it.date.getMonth()+1).padStart(2,'0')}` === key);
    index = 0;
    showDeck(btn.querySelector('span').textContent);
    renderCard();
  }));
}
bindMonthCards();

function showDeck(title){
  home.classList.remove('active');
  deck.classList.add('active');
  floatingAdd.classList.add('hidden');
  deckTitle.textContent = title;
}
function showHome(){
  deck.classList.remove('active');
  home.classList.add('active');
  floatingAdd.classList.remove('hidden');
}
$('#backBtn').addEventListener('click', showHome);

function renderCard(){
  cardStack.innerHTML = '';
  deckProgress.textContent = `${Math.min(index+1, working.length)} / ${working.length}`;
  if(!working.length || index >= working.length){
    cardStack.classList.add('hidden');
    emptyDeck.classList.remove('hidden');
    swipeActions.classList.add('hidden');
    emptyDeck.querySelector('h2').textContent = working.length ? '¡Listo por ahora!' : 'Elige fotos de tu celular';
    emptyDeck.querySelector('p').textContent = working.length ? 'Ya revisaste todas las fotos de esta selección.' : 'La web puede abrir el selector de fotos. En iPhone, el navegador no puede borrar directamente elementos de la app Fotos.';
    updateQueue();
    return;
  }
  emptyDeck.classList.add('hidden');
  cardStack.classList.remove('hidden');
  swipeActions.classList.remove('hidden');

  const current = working[index];
  const next = working[index+1];
  if(next){
    const n = createCard(next, false);
    n.style.transform = 'scale(.96) translateY(16px)';
    n.style.opacity = '.72';
    cardStack.appendChild(n);
  }
  const c = createCard(current, true);
  cardStack.appendChild(c);
  attachSwipe(c, current);
}

function createCard(item, top){
  const el = document.createElement('article');
  el.className = 'photo-card';
  el.dataset.id = item.id;
  const sizeMB = (item.file.size / 1024 / 1024).toFixed(1);
  el.innerHTML = `
    <img src="${item.url}" alt="${item.file.name}">
    <div class="decision keep-tag">KEEP</div>
    <div class="decision trash-tag">BORRAR</div>
    <div class="meta"><span>${item.file.name}</span><span>${sizeMB} MB</span></div>`;
  return el;
}

function attachSwipe(card, item){
  let startX=0, startY=0, dx=0, active=false;
  const keepTag = card.querySelector('.keep-tag');
  const trashTag = card.querySelector('.trash-tag');
  const start = (x,y)=>{active=true;startX=x;startY=y;card.style.transition='none'};
  const move = (x,y)=>{
    if(!active)return;
    dx=x-startX; const dy=y-startY;
    card.style.transform=`translate(${dx}px,${dy*.12}px) rotate(${dx/18}deg)`;
    const alpha=Math.min(Math.abs(dx)/120,1);
    keepTag.style.opacity=dx<0?alpha:0;
    trashTag.style.opacity=dx>0?alpha:0;
  };
  const end = ()=>{
    if(!active)return; active=false; card.style.transition='transform .25s ease,opacity .25s ease';
    if(Math.abs(dx)>110) decide(dx>0?'trash':'keep', card, item, dx>0?1:-1);
    else {card.style.transform='';keepTag.style.opacity=0;trashTag.style.opacity=0}
  };
  card.addEventListener('pointerdown',e=>{card.setPointerCapture(e.pointerId);start(e.clientX,e.clientY)});
  card.addEventListener('pointermove',e=>move(e.clientX,e.clientY));
  card.addEventListener('pointerup',end); card.addEventListener('pointercancel',end);
}

function decide(action, card = cardStack.lastElementChild, item = working[index], dir = action==='trash'?1:-1){
  if(!item || !card)return;
  if(action==='trash' && !trash.some(x=>x.id===item.id)) trash.push(item);
  lastAction = {action,item,index};
  card.style.transform=`translateX(${dir*130}%) rotate(${dir*18}deg)`;
  card.style.opacity='0';
  setTimeout(()=>{index++;renderCard()},180);
  updateQueue();
}
$('#keepBtn').addEventListener('click',()=>decide('keep'));
$('#trashBtn').addEventListener('click',()=>decide('trash'));

function updateQueue(){
  trashCount.textContent = trash.length;
  queueBar.classList.toggle('hidden', trash.length===0);
}
$('#undoBtn').addEventListener('click',()=>{
  if(!lastAction) return;
  if(lastAction.action==='trash') trash = trash.filter(x=>x.id!==lastAction.item.id);
  index = Math.max(0,lastAction.index);
  lastAction = null;
  renderCard(); updateQueue(); showToast('Última decisión deshecha');
});

$('#shuffleDeck').addEventListener('click',()=>{
  working = [...working].sort(()=>Math.random()-.5); index=0; renderCard();
});

function showSheet(sheet){ $('#scrim').classList.remove('hidden'); sheet.classList.remove('hidden'); }
function hideSheets(){ $('#scrim').classList.add('hidden'); $$('.sheet').forEach(s=>s.classList.add('hidden')); }
$('#menuBtn').addEventListener('click',()=>showSheet($('#randomSheet')));
$('#scrim').addEventListener('click',hideSheets);
$$('.filter').forEach(btn=>btn.addEventListener('click',()=>{
  filter=btn.dataset.filter; hideSheets();
  if(!items.length){ openPicker(); return; }
  working=[...items].sort(()=>Math.random()-.5); index=0; showDeck(btn.querySelector('span').textContent); renderCard();
}));

$('#reviewBtn').addEventListener('click',()=>{
  reviewGrid.innerHTML = trash.map(it=>`<img src="${it.url}" alt="${it.file.name}">`).join('');
  reviewSubtitle.textContent = `${trash.length} elemento${trash.length===1?'':'s'}`;
  showSheet($('#reviewSheet'));
});
$('#closeReview').addEventListener('click',hideSheets);
$('#clearTrash').addEventListener('click',()=>{trash=[];updateQueue();hideSheets();showToast('Nada se eliminó')});
$('#exportTrash').addEventListener('click',()=>{
  const ids = new Set(trash.map(x=>x.id));
  items = items.filter(x=>!ids.has(x.id));
  working = working.filter(x=>!ids.has(x.id));
  trash.forEach(x=>URL.revokeObjectURL(x.url));
  trash=[]; index=0; buildMonths(); updateQueue(); renderCard(); hideSheets();
  showToast('Eliminadas de esta sesión');
});

$('#streakBtn').addEventListener('click',()=>showToast('Racha de limpieza: 1 día'));

if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{})); }
