/* ============================================================
   LexSchedule — app.js
   ============================================================ */
'use strict';

/* ── Utilities ─────────────────────────────────────────── */
const uid = () => typeof crypto !== 'undefined' && crypto.randomUUID
  ? crypto.randomUUID()
  : Math.random().toString(36).slice(2) + Date.now().toString(36);

const fmtDate = d => {
  if (!d) return '';
  const dt = new Date(d + 'T12:00:00');
  return dt.toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
};
const fmtDateShort = d => {
  if (!d) return '';
  const dt = new Date(d + 'T12:00:00');
  return dt.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
};
const fmtDay = d => {
  if (!d) return '';
  const dt = new Date(d + 'T12:00:00');
  return dt.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
};
const fmtTime = t => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'P.M.' : 'A.M.';
  const hr = h % 12 || 12;
  return `${hr}:${m.toString().padStart(2,'0')} ${ampm}`;
};
const fmtTS = ts => new Date(ts).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit', hour12:true });
const daysDiff = (ts) => Math.ceil((new Date(ts) - Date.now()) / 86400000);
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const initials = name => name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();

/* ── Firebase ──────────────────────────────────────────── */
firebase.initializeApp({
  apiKey: "AIzaSyAWAcepKB_7IyiLT8Hs5o5x4BVF6j3L-A8",
  authDomain: "lexschedule-15fa2.firebaseapp.com",
  projectId: "lexschedule-15fa2",
  storageBucket: "lexschedule-15fa2.firebasestorage.app",
  messagingSenderId: "24035193740",
  appId: "1:24035193740:web:c33d8b8d7c6b6e65c65ca9",
  measurementId: "G-BJPKEGYD0K"
});
const db     = firebase.firestore();
const fbAuth = firebase.auth();
function _firmId(email) {
  const e = email || S?.user?.email || fbAuth.currentUser?.email || '';
  return e.split('@')[1]?.replace(/\./g, '_') || 'unknown';
}

/* ── LexSchedule Logo SVG (red calendar + gold scales superimposed) ─── */
const logoSVG = (sz = 28) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="${sz}" height="${sz}">
  <!-- Center post -->
  <line x1="12" y1="3.5" x2="12" y2="18.5" stroke="#C09D5F" stroke-width="1.8" stroke-linecap="round"/>
  <!-- Top finial -->
  <circle cx="12" cy="3.5" r="1.1" fill="#C09D5F"/>
  <!-- Horizontal beam -->
  <line x1="3" y1="8" x2="21" y2="8" stroke="#C09D5F" stroke-width="1.8" stroke-linecap="round"/>
  <!-- Left chain -->
  <line x1="5.5" y1="8" x2="5.5" y2="13" stroke="#C09D5F" stroke-width="1.1" stroke-linecap="round"/>
  <!-- Right chain -->
  <line x1="18.5" y1="8" x2="18.5" y2="13" stroke="#C09D5F" stroke-width="1.1" stroke-linecap="round"/>
  <!-- Left pan -->
  <path d="M3 13 Q5.5 17 8 13" stroke="#C09D5F" stroke-width="1.4" fill="rgba(192,157,95,0.25)" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Right pan -->
  <path d="M16 13 Q18.5 17 21 13" stroke="#C09D5F" stroke-width="1.4" fill="rgba(192,157,95,0.25)" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Base -->
  <line x1="9" y1="18.5" x2="15" y2="18.5" stroke="#C09D5F" stroke-width="1.6" stroke-linecap="round"/>
  <line x1="10.5" y1="18.5" x2="10.5" y2="20.5" stroke="#C09D5F" stroke-width="1.3" stroke-linecap="round"/>
  <line x1="13.5" y1="18.5" x2="13.5" y2="20.5" stroke="#C09D5F" stroke-width="1.3" stroke-linecap="round"/>
  <line x1="8.5" y1="20.5" x2="15.5" y2="20.5" stroke="#C09D5F" stroke-width="1.6" stroke-linecap="round"/>
</svg>`;

const EVENT_TYPES = {
  'client-meeting':   { label:'Meeting',                 icon:'👥', color:'#1E40AF', bg:'#DBEAFE' },
  'deposition':       { label:'Deposition',              icon:'⚖️',  color:'#7F1D1D', bg:'#FEE2E2' },
  'mediation':        { label:'Mediation',               icon:'🤝', color:'#78350F', bg:'#FEF3C7' },
  'opposing-call':    { label:'Call',                    icon:'📞', color:'#4C1D95', bg:'#F3E8FF' },
  'settlement':       { label:'Settlement Conference',   icon:'📜', color:'#064E3B', bg:'#D1FAE5' },
  'document-review':  { label:'Document Review Session', icon:'📋', color:'#0C4A6E', bg:'#F0F9FF' },
  'court-prep':       { label:'Court Hearing',           icon:'🏛️', color:'#7C2D12', bg:'#FFF7ED' },
  'closing':          { label:'Closing/Signing',         icon:'✍️',  color:'#1E3A5F', bg:'#E0EFFE' },
  'other':            { label:'Other Event',             icon:'📌', color:'#4B5563', bg:'#F3F4F6' },
};

const ROLES = {
  'client':           'Client',
  'opposing-counsel': 'Opposing Counsel',
  'mediator':         'Mediator',
  'co-counsel':       'Co-Counsel',
  'expert':           'Expert Witness',
  'court-reporter':   'Court Reporter',
  'partner':          'Partner',
  'other':            'Other',
};

const AVAIL_CYCLE = { '': 'available', 'available': 'unavailable', 'unavailable': 'maybe', 'maybe': '' };
const AVAIL_ICON  = { 'available':'✓', 'unavailable':'✗', 'maybe':'~', '':'' };
const AVAIL_CLASS = { 'available':'cell-avail', 'unavailable':'cell-unavail', 'maybe':'cell-maybe', '':'cell-empty' };

/* ── State ─────────────────────────────────────────────── */
const S = {
  view: 'landing',
  user: null,
  users: [],
  events: [],
  currentEventId: null,
  createStep: 1,
  createData: { slots:[], participants:[] },
  pendingVerify: null,   // { userId, email, name } while awaiting verification
};

/* ── Storage ───────────────────────────────────────────── */
const STORE = {
  save() {
    if (!S.user) return;
    const firmId = _firmId();
    db.collection('userProfiles').doc(S.user.id).set(S.user).catch(console.error);
    S.events.forEach(ev => {
      db.collection('firms').doc(firmId).collection('events').doc(ev.id).set(ev).catch(console.error);
    });
  },
  deleteEvent(evId) {
    if (!S.user) return;
    db.collection('firms').doc(_firmId()).collection('events').doc(evId).delete().catch(console.error);
  },
  async load() {
    if (!S.user) { S.events = []; return; }
    const snap = await db.collection('firms').doc(_firmId()).collection('events').get();
    S.events = snap.docs.map(d => d.data());
  },
  seedDemo() {
    const atty = { id:'u1', name:'John M. Richardson', email:'attorney@woodsweidenmiller.com',
      password:'Demo1234!', role:'Attorney', firm:'LexSchedule Demo',
      barNumber:'123456', phone:'(239) 555-0101', createdAt: Date.now() };
    const sec  = { id:'u2', name:'Sarah L. Martinez', email:'secretary@woodsweidenmiller.com',
      password:'Demo1234!', role:'Secretary', firm:'LexSchedule Demo',
      barNumber:'', phone:'(239) 555-0102', createdAt: Date.now() };
    S.users = [atty, sec];

    const baseSlots = [
      { id:'s1', date:'2026-03-18', startTime:'09:00', endTime:'11:00' },
      { id:'s2', date:'2026-03-19', startTime:'14:00', endTime:'16:00' },
      { id:'s3', date:'2026-03-20', startTime:'10:00', endTime:'12:00' },
      { id:'s4', date:'2026-03-24', startTime:'09:00', endTime:'11:00' },
    ];

    const ev1 = {
      id:'e1', title:'Hernandez v. Gulf Coast Properties, LLC',
      type:'deposition', caseNumber:'2026-CV-0342',
      matterName:'Hernandez v. Gulf Coast Properties, LLC',
      description:'Deposition of corporate representative regarding property damage claims.',
      status:'active', createdBy:'u1', createdAt: Date.now() - 86400000*2,
      deadline: Date.now() + 86400000*5,
      location:'in-person', locationDetails:'9045 Strada Stell Ct #400, Naples, FL 34109',
      proposedSlots: JSON.parse(JSON.stringify(baseSlots)),
      participants:[
        { id:'p1', name:'Maria Hernandez', email:'mhernandez@email.com', role:'client',
          organization:'', token:'tok-p1', status:'responded',
          availability:{ s1:'available', s2:'unavailable', s3:'available', s4:'maybe' } },
        { id:'p2', name:'Robert Chen, Esq.', email:'rchen@gulfcoastlaw.com', role:'opposing-counsel',
          organization:'Gulf Coast Defense Group', token:'tok-p2', status:'responded',
          availability:{ s1:'unavailable', s2:'available', s3:'available', s4:'unavailable' } },
        { id:'p3', name:'Patricia Dolan', email:'pdolan@courtreporters.com', role:'court-reporter',
          organization:'Precision Court Reporters', token:'tok-p3', status:'pending',
          availability:{} },
      ],
      confirmedSlot:null,
      emailLog:[
        { ts: Date.now()-86400000*2, to:'mhernandez@email.com', subject:'Scheduling Invitation: Hernandez v. Gulf Coast Properties', type:'invitation' },
        { ts: Date.now()-86400000*2, to:'rchen@gulfcoastlaw.com', subject:'Scheduling Invitation: Hernandez v. Gulf Coast Properties', type:'invitation' },
        { ts: Date.now()-86400000*2, to:'pdolan@courtreporters.com', subject:'Scheduling Invitation: Hernandez v. Gulf Coast Properties', type:'invitation' },
      ],
      history:[
        { ts: Date.now()-86400000*2, action:'Event created and invitations sent', user:'John M. Richardson' },
        { ts: Date.now()-86400000*1, action:'Maria Hernandez submitted availability', user:'System' },
        { ts: Date.now()-86400000*1+3600000, action:'Robert Chen submitted availability', user:'System' },
      ],
      notes:'Please ensure court reporter is present for all sessions.',
    };

    const ev2 = {
      id:'e2', title:'Torres Estate Planning Consultation',
      type:'client-meeting', caseNumber:'2026-EST-0089',
      matterName:'Torres Estate Planning Consultation',
      description:'Initial estate planning consultation with client and spouse.',
      status:'confirmed', createdBy:'u2', createdAt: Date.now() - 86400000*7,
      deadline: Date.now() - 86400000*2,
      location:'in-person', locationDetails:'9045 Strada Stell Ct #400, Naples, FL 34109',
      proposedSlots:[
        { id:'t1', date:'2026-03-11', startTime:'10:00', endTime:'11:30' },
        { id:'t2', date:'2026-03-12', startTime:'14:00', endTime:'15:30' },
        { id:'t3', date:'2026-03-13', startTime:'09:00', endTime:'10:30' },
      ],
      participants:[
        { id:'q1', name:'Carlos Torres', email:'ctorres@email.com', role:'client',
          organization:'', token:'tok-q1', status:'responded',
          availability:{ t1:'available', t2:'unavailable', t3:'available' } },
        { id:'q2', name:'Elena Torres', email:'etorres@email.com', role:'client',
          organization:'', token:'tok-q2', status:'responded',
          availability:{ t1:'available', t2:'unavailable', t3:'available' } },
      ],
      confirmedSlot:'t1',
      emailLog:[
        { ts: Date.now()-86400000*7, to:'ctorres@email.com', subject:'Meeting Invitation: Estate Planning', type:'invitation' },
        { ts: Date.now()-86400000*7, to:'etorres@email.com', subject:'Meeting Invitation: Estate Planning', type:'invitation' },
        { ts: Date.now()-86400000*3, to:'ctorres@email.com', subject:'Confirmed: Estate Planning Consultation — March 11', type:'confirmation' },
        { ts: Date.now()-86400000*3, to:'etorres@email.com', subject:'Confirmed: Estate Planning Consultation — March 11', type:'confirmation' },
      ],
      history:[
        { ts: Date.now()-86400000*7, action:'Event created and invitations sent', user:'Sarah L. Martinez' },
        { ts: Date.now()-86400000*5, action:'Carlos Torres submitted availability', user:'System' },
        { ts: Date.now()-86400000*5, action:'Elena Torres submitted availability', user:'System' },
        { ts: Date.now()-86400000*3, action:'Meeting confirmed for March 11, 10:00 A.M. — confirmation emails sent', user:'Sarah L. Martinez' },
      ],
      notes:'',
    };

    const ev3 = {
      id:'e3', title:'Coastal Development LLC v. Marino Brothers',
      type:'mediation', caseNumber:'2025-CV-1147',
      matterName:'Coastal Development LLC v. Marino Brothers',
      description:'Court-ordered mediation session.',
      status:'no-match', createdBy:'u1', createdAt: Date.now() - 86400000*14,
      deadline: Date.now() - 86400000*3,
      location:'video', locationDetails:'Zoom link will be provided upon confirmation',
      proposedSlots:[
        { id:'m1', date:'2026-03-10', startTime:'09:00', endTime:'13:00' },
        { id:'m2', date:'2026-03-11', startTime:'09:00', endTime:'13:00' },
        { id:'m3', date:'2026-03-16', startTime:'09:00', endTime:'13:00' },
      ],
      participants:[
        { id:'r1', name:'Coastal Development LLC (Rep.)', email:'legal@coastaldev.com', role:'client',
          organization:'Coastal Development LLC', token:'tok-r1', status:'responded',
          availability:{ m1:'available', m2:'unavailable', m3:'unavailable' } },
        { id:'r2', name:'Vincent Marino', email:'vmarino@marinobros.com', role:'opposing-counsel',
          organization:'Marino Brothers', token:'tok-r2', status:'responded',
          availability:{ m1:'unavailable', m2:'unavailable', m3:'available' } },
        { id:'r3', name:'Hon. James E. Walsh (Ret.)', email:'jwalsh@mediators.com', role:'mediator',
          organization:'ADR Solutions Group', token:'tok-r3', status:'responded',
          availability:{ m1:'unavailable', m2:'available', m3:'unavailable' } },
      ],
      confirmedSlot:null,
      emailLog:[
        { ts: Date.now()-86400000*14, to:'legal@coastaldev.com', subject:'Mediation Scheduling: Coastal v. Marino', type:'invitation' },
        { ts: Date.now()-86400000*14, to:'vmarino@marinobros.com', subject:'Mediation Scheduling: Coastal v. Marino', type:'invitation' },
        { ts: Date.now()-86400000*14, to:'jwalsh@mediators.com', subject:'Mediation Scheduling: Coastal v. Marino', type:'invitation' },
        { ts: Date.now()-86400000*3, to:'legal@coastaldev.com', subject:'No Mutual Availability — New Scheduling Process Initiated', type:'no-match' },
        { ts: Date.now()-86400000*3, to:'vmarino@marinobros.com', subject:'No Mutual Availability — New Scheduling Process Initiated', type:'no-match' },
        { ts: Date.now()-86400000*3, to:'jwalsh@mediators.com', subject:'No Mutual Availability — New Scheduling Process Initiated', type:'no-match' },
      ],
      history:[
        { ts: Date.now()-86400000*14, action:'Event created and invitations sent', user:'John M. Richardson' },
        { ts: Date.now()-86400000*10, action:'All participants responded', user:'System' },
        { ts: Date.now()-86400000*3, action:'No mutual availability found — no-match notification sent to all parties', user:'System' },
      ],
      notes:'Court deadline for mediation: April 30, 2026.',
    };

    S.events = [ev1, ev2, ev3];
    S.user   = null;
    STORE.save();
  }
};

/* ── Router ────────────────────────────────────────────── */
const ROUTER = {
  init() {
    window.addEventListener('hashchange', () => ROUTER.dispatch());
    ROUTER.dispatch();
  },
  go(hash) { window.location.hash = hash; },
  dispatch() {
    // Handle query-param routes used in email links (avoids # stripping by email clients)
    const qp = new URLSearchParams(window.location.search);
    const respondParam = qp.get('respond');
    const calParam     = qp.get('cal');
    if (respondParam) {
      const [token, eventId, firmId] = respondParam.split('/');
      if (token) return VIEWS.respond(token, eventId, firmId);
    }
    if (calParam) {
      const [eventId, firmId] = calParam.split('/');
      if (eventId) return VIEWS.calDownload(eventId, firmId);
    }

    const hash = window.location.hash || '#/';
    const [base, ...parts] = hash.replace('#','').split('/').filter(Boolean);
    const route = base || '';

    // Public routes
    if (route === 'respond' && parts[0]) { return VIEWS.respond(parts[0], parts[1], parts[2]); }
    if (route === 'cal'     && parts[0]) { return VIEWS.calDownload(parts[0], parts[1]); }
    if (route === '' || route === 'landing') {
      return S.user ? ROUTER.go('/dashboard') : VIEWS.landing();
    }
    if (route === 'login')    return VIEWS.login();
    if (route === 'register') return VIEWS.register();
    if (route === 'waitlist') return VIEWS.waitlist();
    if (route === 'verify')   return VIEWS.verify();

    // Auth-gated routes
    if (!S.user) return ROUTER.go('/login');
    if (route === 'dashboard') return VIEWS.dashboard();
    if (route === 'new') {
      S.createStep = 0;
      S.createData = { mode:'', slots:[], participants:[], type:'', matterName:'', caseNumber:'', description:'', location:'in-person', locationDetails:'', phoneNumber:'', schedulerPhone:'', pollRange:{ startDate:'', endDate:'' }, pollWeekdaysOnly:true, deadline:'', notes:'' };
      return VIEWS.createEvent();
    }
    if (route === 'event' && parts[0]) return VIEWS.eventDetail(parts[0]);
    VIEWS.dashboard();
  }
};

/* ── DOM Helpers ───────────────────────────────────────── */
const VIEW_EL = () => document.getElementById('view');

const render = html => {
  VIEW_EL().innerHTML = html;
  VIEW_EL().scrollTop = 0;
  window.scrollTo(0,0);
};

/* ── Toast ─────────────────────────────────────────────── */
const toast = (msg, type='info', dur=4000) => {
  const c = document.getElementById('toast-container');
  const icons = { info:'ℹ️', success:'✅', error:'❌', warning:'⚠️', email:'📧' };
  const t = document.createElement('div');
  t.style.cssText = `
    background:${type==='error'?'#8B1C2E':'#0B1F3A'};color:#fff;
    padding:13px 18px;border-radius:12px;box-shadow:0 8px 24px rgba(11,31,58,.25);
    display:flex;align-items:center;gap:10px;min-width:260px;max-width:380px;
    border-left:4px solid ${type==='success'?'#276749':type==='error'?'#7F1D1D':type==='email'?'#C09D5F':'#C09D5F'};
    animation:toastIn .3s ease;font-family:'Montserrat',sans-serif;font-size:.82rem;line-height:1.4;
  `;
  t.innerHTML = `<span style="font-size:1rem;flex-shrink:0">${icons[type]||'ℹ️'}</span><span style="flex:1">${esc(msg)}</span><span style="opacity:.5;cursor:pointer;font-size:.9rem" onclick="this.parentNode.remove()">✕</span>`;
  c.appendChild(t);
  setTimeout(() => { t.style.animation = 'toastOut .3s ease forwards'; setTimeout(()=>t.remove(), 300); }, dur);
};

/* ── Modal ─────────────────────────────────────────────── */
const modal = {
  open(html) {
    const o = document.getElementById('modal-overlay');
    document.getElementById('modal-box').innerHTML = html;
    o.style.display = 'flex';
  },
  close() { document.getElementById('modal-overlay').style.display = 'none'; }
};

window.closeModal = () => modal.close();
document.addEventListener('click', e => {
  if (e.target.id === 'modal-overlay') modal.close();
});

/* ── ICS Calendar Generator ────────────────────────────── */
const ICS = {
  _fmt(dateStr, timeStr) {
    const [y,m,d] = dateStr.split('-');
    const [h,min] = timeStr.split(':');
    return `${y}${m}${d}T${h}${min}00`;
  },
  generate(ev, slot) {
    const et      = EVENT_TYPES[ev.type] || {};
    const summary = `${et.label||ev.type}: ${ev.matterName}`;
    const desc    = [
      `Matter: ${ev.matterName}`,
      ev.caseNumber ? `Case No.: ${ev.caseNumber}` : '',
      `Proceeding Type: ${et.label||ev.type}`,
      '',
      'Scheduled via LexSchedule',
    ].filter(Boolean).join('\\n');
    const dtStart = ICS._fmt(slot.date, slot.startTime);
    const dtEnd   = ICS._fmt(slot.date, ev.confirmedEndTime || slot.endTime);
    const uid     = `${ev.id}-${slot.id}@lexschedule`;
    const now     = new Date().toISOString().replace(/[-:.]/g,'').slice(0,15) + 'Z';
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//LexSchedule//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART;TZID=America/New_York:${dtStart}`,
      `DTEND;TZID=America/New_York:${dtEnd}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${desc}`,
      (ev.location==='phone'&&ev.phoneNumber) ? `LOCATION:${ev.phoneNumber}${ev.locationDetails?' — '+ev.locationDetails:''}` : ev.locationDetails ? `LOCATION:${ev.locationDetails}` : '',
      `ORGANIZER;CN=${S.user?.name||'LexSchedule'}:mailto:${S.user?.email||'scheduling@lexschedule.com'}`,
      'STATUS:CONFIRMED',
      'SEQUENCE:0',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');
  },
  googleCalUrl(ev, slot) {
    const et      = EVENT_TYPES[ev.type] || {};
    const title   = encodeURIComponent(`${et.label||ev.type}: ${ev.matterName}`);
    const dtStart = ICS._fmt(slot.date, slot.startTime);
    const dtEnd   = ICS._fmt(slot.date, ev.confirmedEndTime || slot.endTime);
    const details = encodeURIComponent(`Proceeding Type: ${et.label||ev.type}\nCase No.: ${ev.caseNumber||'N/A'}\nScheduled via LexSchedule`);
    const loc     = encodeURIComponent(ev.locationDetails||'');
    return `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dtStart}/${dtEnd}&details=${details}&location=${loc}`;
  },
  outlookUrl(ev, slot) {
    const et       = EVENT_TYPES[ev.type] || {};
    const subject  = encodeURIComponent(`${et.label||ev.type}: ${ev.matterName}`);
    const body     = encodeURIComponent(`Proceeding Type: ${et.label||ev.type}\r\nCase No.: ${ev.caseNumber||'N/A'}\r\nScheduled via LexSchedule`);
    const loc      = encodeURIComponent(ev.locationDetails||'');
    const [y,m,d]  = slot.date.split('-');
    const startISO = `${y}-${m}-${d}T${slot.startTime}:00`;
    const endISO   = `${y}-${m}-${d}T${ev.confirmedEndTime || slot.endTime}:00`;
    return `https://outlook.live.com/calendar/0/deeplink/compose?subject=${subject}&startdt=${startISO}&enddt=${endISO}&body=${body}&location=${loc}`;
  },
  download(ev, slot) {
    const content = ICS.generate(ev, slot);
    const blob    = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement('a');
    a.href        = url;
    a.download    = `lexschedule_${ev.matterName.replace(/[^a-z0-9]/gi,'_').toLowerCase()}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
window.ICS = ICS;

/* ── EmailJS Config ────────────────────────────────────── */
// Paste your EmailJS credentials here after signing up at emailjs.com
// Or use the Settings page in the app (gear icon) to enter them without editing code.
const EMAILJS_CONFIG = (() => {
  const saved = (() => { try { return JSON.parse(localStorage.getItem('ejs_config')||'{}'); } catch(e){return{};} })();
  return {
    get publicKey()    { return saved.publicKey    || ''; },
    get serviceId()    { return saved.serviceId    || ''; },
    get templateInvitation()  { return saved.templateInvitation  || ''; },
    get templateReminder()    { return saved.templateReminder    || ''; },
    get templateConfirmation(){ return saved.templateConfirmation|| ''; },
    get templateNoMatch()     { return saved.templateNoMatch     || ''; },
    get templateWaitlist()    { return saved.templateWaitlist    || 'template_6wlskjg'; },
    isConfigured() {
      return !!(this.publicKey && this.serviceId && this.templateInvitation);
    }
  };
})();

window.EJS_saveConfig = function() {
  const fields = ['publicKey','serviceId','templateInvitation','templateReminder','templateConfirmation','templateNoMatch','templateWaitlist'];
  const cfg = {};
  fields.forEach(f => { cfg[f] = (document.getElementById('ejs_'+f)||{}).value?.trim()||''; });
  localStorage.setItem('ejs_config', JSON.stringify(cfg));
  // Re-init EmailJS with new key
  if (cfg.publicKey && typeof emailjs !== 'undefined') emailjs.init({ publicKey: cfg.publicKey });
  toast('Email settings saved. Sending a test invitation will confirm they work.', 'success', 5000);
  modal.close();
};

// Initialize EmailJS on load if already configured
(function initEmailJS() {
  if (typeof emailjs !== 'undefined') {
    const cfg = (() => { try { return JSON.parse(localStorage.getItem('ejs_config')||'{}'); } catch(e){return{};} })();
    if (cfg.publicKey) emailjs.init({ publicKey: cfg.publicKey });
  }
})();

/* ── Email ─────────────────────────────────────────────── */
const EMAIL = {
  log(eventId, to, subject, type) {
    const ev = S.events.find(e=>e.id===eventId);
    if (!ev) return;
    ev.emailLog.push({ ts: Date.now(), to, subject, type });
    STORE.save();
  },

  // Internal: send one email via EmailJS or fall back to simulation
  _send(templateId, params, recipientName, recipientEmail) {
    const cfg = (() => { try { return JSON.parse(localStorage.getItem('ejs_config')||'{}'); } catch(e){return{};} })();
    const ready = cfg.publicKey && cfg.serviceId && templateId;
    if (!ready || typeof emailjs === 'undefined') {
      // Simulation mode — no credentials configured yet
      console.log('[EMAIL SIM]', params.subject, '->', recipientEmail);
      return Promise.resolve({ status: 'simulated' });
    }
    return emailjs.send(cfg.serviceId, templateId, params)
      .catch(err => {
        console.error('[EmailJS error]', err);
        toast(`Email delivery error for ${recipientName}: ${err.text||err.message||'Unknown error'}`, 'error', 6000);
      });
  },

  // Build HTML for proposed slots — card rows with date left, time right
  _slotsHtml(ev) {
    if (ev.mode === 'poll') {
      const dates  = POLL.uniqueDates(ev.proposedSlots);
      const start  = fmtDate(dates[0]);
      const end    = fmtDate(dates[dates.length - 1]);
      const blocks = [...new Set(ev.proposedSlots.map(s => s.block))];
      const label  = blocks.length === 2 ? 'Morning &amp; Afternoon'
        : blocks[0] === 'AM' ? 'Morning (9:00 AM – 12:00 PM)'
        : 'Afternoon (12:00 PM – 6:00 PM)';
      return `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #EDE6D9;border-radius:6px;background:#ffffff;"><tr><td style="padding:10px 14px;font-size:13px;color:#374151;">Please indicate your availability between <strong>${start}</strong> and <strong>${end}</strong> (${label}).</td></tr></table>`;
    }
    return ev.proposedSlots.map(s =>
      `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:5px;border:1px solid #EDE6D9;border-radius:6px;background:#ffffff;">` +
      `<tr><td style="padding:9px 14px;font-size:13px;font-weight:600;color:#0B1F3A;">${fmtDate(s.date)}</td>` +
      `<td style="padding:9px 14px;font-size:12px;color:#6B7280;text-align:right;white-space:nowrap;">${fmtTime(s.startTime)} – ${fmtTime(s.endTime)}</td></tr>` +
      `</table>`
    ).join('');
  },

  // Build the Apple Calendar ICS download URL for a confirmed event.
  // Points to cal.html — a real file served directly by GitHub Pages.
  _appleCalUrl(eventId) {
    const base = window.location.href.split('?')[0].split('#')[0];
    const dir  = base.endsWith('/') ? base : base.substring(0, base.lastIndexOf('/') + 1);
    const firmId = _firmId();
    return `${dir}cal.html?e=${eventId}&f=${firmId}`;
  },

  // Build the respond URL for a participant token.
  // Points to respond.html — a real file GitHub Pages serves directly,
  // with no dependency on hash routing, Firebase timing, or inline scripts.
  _respondUrl(token, eventId) {
    const base = window.location.href.split('?')[0].split('#')[0];
    const dir  = base.endsWith('/') ? base : base.substring(0, base.lastIndexOf('/') + 1);
    const firmId = _firmId();
    return `${dir}respond.html?t=${token}&e=${eventId}&f=${firmId}`;
  },

  sendInvitations(eventId) {
    const ev = S.events.find(e=>e.id===eventId);
    if (!ev) return;
    const cfg = (() => { try { return JSON.parse(localStorage.getItem('ejs_config')||'{}'); } catch(e){return{};} })();
    const et = EVENT_TYPES[ev.type] || {};
    const deadline = ev.deadline ? fmtDate(new Date(ev.deadline).toISOString().slice(0,10)) : 'As soon as possible';
    const slotsText = EMAIL._slotsHtml(ev);
    ev.participants.forEach(p => {
      const subj = `Scheduling Invitation: ${ev.matterName}`;
      const respondUrl = EMAIL._respondUrl(p.token, ev.id);
      EMAIL._send(cfg.templateInvitation, {
        to_email:      p.email,
        to_name:       p.name,
        subject:       subj,
        matter_name:   ev.matterName,
        case_number:   ev.caseNumber || 'N/A',
        event_type:    et.label || ev.type,
        deadline:      deadline,
        proposed_slots: slotsText,
        respond_url:   respondUrl,
        firm_name:     S.user?.firm || 'LexSchedule',
        firm_address:  S.user?.firmAddress || '',
        firm_fax:      S.user?.firmFax || '',
        sender_name:   S.user?.name || 'LexSchedule',
        sender_phone:  ev.schedulerPhone || '',
      }, p.name, p.email);
      EMAIL.log(eventId, p.email, subj, 'invitation');
      toast(`Invitation sent to ${p.name} (${p.email})`, 'email', 5000);
    });
    EMAIL.addHistory(eventId, `Scheduling invitations sent to ${ev.participants.length} participant(s)`);
  },

  sendReminder(eventId, participantId) {
    const ev = S.events.find(e=>e.id===eventId);
    const p  = ev?.participants.find(x=>x.id===participantId);
    if (!ev || !p) return;
    const cfg = (() => { try { return JSON.parse(localStorage.getItem('ejs_config')||'{}'); } catch(e){return{};} })();
    const et   = EVENT_TYPES[ev.type] || {};
    const subj = `Reminder: Please Respond — ${ev.matterName}`;
    const respondUrl = EMAIL._respondUrl(p.token, ev.id);
    EMAIL._send(cfg.templateReminder || cfg.templateInvitation, {
      to_email:    p.email,
      to_name:     p.name,
      subject:     subj,
      matter_name: ev.matterName,
      event_type:  et.label || ev.type,
      respond_url: respondUrl,
      firm_name:    S.user?.firm || 'LexSchedule',
      firm_address: S.user?.firmAddress || '',
      firm_fax:     S.user?.firmFax || '',
      sender_name:  S.user?.name || 'LexSchedule',
      sender_phone: ev.schedulerPhone || '',
    }, p.name, p.email);
    EMAIL.log(eventId, p.email, subj, 'reminder');
    EMAIL.addHistory(eventId, `Reminder sent to ${p.name}`);
    toast(`Reminder sent to ${p.name}`, 'email');
  },

  sendReminderAll(eventId) {
    const ev = S.events.find(e=>e.id===eventId);
    if (!ev) return;
    const pending = ev.participants.filter(p=>p.status==='pending');
    pending.forEach(p => EMAIL.sendReminder(eventId, p.id));
    EMAIL.addHistory(eventId, `Reminders sent to ${pending.length} pending participant(s)`);
    toast(`Reminders sent to ${pending.length} participant(s)`, 'email');
  },

  sendConfirmation(eventId) {
    const ev = S.events.find(e=>e.id===eventId);
    if (!ev || !ev.confirmedSlot) return;
    const cfg  = (() => { try { return JSON.parse(localStorage.getItem('ejs_config')||'{}'); } catch(e){return{};} })();
    const slot = ev.proposedSlots.find(s=>s.id===ev.confirmedSlot);
    const subj = `Confirmed: ${ev.matterName} \u2014 ${fmtDateShort(slot?.date||'')}`;
    const et         = EVENT_TYPES[ev.type] || {};
    const googleUrl  = slot ? ICS.googleCalUrl(ev, slot) : '';
    const outlookUrl = slot ? ICS.outlookUrl(ev, slot) : '';
    const appleCalUrl = slot ? EMAIL._appleCalUrl(ev.id) : '';
    ev.participants.forEach(p => {
      EMAIL._send(cfg.templateConfirmation || cfg.templateInvitation, {
        to_email:        p.email,
        to_name:         p.name,
        subject:         subj,
        matter_name:     ev.matterName,
        event_type:      et.label || ev.type,
        confirmed_date:  slot ? fmtDate(slot.date) : 'To Be Confirmed',
        confirmed_time:  slot ? `${fmtTime(slot.startTime)} \u2013 ${fmtTime(ev.confirmedEndTime || slot.endTime)} Eastern` : '',
        location:        ev.location==='phone'&&ev.phoneNumber ? `📞 ${ev.phoneNumber}${ev.locationDetails?' — '+ev.locationDetails:''}` : ev.locationDetails || 'To be provided',
        firm_name:       S.user?.firm || 'LexSchedule',
        firm_address:    S.user?.firmAddress || '',
        firm_fax:        S.user?.firmFax || '',
        sender_name:     S.user?.name || 'LexSchedule',
        sender_phone:    ev.schedulerPhone || '',
        google_cal_url:  googleUrl,
        outlook_cal_url: outlookUrl,
        apple_cal_url:   appleCalUrl,
      }, p.name, p.email);
      EMAIL.log(eventId, p.email, subj, 'confirmation');
      toast(`Confirmation sent to ${p.name}`, 'email', 4000);
    });
    EMAIL.addHistory(eventId, `Confirmation emails sent to all ${ev.participants.length} participant(s)`);
  },

  sendNoMatch(eventId) {
    const ev = S.events.find(e=>e.id===eventId);
    if (!ev) return;
    const cfg = (() => { try { return JSON.parse(localStorage.getItem('ejs_config')||'{}'); } catch(e){return{};} })();
    const et   = EVENT_TYPES[ev.type] || {};
    const subj = `No Mutual Availability Found \u2014 New Scheduling Process Initiated: ${ev.matterName}`;
    ev.participants.forEach(p => {
      EMAIL._send(cfg.templateNoMatch || cfg.templateInvitation, {
        to_email:    p.email,
        to_name:     p.name,
        subject:     subj,
        matter_name: ev.matterName,
        event_type:  et.label || ev.type,
        firm_name:    S.user?.firm || 'LexSchedule',
        firm_address: S.user?.firmAddress || '',
        firm_fax:     S.user?.firmFax || '',
        sender_name:  S.user?.name || 'LexSchedule',
        sender_phone: ev.schedulerPhone || '',
      }, p.name, p.email);
      EMAIL.log(eventId, p.email, subj, 'no-match');
      toast(`No-match notice sent to ${p.name}`, 'warning', 4000);
    });
    EMAIL.addHistory(eventId, 'No mutual availability detected \u2014 no-match notifications sent to all parties');
  },
  addHistory(eventId, action) {
    const ev = S.events.find(e=>e.id===eventId);
    if (!ev) return;
    ev.history = ev.history || [];
    ev.history.push({ ts: Date.now(), action, user: S.user?.name || 'System' });
    STORE.save();
  },
  previewModal(eventId, type) {
    const ev = S.events.find(e=>e.id===eventId);
    if (!ev) return;
    const slot = ev.confirmedSlot ? ev.proposedSlots.find(s=>s.id===ev.confirmedSlot) : ev.proposedSlots[0];
    const et   = EVENT_TYPES[ev.type] || {};
    const bodies = {
      invitation: (() => {
        const isPoll = ev.mode === 'poll';
        const pollDates = isPoll ? POLL.uniqueDates(ev.proposedSlots) : [];
        const pollBlocks = isPoll ? [...new Set(ev.proposedSlots.map(s => s.block))] : [];
        const pollBlockLabel = pollBlocks.length === 2 ? 'Morning &amp; Afternoon'
          : pollBlocks[0] === 'AM' ? 'Morning (9:00 AM – 12:00 PM)'
          : 'Afternoon (12:00 PM – 6:00 PM)';
        const pollDateRange = isPoll
          ? `${fmtDate(pollDates[0])} – ${fmtDate(pollDates[pollDates.length - 1])}`
          : '';
        return `<p>Dear Participant,</p>
        <p>You are cordially invited to participate in scheduling the following legal proceeding.</p>
        <div class="email-preview-details">
          <div class="email-preview-detail-row"><span class="email-preview-detail-label">Matter:</span><span class="email-preview-detail-value">${esc(ev.matterName)}</span></div>
          <div class="email-preview-detail-row"><span class="email-preview-detail-label">Proceeding Type:</span><span class="email-preview-detail-value">${et.label||''}</span></div>
          <div class="email-preview-detail-row"><span class="email-preview-detail-label">Case No.:</span><span class="email-preview-detail-value">${esc(ev.caseNumber||'N/A')}</span></div>
          ${isPoll
            ? `<div class="email-preview-detail-row"><span class="email-preview-detail-label">Availability Window:</span><span class="email-preview-detail-value">${pollDateRange}</span></div>
               <div class="email-preview-detail-row"><span class="email-preview-detail-label">Time Blocks:</span><span class="email-preview-detail-value">${pollBlockLabel}</span></div>`
            : `<div class="email-preview-detail-row"><span class="email-preview-detail-label">Proposed Dates:</span><span class="email-preview-detail-value">${ev.proposedSlots.map(s=>`${fmtDate(s.date)} ${fmtTime(s.startTime)}–${fmtTime(s.endTime)}`).join('<br>')}</span></div>`}
          <div class="email-preview-detail-row"><span class="email-preview-detail-label">Response Deadline:</span><span class="email-preview-detail-value">${ev.deadline ? fmtDate(new Date(ev.deadline).toISOString().slice(0,10)) : 'As Soon As Possible'}</span></div>
        </div>
        ${isPoll
          ? `<p>Please click the button below to open your personal availability grid and mark the half-hour blocks when you are free during this window.</p>`
          : `<p>Please indicate your availability by clicking the button below. Your prompt response is greatly appreciated.</p>`}
        <div class="email-preview-cta"><a class="email-preview-btn" href="#">${isPoll ? 'Mark My Availability' : 'Indicate My Availability'}</a></div>
        <p>If you have any questions, please contact our office.</p>`;
      })(),
      confirmation: (() => {
        const googleUrl  = slot ? ICS.googleCalUrl(ev, slot) : '';
        const outlookUrl = slot ? ICS.outlookUrl(ev, slot) : '';
        const appleUrl   = slot ? EMAIL._appleCalUrl(ev.id) : '';
        return `<p>Dear Participant,</p>
        <p>We are pleased to confirm that the following proceeding has been scheduled. Please mark your calendar accordingly.</p>
        <div class="email-preview-details">
          <div class="email-preview-detail-row"><span class="email-preview-detail-label">Matter:</span><span class="email-preview-detail-value">${esc(ev.matterName)}</span></div>
          <div class="email-preview-detail-row"><span class="email-preview-detail-label">Proceeding Type:</span><span class="email-preview-detail-value">${et.label||''}</span></div>
          <div class="email-preview-detail-row"><span class="email-preview-detail-label">Confirmed Date:</span><span class="email-preview-detail-value">${slot ? fmtDate(slot.date) : 'To Be Confirmed'}</span></div>
          <div class="email-preview-detail-row"><span class="email-preview-detail-label">Time:</span><span class="email-preview-detail-value">${slot ? `${fmtTime(slot.startTime)} – ${fmtTime(ev.confirmedEndTime || slot.endTime)}` : ''} (Eastern)</span></div>
          <div class="email-preview-detail-row"><span class="email-preview-detail-label">Location:</span><span class="email-preview-detail-value">${esc(ev.location==='phone'&&ev.phoneNumber?`📞 ${ev.phoneNumber}${ev.locationDetails?' — '+ev.locationDetails:''}`:ev.locationDetails||'To be provided')}</span></div>
        </div>
        <p>Please do not hesitate to contact our office if you have any questions or require any accommodations.</p>
        ${slot ? `<div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
          <a href="${googleUrl}" target="_blank" style="display:inline-block;padding:7px 14px;background:#4285F4;color:#fff;border-radius:6px;font-size:.74rem;font-weight:600;text-decoration:none;">+ Google Calendar</a>
          <a href="${outlookUrl}" target="_blank" style="display:inline-block;padding:7px 14px;background:#0078D4;color:#fff;border-radius:6px;font-size:.74rem;font-weight:600;text-decoration:none;">+ Outlook</a>
          <a href="${appleUrl}" style="display:inline-block;padding:7px 14px;background:#555;color:#fff;border-radius:6px;font-size:.74rem;font-weight:600;text-decoration:none;">+ Apple Calendar</a>
        </div>` : ''}`;
      })(),
      'no-match': `<p>Dear Participant,</p>
        <p>After reviewing all submitted availability responses, we were unable to identify a mutually agreeable date and time for the following matter.</p>
        <div class="email-preview-details">
          <div class="email-preview-detail-row"><span class="email-preview-detail-label">Matter:</span><span class="email-preview-detail-value">${esc(ev.matterName)}</span></div>
          <div class="email-preview-detail-row"><span class="email-preview-detail-label">Proceeding Type:</span><span class="email-preview-detail-value">${et.label||''}</span></div>
        </div>
        <p>A new scheduling request will be initiated shortly with additional proposed dates. You will receive a new invitation to indicate your availability. We apologize for any inconvenience and appreciate your continued cooperation.</p>`,
    };
    modal.open(`
      <div class="modal-header" style="background:#0B1F3A;border-radius:18px 18px 0 0;">
        <h3 class="modal-title" style="color:#fff">Email Preview</h3>
        <button class="modal-close" style="background:rgba(255,255,255,.1);color:#fff;border:none" onclick="closeModal()">✕</button>
      </div>
      <div style="padding:24px;">
        <div class="email-preview">
          <div class="email-preview-header">
            <div class="email-preview-firm">${esc(S.user?.firm || 'LexSchedule')}</div>
            <div class="email-preview-tagline">Professional Legal Scheduling</div>
          </div>
          <div class="email-preview-gold-bar" style="height:3px;background:linear-gradient(90deg,#9e7e3f,#d4b87a,#9e7e3f);"></div>
          <div class="email-preview-body">${bodies[type] || bodies['invitation']}</div>
          <div class="email-preview-footer">
            <p>${esc(S.user?.firm || 'LexSchedule')}</p>
            ${S.user?.firmAddress ? `<p style="margin-top:4px;font-size:.72rem;">${esc(S.user.firmAddress)}</p>` : ''}
            ${S.user?.phone ? `<p style="margin-top:4px;font-size:.72rem;">Tel: ${esc(S.user.phone)}</p>` : ''}
            ${S.user?.firmFax ? `<p style="margin-top:4px;font-size:.72rem;">Fax: ${esc(S.user.firmFax)}</p>` : ''}
            <p style="margin-top:8px;font-size:.65rem;">This communication is intended solely for the designated recipient and may contain privileged or confidential information.</p>
          </div>
        </div>
      </div>
      <div class="modal-footer"><button class="btn btn-primary" onclick="closeModal()">Close Preview</button></div>
    `);
  }
};

/* ── Availability Logic ────────────────────────────────── */
const AVAIL = {
  score(event, slotId) {
    const responded = event.participants.filter(p => p.status !== 'pending' && p.availability[slotId]);
    if (!responded.length) return { available:0, total:0, pct:0 };
    const available = responded.filter(p => p.availability[slotId] === 'available').length;
    return { available, total:responded.length, pct: Math.round(available/responded.length*100) };
  },
  bestSlots(event) {
    return event.proposedSlots.map(s => ({ ...s, score: AVAIL.score(event, s.id) }))
      .sort((a,b) => b.score.available - a.score.available || b.score.pct - a.score.pct);
  },
  allResponded(event) {
    return event.participants.every(p => p.status !== 'pending');
  },
  checkAutoConfirm(eventId) {
    const ev = S.events.find(e=>e.id===eventId);
    if (!ev || ev.confirmedSlot || ev.status==='confirmed') return;
    if (ev.mode === 'poll') {
      // Poll mode: just notify scheduler; they confirm from the event detail grid
      if (POLL.allResponded(ev)) {
        const matches = POLL.matchSlots(ev);
        if (matches.length) {
          toast(`All participants responded. ${matches.length} available time slot${matches.length>1?'s':''} found — review and confirm.`, 'success', 7000);
        } else {
          toast('All participants responded, but no single slot works for everyone. Review the availability grid and schedule anyway if needed.', 'warning', 8000);
        }
      }
      return;
    }
    if (!AVAIL.allResponded(ev)) return;
    const best = AVAIL.bestSlots(ev);
    if (best[0] && best[0].score.available === ev.participants.filter(p=>p.status!=='pending').length) {
      // All available on best slot — could auto-confirm
      toast(`All parties available on ${fmtDateShort(best[0].date)}! Review and confirm the date.`, 'success', 6000);
    } else if (best.every(s => s.score.available === 0)) {
      // No match
      ev.status = 'no-match';
      EMAIL.sendNoMatch(eventId);
      STORE.save();
      toast('No mutual availability found. Notifications sent. You may restart the process.', 'warning', 7000);
    }
  }
};

/* ── Poll Mode Logic ────────────────────────────────────── */
const POLL = {
  BLOCKS: [
    { id:'AM', label:'Morning',   short:'9a–12p', start:'09:00', end:'12:00' },
    { id:'PM', label:'Afternoon', short:'12p–6p', start:'12:00', end:'18:00' },
  ],

  // Generate half-hour time strings within a block (e.g. ['09:00','09:30',...,'11:30'])
  halfHours(block) {
    const times = [];
    let [h, m] = block.start.split(':').map(Number);
    const [eh, em] = block.end.split(':').map(Number);
    while (h * 60 + m < eh * 60 + em) {
      times.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
      m += 30; if (m >= 60) { h++; m = 0; }
    }
    return times;
  },

  // Format "13:00" → "1:00 PM"
  fmtTime(t) {
    const [h, m] = t.split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h < 12 ? 'AM' : 'PM'}`;
  },

  // Generate one slot per half-hour per date for the selected blocks
  slotsFromRange(startDate, endDate, weekdaysOnly=true, blocks=['AM','PM']) {
    const slots = [];
    const d   = new Date(startDate + 'T12:00:00');
    const end = new Date(endDate   + 'T12:00:00');
    while (d <= end) {
      const dow = d.getDay();
      if (!weekdaysOnly || (dow >= 1 && dow <= 5)) {
        const ds = d.toISOString().slice(0,10);
        for (const blk of POLL.BLOCKS.filter(b => blocks.includes(b.id))) {
          for (const time of POLL.halfHours(blk)) {
            const [th, tm] = time.split(':').map(Number);
            const endMins = th * 60 + tm + 30;
            const endTime = `${String(Math.floor(endMins/60)).padStart(2,'0')}:${String(endMins%60).padStart(2,'0')}`;
            slots.push({ id:`poll-${ds}-${time.replace(':','')}`, date:ds, block:blk.id, startTime:time, endTime });
          }
        }
      }
      d.setDate(d.getDate() + 1);
    }
    return slots;
  },

  uniqueDates(slots) {
    return [...new Set(slots.map(s => s.date))].sort();
  },

  // Map: date → startTime → slot
  slotsByDate(slots) {
    const map = {};
    for (const s of slots) {
      if (!map[s.date]) map[s.date] = {};
      map[s.date][s.startTime] = s;
    }
    return map;
  },

  slotSummary(ev, slotId) {
    const responded = ev.participants.filter(p => p.status !== 'pending').length;
    const available = ev.participants.filter(p => (p.availability||{})[slotId] === 'available').length;
    return { total: ev.participants.length, responded, available };
  },

  matchSlots(ev) {
    const responded = ev.participants.filter(p => p.status !== 'pending');
    if (!responded.length) return [];
    return (ev.proposedSlots||[]).filter(s => responded.every(p => (p.availability||{})[s.id] === 'available'));
  },

  allResponded(ev) { return ev.participants.every(p => p.status !== 'pending'); },

  // Render the availability grid (time rows × date columns)
  renderGrid(ev, opts={}) {
    const { token, isAdmin } = opts;
    const dates     = POLL.uniqueDates(ev.proposedSlots);
    const byDate    = POLL.slotsByDate(ev.proposedSlots);
    const matches   = new Set(POLL.matchSlots(ev).map(s => s.id));
    const participant = token ? ev.participants.find(p => p.token === token) : null;
    const rs = (token && window._respondState?.[token]) ? window._respondState[token] : {};

    const dateFmt = d => {
      const dt = new Date(d + 'T12:00:00');
      return { day: dt.toLocaleDateString('en-US',{weekday:'short'}), date: dt.toLocaleDateString('en-US',{month:'short',day:'numeric'}) };
    };

    // Admin summary cell: count, clickable to select / show detail
    const adminCell = (slot) => {
      const s = POLL.slotSummary(ev, slot.id);
      const isMatch = matches.has(slot.id);
      const bg  = s.responded === 0 ? '#F9FAFB' : s.available === 0 ? '#FEE2E2' : isMatch ? '#DCFCE7' : '#FEF3C7';
      const txt = s.responded === 0 ? '#D1D5DB' : s.available === 0 ? '#B91C1C' : isMatch ? '#166534' : '#92400E';
      const bdr = isMatch ? '2px solid #16A34A' : '1px solid #E5E7EB';
      return `<td style="padding:0;border:1px solid #E5E7EB;">
        <button id="pollac-${slot.id}" onclick="POLL_selectCell('${ev.id}','${slot.id}')" title="Click to select; click again to view / confirm"
          style="width:100%;height:34px;border:${bdr};cursor:pointer;background:${bg};transition:all .1s;display:flex;align-items:center;justify-content:center;gap:3px;font-family:'Montserrat',sans-serif;"
          onmouseover="this.style.filter='brightness(.92)'" onmouseout="this.style.filter=''">
          <span style="font-size:.72rem;font-weight:700;color:${txt};">${s.available}/${s.responded}</span>
          ${isMatch?`<span style="font-size:.55rem;background:#166534;color:#fff;padding:1px 4px;border-radius:2px;letter-spacing:.02em;">✓</span>`:''}
        </button></td>`;
    };

    // Participant toggle cell
    const participantCell = (slot) => {
      const saved = rs[slot.id] !== undefined ? rs[slot.id] : ((participant?.availability||{})[slot.id]||'');
      const isAvail = saved === 'available';
      return `<td style="padding:2px;border:1px solid #E5E7EB;">
        <button onclick="POLL_toggleCell('${token}','${slot.id}','${ev.id}')" id="pollc-${slot.id}"
          style="width:100%;height:32px;border:${isAvail?'2px solid #6EE7B7':'1px solid #E5E7EB'};cursor:pointer;background:${isAvail?'#D1FAE5':'#F9FAFB'};border-radius:3px;transition:all .1s;display:flex;align-items:center;justify-content:center;"
          onmouseover="this.style.filter='brightness(.95)'" onmouseout="this.style.filter=''">
          <span style="font-size:.9rem;color:#065F46;font-weight:700;">${isAvail?'✓':''}</span>
        </button></td>`;
    };

    // Date header row
    const dateHeaders = dates.map(d => {
      const f = dateFmt(d);
      return `<th style="background:#0B1F3A;color:#fff;padding:6px 8px;text-align:center;font-size:.72rem;border:1px solid rgba(255,255,255,.1);min-width:68px;white-space:nowrap;">
        <span style="font-weight:700;">${f.day}</span><br><span style="opacity:.7;font-size:.6rem;">${f.date}</span></th>`;
    }).join('');

    // Build time rows grouped by block
    const usedBlockIds = [...new Set(ev.proposedSlots.map(s => s.block))];
    const blockRows = POLL.BLOCKS.filter(b => usedBlockIds.includes(b.id)).map(blk => {
      const times = [...new Set(ev.proposedSlots.filter(s => s.block === blk.id).map(s => s.startTime))].sort();
      const sectionRow = `<tr>
        <td colspan="${dates.length + 1}" style="padding:4px 10px;background:#F0F4FA;border:1px solid #E5E7EB;font-size:.63rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#0B1F3A;">${blk.label} &mdash; ${blk.short}</td>
      </tr>`;
      const timeRows = times.map(time => {
        const cells = dates.map(d => {
          const slot = byDate[d]?.[time];
          if (!slot) return `<td style="background:#F3F4F6;border:1px solid #E5E7EB;"></td>`;
          return isAdmin ? adminCell(slot) : participantCell(slot);
        }).join('');
        return `<tr>
          <td style="padding:3px 10px;background:#FAFAF8;border:1px solid #E5E7EB;white-space:nowrap;font-size:.74rem;color:#374151;font-weight:500;min-width:84px;">${POLL.fmtTime(time)}</td>
          ${cells}
        </tr>`;
      }).join('');
      return sectionRow + timeRows;
    }).join('');

    // Admin: participant status list below grid with Edit buttons
    const participantList = isAdmin ? `
      <div style="margin-top:14px;display:flex;flex-wrap:wrap;gap:8px;">
        ${ev.participants.map(par => `
          <div style="display:flex;align-items:center;gap:8px;background:#F6F1E9;border:1px solid #EDE6D9;border-radius:8px;padding:7px 12px;">
            <div>
              <div style="font-size:.8rem;font-weight:600;color:#0B1F3A;">${esc(par.name)}</div>
              <div style="font-size:.6rem;color:#9CA3AF;text-transform:uppercase;letter-spacing:.04em;">${par.status==='pending'?'Not responded':par.status}</div>
            </div>
            <button onclick="POLL_editResponse('${ev.id}','${par.id}')" style="font-size:.62rem;font-weight:700;color:#C09D5F;background:none;border:1px solid #C09D5F;border-radius:4px;padding:3px 8px;cursor:pointer;font-family:'Montserrat',sans-serif;white-space:nowrap;">Edit</button>
            <button onclick="EVENTS_editParticipantEmailModal('${ev.id}','${par.id}')" title="Edit email address" style="font-size:.62rem;font-weight:700;color:#6B7280;background:none;border:1px solid #D1D5DB;border-radius:4px;padding:3px 8px;cursor:pointer;font-family:'Montserrat',sans-serif;white-space:nowrap;">@</button>
          </div>`).join('')}
      </div>` : '';

    const selBar = isAdmin ? `
    <div id="poll-sel-bar" style="display:none;margin-top:10px;background:#0B1F3A;border-radius:10px;padding:12px 16px;display:none;align-items:center;gap:12px;box-shadow:0 2px 8px rgba(11,31,58,.2);">
      <div style="flex:1;">
        <div id="poll-sel-label" style="font-size:.68rem;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.06em;font-weight:600;"></div>
        <div id="poll-sel-time"  style="font-family:'Cormorant Garamond',serif;font-size:1.1rem;font-weight:600;color:#fff;margin-top:1px;"></div>
      </div>
      <button onclick="POLL_clearSelection('${ev.id}')" style="padding:5px 12px;border:1px solid rgba(255,255,255,.25);border-radius:6px;background:transparent;color:rgba(255,255,255,.7);font-size:.72rem;font-weight:600;cursor:pointer;font-family:'Montserrat',sans-serif;">Clear</button>
      <button onclick="POLL_scheduleSelected('${ev.id}')" style="padding:6px 16px;border:none;border-radius:6px;background:#C09D5F;color:#0B1F3A;font-size:.78rem;font-weight:700;cursor:pointer;font-family:'Montserrat',sans-serif;letter-spacing:.02em;">Schedule →</button>
    </div>` : '';

    return `
    <div style="overflow-x:auto;border-radius:10px;border:1px solid #E5E7EB;box-shadow:0 1px 4px rgba(11,31,58,.06);">
      <table style="border-collapse:collapse;min-width:100%;">
        <thead>
          <tr>
            <th style="background:#0B1F3A;color:#C09D5F;padding:8px 10px;text-align:left;font-size:.62rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;border:1px solid rgba(255,255,255,.1);min-width:84px;">Time</th>
            ${dateHeaders}
          </tr>
        </thead>
        <tbody>${blockRows}</tbody>
      </table>
    </div>
    ${selBar}
    ${participantList}`;
  },
};

/* ── Event Actions ─────────────────────────────────────── */
const EVENTS = {
  confirm(eventId, slotId, endTimeOverride=null) {
    const ev   = S.events.find(e=>e.id===eventId);
    if (!ev) return;
    ev.confirmedSlot    = slotId;
    ev.confirmedEndTime = endTimeOverride || null; // null = use slot's own endTime
    ev.status = 'confirmed';
    EMAIL.sendConfirmation(eventId);
    STORE.save();
    const slot = ev.proposedSlots.find(s=>s.id===slotId);
    if (slot) ICS.download(ev, slot);
    toast('Meeting confirmed! Confirmation emails sent and calendar invite downloaded.', 'success', 6000);
    VIEWS.eventDetail(eventId);
  },
  archiveExpired() {
    const today = new Date(); today.setHours(0,0,0,0);
    let changed = false;
    S.events.forEach(ev => {
      if (ev.status === 'archived' || ev.status === 'draft') return;
      const slotDate = s => new Date(s.date + 'T23:59:59');
      if (ev.status === 'confirmed' && ev.confirmedSlot) {
        const slot = ev.proposedSlots.find(s => s.id === ev.confirmedSlot);
        if (slot && slotDate(slot) < today) {
          ev.archivedStatus = 'confirmed'; ev.archivedAt = Date.now(); ev.status = 'archived';
          EMAIL.addHistory(ev.id, 'Event moved to history \u2014 meeting date has passed');
          changed = true;
        }
      } else if (ev.status === 'no-match') {
        const allPast = ev.proposedSlots.length > 0 && ev.proposedSlots.every(s => slotDate(s) < today);
        const dlPast  = ev.deadline && ev.deadline < Date.now();
        if (allPast || dlPast) {
          ev.archivedStatus = 'no-match'; ev.archivedAt = Date.now(); ev.status = 'archived';
          EMAIL.addHistory(ev.id, 'Event moved to history \u2014 no match found and dates have passed');
          changed = true;
        }
      } else if (ev.status === 'active') {
        const allPast = ev.proposedSlots.length > 0 && ev.proposedSlots.every(s => slotDate(s) < today);
        if (allPast) {
          ev.archivedStatus = 'active'; ev.archivedAt = Date.now(); ev.status = 'archived';
          EMAIL.addHistory(ev.id, 'Event moved to history \u2014 all proposed dates have passed without confirmation');
          changed = true;
        }
      }
    });
    if (changed) STORE.save();
  },

  restart(eventId) {
    const ev = S.events.find(e=>e.id===eventId);
    if (!ev) return;
    ev.status = 'draft';
    ev.confirmedSlot = null;
    ev.participants.forEach(p => { p.status='pending'; p.availability={}; });
    ev.proposedSlots = [];
    EMAIL.addHistory(eventId, 'Scheduling process restarted — availability cleared');
    STORE.save();
    toast('Process restarted. Please add new proposed dates and re-send invitations.', 'info', 5000);
    ROUTER.go(`/event/${eventId}`);
  },
  deleteConfirmed(eventId) {
    const password = document.getElementById('del-password')?.value;
    const errEl    = document.getElementById('del-error');
    if (!password) {
      errEl.style.display = 'block';
      errEl.textContent   = 'Please enter your password.';
      return;
    }
    const fbUser = fbAuth.currentUser;
    if (!fbUser) { errEl.style.display='block'; errEl.textContent='Session expired. Please log in again.'; return; }
    const credential = firebase.auth.EmailAuthProvider.credential(fbUser.email, password);
    fbUser.reauthenticateWithCredential(credential).then(() => {
      const ev = S.events.find(e=>e.id===eventId);
      const name = ev?.matterName || 'event';
      S.events = S.events.filter(e => e.id !== eventId);
      STORE.deleteEvent(eventId);
      modal.close();
      toast(`"${name}" has been permanently deleted.`, 'success', 5000);
      ROUTER.go('/dashboard');
    }).catch(() => {
      errEl.style.display = 'block';
      errEl.textContent   = 'Incorrect password. Please try again.';
      document.getElementById('del-password').value = '';
      document.getElementById('del-password').focus();
    });
  },

  setManualAvailability(eventId, participantId, slotId, value) {
    const ev = S.events.find(e=>e.id===eventId);
    const p  = ev?.participants.find(x=>x.id===participantId);
    if (!ev || !p) return;
    if (value === '') { delete p.availability[slotId]; }
    else { p.availability[slotId] = value; }
    p.status = 'manually-entered';
    STORE.save();
    AVAIL.checkAutoConfirm(eventId);
  },
  delete(eventId) {
    S.events = S.events.filter(e=>e.id!==eventId);
    STORE.deleteEvent(eventId);
    toast('Event deleted.', 'info');
    ROUTER.go('/dashboard');
  },
};

/* ── Auth ──────────────────────────────────────────────── */
const AUTH = {
  async login(email, pass) {
    try {
      const cred = await fbAuth.signInWithEmailAndPassword(email, pass);
      const doc = await db.collection('userProfiles').doc(cred.user.uid).get();
      if (!doc.exists) { await fbAuth.signOut(); return false; }
      S.user = doc.data();
      await STORE.load();
      return true;
    } catch(e) {
      console.error(e);
      return false;
    }
  },
  async register(data) {
    try {
      const cred = await fbAuth.createUserWithEmailAndPassword(data.email, data.password);
      const profile = {
        id: cred.user.uid,
        name: data.name, email: data.email, phone: data.phone || '',
        role: data.role, roleType: data.roleType,
        assistantFor: data.assistantFor || '',
        barNumber: data.barNumber || '', firm: data.firm || '',
        firmAddress: '', firmFax: '',
        createdAt: Date.now()
      };
      await db.collection('userProfiles').doc(cred.user.uid).set(profile);
      S.user = profile;
      await STORE.load();
      return 'ok';
    } catch(e) {
      if (e.code === 'auth/email-already-in-use') return 'email-exists';
      console.error(e);
      return 'error';
    }
  },
  async logout() {
    S.user = null; S.pendingVerify = null; S.events = [];
    await fbAuth.signOut();
    ROUTER.go('/');
  }
};

/* ── Header ────────────────────────────────────────────── */
const HEADER = () => `
<header style="height:68px;background:#0B1F3A;display:flex;align-items:center;padding:0 28px;position:fixed;top:0;left:0;right:0;z-index:100;box-shadow:0 4px 24px rgba(11,31,58,.5);overflow:hidden;">

  <!-- Diagonal hatch texture -->
  <div style="position:absolute;inset:0;pointer-events:none;opacity:.035;background-image:repeating-linear-gradient(45deg,#C09D5F 0,#C09D5F 1px,transparent 0,transparent 50%);background-size:14px 14px;"></div>

  <!-- Right-side radial gold glow -->
  <div style="position:absolute;right:-80px;top:50%;transform:translateY(-50%);width:420px;height:420px;background:radial-gradient(circle,rgba(192,157,95,.11) 0%,rgba(192,157,95,.04) 40%,transparent 68%);border-radius:50%;pointer-events:none;"></div>

  <!-- Secondary glow, further right -->
  <div style="position:absolute;right:120px;top:50%;transform:translateY(-50%);width:180px;height:180px;background:radial-gradient(circle,rgba(192,157,95,.06) 0%,transparent 70%);border-radius:50%;pointer-events:none;"></div>

  <!-- Gold bottom accent line -->
  <div style="position:absolute;bottom:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent 0%,#9e7e3f 12%,#d4b87a 40%,#C09D5F 50%,#d4b87a 60%,#9e7e3f 88%,transparent 100%);pointer-events:none;"></div>

  <!-- Centered decorative tagline -->
  <div style="position:absolute;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:12px;pointer-events:none;white-space:nowrap;">
    <div style="width:36px;height:1px;background:linear-gradient(90deg,transparent,rgba(192,157,95,.45));"></div>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="13" height="13" style="opacity:.4;flex-shrink:0;">
      <line x1="12" y1="3" x2="12" y2="17" stroke="#C09D5F" stroke-width="1.6" stroke-linecap="round"/>
      <line x1="4" y1="8" x2="20" y2="8" stroke="#C09D5F" stroke-width="1.6" stroke-linecap="round"/>
      <line x1="5" y1="8" x2="5" y2="12" stroke="#C09D5F" stroke-width="1.2" stroke-linecap="round"/>
      <line x1="19" y1="8" x2="19" y2="12" stroke="#C09D5F" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M3 12 Q5 15.5 7 12" stroke="#C09D5F" stroke-width="1.3" fill="rgba(192,157,95,.2)" stroke-linecap="round"/>
      <path d="M17 12 Q19 15.5 21 12" stroke="#C09D5F" stroke-width="1.3" fill="rgba(192,157,95,.2)" stroke-linecap="round"/>
      <line x1="9" y1="17" x2="15" y2="17" stroke="#C09D5F" stroke-width="1.4" stroke-linecap="round"/>
    </svg>
    <span style="font-size:.56rem;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:rgba(192,157,95,.38);font-family:'Montserrat',sans-serif;">Professional Legal Scheduling</span>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="13" height="13" style="opacity:.4;flex-shrink:0;">
      <line x1="12" y1="3" x2="12" y2="17" stroke="#C09D5F" stroke-width="1.6" stroke-linecap="round"/>
      <line x1="4" y1="8" x2="20" y2="8" stroke="#C09D5F" stroke-width="1.6" stroke-linecap="round"/>
      <line x1="5" y1="8" x2="5" y2="12" stroke="#C09D5F" stroke-width="1.2" stroke-linecap="round"/>
      <line x1="19" y1="8" x2="19" y2="12" stroke="#C09D5F" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M3 12 Q5 15.5 7 12" stroke="#C09D5F" stroke-width="1.3" fill="rgba(192,157,95,.2)" stroke-linecap="round"/>
      <path d="M17 12 Q19 15.5 21 12" stroke="#C09D5F" stroke-width="1.3" fill="rgba(192,157,95,.2)" stroke-linecap="round"/>
      <line x1="9" y1="17" x2="15" y2="17" stroke="#C09D5F" stroke-width="1.4" stroke-linecap="round"/>
    </svg>
    <div style="width:36px;height:1px;background:linear-gradient(90deg,rgba(192,157,95,.45),transparent);"></div>
  </div>

  <!-- Logo -->
  <div style="display:flex;align-items:center;gap:14px;cursor:pointer;flex-shrink:0;position:relative;z-index:1;" onclick="location.hash='/dashboard'">
    <div style="width:40px;height:40px;border:2px solid #C09D5F;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px rgba(192,157,95,.25);">
      ${logoSVG(22)}
    </div>
    <div style="font-family:'Cormorant Garamond',serif;font-size:1.45rem;font-weight:700;color:#fff;letter-spacing:.02em;line-height:1;">LexSchedule</div>
  </div>

  <!-- Nav -->
  <nav style="display:flex;gap:4px;margin-left:36px;position:relative;z-index:1;">
    <a onclick="location.hash='/dashboard'" style="padding:7px 14px;border-radius:7px;font-size:.76rem;font-weight:500;color:rgba(255,255,255,.7);cursor:pointer;transition:all .2s;text-decoration:none;" onmouseover="this.style.background='rgba(255,255,255,.1)';this.style.color='#fff'" onmouseout="this.style.background='';this.style.color='rgba(255,255,255,.7)'">Dashboard</a>
    <a onclick="location.hash='/new'" style="padding:7px 14px;border-radius:7px;font-size:.76rem;font-weight:500;color:rgba(255,255,255,.7);cursor:pointer;transition:all .2s;text-decoration:none;" onmouseover="this.style.background='rgba(255,255,255,.1)';this.style.color='#fff'" onmouseout="this.style.background='';this.style.color='rgba(255,255,255,.7)'">New Event</a>
  </nav>

  <!-- Right controls -->
  <div style="margin-left:auto;display:flex;align-items:center;gap:12px;position:relative;z-index:1;">
    <button onclick="location.hash='/new'" style="background:linear-gradient(135deg,#C09D5F,#d4b87a);color:#0B1F3A;border:none;padding:8px 18px;border-radius:7px;font-size:.76rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;cursor:pointer;font-family:'Montserrat',sans-serif;box-shadow:0 2px 8px rgba(192,157,95,.3);">+ New Event</button>
    <div style="display:flex;align-items:center;gap:9px;padding:5px 12px 5px 6px;border-radius:30px;background:rgba(255,255,255,.08);cursor:pointer;border:1px solid rgba(192,157,95,.15);" onclick="VIEWS.userMenu()" id="user-menu-btn">
      <div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#C09D5F,#d4b87a);color:#0B1F3A;font-family:'Cormorant Garamond',serif;font-size:.85rem;font-weight:700;display:flex;align-items:center;justify-content:center;">${initials(S.user?.name||'?')}</div>
      <div>
        <div style="font-size:.76rem;font-weight:600;color:#fff;line-height:1.1;">${esc(S.user?.name||'')}</div>
        <div style="font-size:.62rem;color:rgba(255,255,255,.55);">${S.user?.assistantFor ? `Asst. to ${esc(S.user.assistantFor)}` : esc(S.user?.role||'')}</div>
      </div>
      <span style="color:rgba(255,255,255,.4);font-size:.7rem;">▾</span>
    </div>
  </div>
</header>
<div style="height:68px;"></div>`;

/* ── Views ─────────────────────────────────────────────── */
const VIEWS = {

  /* ── Landing ── */
  landing() {
    S.view = 'landing';
    render(`
    <div style="min-height:100vh;background:#fff;">
      <!-- Nav -->
      <nav style="display:flex;align-items:center;justify-content:space-between;padding:18px 48px;background:#fff;border-bottom:1px solid #EDE6D9;position:sticky;top:0;z-index:50;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:42px;height:42px;border:2px solid #C09D5F;border-radius:50%;display:flex;align-items:center;justify-content:center;">
            ${logoSVG(24)}
          </div>
          <div style="font-family:'Cormorant Garamond',serif;font-size:1.45rem;font-weight:700;color:#0B1F3A;letter-spacing:.02em;line-height:1;">LexSchedule</div>
        </div>
        <div style="display:flex;gap:10px;">
          <button onclick="location.hash='/login'" style="padding:9px 22px;border:1.5px solid #0B1F3A;border-radius:7px;font-size:.8rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;cursor:pointer;background:transparent;color:#0B1F3A;font-family:'Montserrat',sans-serif;transition:all .2s;" onmouseover="this.style.background='#0B1F3A';this.style.color='#fff'" onmouseout="this.style.background='transparent';this.style.color='#0B1F3A'">Sign In</button>
          <button onclick="location.hash='/waitlist'" style="padding:9px 22px;border:none;border-radius:7px;font-size:.8rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;cursor:pointer;background:#C09D5F;color:#0B1F3A;font-family:'Montserrat',sans-serif;">Join the Waitlist</button>
        </div>
      </nav>
      <!-- Hero -->
      <section style="background:#0B1F3A;padding:96px 48px;position:relative;overflow:hidden;">
        <div style="position:absolute;inset:0;opacity:.04;background-image:url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22><circle cx=%2230%22 cy=%2230%22 r=%221%22 fill=%22%23C09D5F%22/></svg>');background-size:30px 30px;"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:48px;position:relative;z-index:1;max-width:1200px;">
          <div style="flex:1;min-width:0;">
            <div style="display:inline-flex;align-items:center;gap:10px;font-size:.68rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#C09D5F;margin-bottom:20px;">
              <span style="width:24px;height:1px;background:#C09D5F;display:inline-block;opacity:.5;"></span>
              Exclusively for Legal Professionals
              <span style="width:24px;height:1px;background:#C09D5F;display:inline-block;opacity:.5;"></span>
            </div>
            <h1 style="font-family:'Cormorant Garamond',serif;font-size:3.8rem;font-weight:600;color:#fff;line-height:1.06;margin-bottom:20px;">The Scheduling Platform <em style="color:#C09D5F;font-style:italic;">Built for the Law.</em></h1>
            <p style="font-size:.98rem;color:rgba(255,255,255,.68);line-height:1.75;margin-bottom:36px;max-width:560px;">Coordinate depositions, mediations, client consultations, and opposing counsel calls with precision. Automated notifications, real-time availability tracking, and professional communications — all in one place.</p>
            <div style="display:flex;gap:14px;flex-wrap:wrap;">
              <button onclick="location.hash='/waitlist'" style="padding:14px 36px;border:none;border-radius:8px;font-size:.84rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;background:#C09D5F;color:#0B1F3A;font-family:'Montserrat',sans-serif;box-shadow:0 4px 16px rgba(192,157,95,.35);">Join the Waitlist</button>
              <button onclick="location.hash='/login'" style="padding:14px 36px;border:1.5px solid rgba(255,255,255,.3);border-radius:8px;font-size:.84rem;font-weight:600;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;background:transparent;color:#fff;font-family:'Montserrat',sans-serif;">Sign In</button>
            </div>
          </div>
          <!-- Waitlist callout -->
          <div style="flex-shrink:0;width:300px;border:1px solid rgba(192,157,95,.35);border-radius:16px;padding:32px 28px;background:rgba(255,255,255,.04);backdrop-filter:blur(4px);text-align:center;">
            <div style="width:44px;height:44px;border:1.5px solid #C09D5F;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;">${logoSVG(24)}</div>
            <div style="font-size:.62rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#C09D5F;margin-bottom:10px;">Early Access</div>
            <p style="font-family:'Cormorant Garamond',serif;font-size:1.15rem;color:#fff;line-height:1.55;margin-bottom:22px;">We're currently in early testing. Join the waitlist to be the first to access.</p>
            <button onclick="location.hash='/waitlist'" style="width:100%;padding:11px 20px;border:none;border-radius:8px;font-size:.76rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;background:#C09D5F;color:#0B1F3A;font-family:'Montserrat',sans-serif;box-shadow:0 4px 12px rgba(192,157,95,.3);">Join the Waitlist</button>
          </div>
        </div>
      </section>
      <!-- Features -->
      <section style="padding:80px 48px;background:#fff;">
        <div style="text-align:center;max-width:560px;margin:0 auto 56px;">
          <div style="font-size:.68rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#9e7e3f;margin-bottom:12px;">Platform Capabilities</div>
          <h2 style="font-family:'Cormorant Garamond',serif;font-size:2.4rem;font-weight:600;color:#0B1F3A;margin-bottom:12px;">Everything a Law Firm Needs to Schedule Professionally</h2>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;max-width:1100px;margin:0 auto;">
          ${[
            ['⚖️','Legal-Specific Event Types','Schedule depositions, mediations, opposing counsel calls, client meetings, settlement conferences, and more — with terminology your team and clients expect.'],
            ['📧','Automated Professional Communications','Invitation, reminder, confirmation, and no-match notifications are sent automatically in a format befitting your firm\u2019s reputation.'],
            ['📊','Real-Time Availability Grid','A Doodle-style grid tailored for legal proceedings — see at a glance which dates work for all parties and identify the optimal time instantly.'],
            ['✍️','Manual Entry & Override','Enter availability on behalf of non-responsive parties or manually confirm any time slot — full coordinator control at every stage.'],
            ['🔄','Automatic Restart When No Match','If no common time is found, the system notifies all parties and can automatically restart the process with new proposed dates.'],
            ['🔒','Secure, Firm-Branded Experience','Every communication and interface element reflects the professionalism and discretion your clients expect from top-tier legal counsel.'],
          ].map(([icon,title,desc])=>`
            <div style="background:#fff;border:1px solid #EDE6D9;border-radius:14px;padding:28px;box-shadow:0 1px 4px rgba(11,31,58,.06);transition:all .3s;" onmouseover="this.style.boxShadow='0 8px 24px rgba(11,31,58,.1)';this.style.transform='translateY(-4px)'" onmouseout="this.style.boxShadow='0 1px 4px rgba(11,31,58,.06)';this.style.transform=''">
              <div style="width:50px;height:50px;background:#0B1F3A;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;margin-bottom:16px;">${icon}</div>
              <div style="font-family:'Cormorant Garamond',serif;font-size:1.25rem;font-weight:600;color:#0B1F3A;margin-bottom:10px;">${title}</div>
              <p style="font-size:.84rem;color:#4B5563;line-height:1.7;">${desc}</p>
            </div>
          `).join('')}
        </div>
      </section>
      <!-- CTA Banner -->
      <section style="background:#F6F1E9;padding:60px 48px;text-align:center;border-top:1px solid #EDE6D9;border-bottom:1px solid #EDE6D9;">
        <h2 style="font-family:'Cormorant Garamond',serif;font-size:2.2rem;font-weight:600;color:#0B1F3A;margin-bottom:12px;">Ready to streamline your scheduling?</h2>
        <p style="font-size:.9rem;color:#6B7280;margin-bottom:28px;">Built for attorneys and legal professionals who demand precision.</p>
        <button onclick="location.hash='/waitlist'" style="padding:14px 40px;border:none;border-radius:8px;font-size:.84rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;background:#0B1F3A;color:#fff;font-family:'Montserrat',sans-serif;box-shadow:0 4px 12px rgba(11,31,58,.2);">Join the Waitlist</button>
      </section>
      <!-- Footer -->
      <footer style="background:#0B1F3A;padding:36px 48px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;">
        <div>
          <div style="font-family:'Cormorant Garamond',serif;font-size:1.2rem;font-weight:700;color:#fff;letter-spacing:.02em;">LexSchedule</div>
          <div style="font-size:.72rem;color:rgba(255,255,255,.45);margin-top:3px;">Professional Legal Scheduling</div>
        </div>
        <div style="font-size:.72rem;color:rgba(255,255,255,.35);">© 2026 LexSchedule. All rights reserved. Attorney advertising.</div>
      </footer>
    </div>`);
  },

  /* ── Waitlist ── */
  waitlist() {
    S.view = 'waitlist';
    render(`
    <div style="min-height:100vh;background:#0B1F3A;display:flex;flex-direction:column;">
      <!-- Nav -->
      <nav style="display:flex;align-items:center;justify-content:space-between;padding:18px 48px;border-bottom:1px solid rgba(192,157,95,.15);">
        <a onclick="location.hash='/'" style="display:flex;align-items:center;gap:12px;cursor:pointer;text-decoration:none;">
          <div style="width:38px;height:38px;border:1.5px solid #C09D5F;border-radius:50%;display:flex;align-items:center;justify-content:center;">${logoSVG(22)}</div>
          <div style="font-family:'Cormorant Garamond',serif;font-size:1.3rem;font-weight:700;color:#fff;letter-spacing:.02em;">LexSchedule</div>
        </a>
        <button onclick="location.hash='/login'" style="padding:8px 20px;border:1.5px solid rgba(255,255,255,.25);border-radius:7px;font-size:.78rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;cursor:pointer;background:transparent;color:rgba(255,255,255,.7);font-family:'Montserrat',sans-serif;">Sign In</button>
      </nav>
      <!-- Form -->
      <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:60px 24px;">
        <div style="width:100%;max-width:480px;">
          <div id="wl-form-wrap">
            <div style="text-align:center;margin-bottom:36px;">
              <div style="font-size:.62rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#C09D5F;margin-bottom:12px;">Early Access</div>
              <h1 style="font-family:'Cormorant Garamond',serif;font-size:2.8rem;font-weight:600;color:#fff;line-height:1.1;margin-bottom:14px;">Join the Waitlist</h1>
              <p style="font-size:.9rem;color:rgba(255,255,255,.6);line-height:1.7;">We're currently in early testing. Be the first to know when LexSchedule opens to new firms.</p>
            </div>
            <div style="background:rgba(255,255,255,.04);border:1px solid rgba(192,157,95,.2);border-radius:16px;padding:36px;">
              <div id="wl-error" style="display:none;background:rgba(220,38,38,.15);border:1px solid rgba(220,38,38,.4);border-radius:8px;padding:11px 14px;margin-bottom:18px;font-size:.82rem;color:#FCA5A5;"></div>
              <div style="margin-bottom:18px;">
                <label style="display:block;font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.6);margin-bottom:7px;">Full Name <span style="color:#C09D5F;">*</span></label>
                <input id="wl-name" type="text" placeholder="Jane A. Smith" style="width:100%;padding:11px 14px;background:rgba(255,255,255,.07);border:1.5px solid rgba(192,157,95,.25);border-radius:8px;font-size:.875rem;font-family:'Montserrat',sans-serif;color:#fff;outline:none;box-sizing:border-box;" onfocus="this.style.borderColor='#C09D5F'" onblur="this.style.borderColor='rgba(192,157,95,.25)'">
              </div>
              <div style="margin-bottom:18px;">
                <label style="display:block;font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.6);margin-bottom:7px;">Email Address <span style="color:#C09D5F;">*</span></label>
                <input id="wl-email" type="email" placeholder="jane.smith@yourfirm.com" style="width:100%;padding:11px 14px;background:rgba(255,255,255,.07);border:1.5px solid rgba(192,157,95,.25);border-radius:8px;font-size:.875rem;font-family:'Montserrat',sans-serif;color:#fff;outline:none;box-sizing:border-box;" onfocus="this.style.borderColor='#C09D5F'" onblur="this.style.borderColor='rgba(192,157,95,.25)'">
              </div>
              <div style="margin-bottom:28px;">
                <label style="display:block;font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.6);margin-bottom:7px;">How would you use LexSchedule? <span style="color:rgba(255,255,255,.3);font-weight:400;text-transform:none;letter-spacing:0;">Optional</span></label>
                <textarea id="wl-use" rows="3" placeholder="e.g. Scheduling depositions and mediations for our litigation practice…" style="width:100%;padding:11px 14px;background:rgba(255,255,255,.07);border:1.5px solid rgba(192,157,95,.25);border-radius:8px;font-size:.875rem;font-family:'Montserrat',sans-serif;color:#fff;outline:none;resize:vertical;box-sizing:border-box;" onfocus="this.style.borderColor='#C09D5F'" onblur="this.style.borderColor='rgba(192,157,95,.25)'"></textarea>
              </div>
              <button id="wl-btn" onclick="WAITLIST_submit()" style="width:100%;padding:13px;border:none;border-radius:8px;font-size:.82rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;background:#C09D5F;color:#0B1F3A;font-family:'Montserrat',sans-serif;box-shadow:0 4px 16px rgba(192,157,95,.3);transition:opacity .2s;">Request Early Access</button>
            </div>
          </div>
          <div id="wl-success" style="display:none;text-align:center;padding:48px 36px;background:rgba(255,255,255,.04);border:1px solid rgba(192,157,95,.2);border-radius:16px;">
            <div style="width:64px;height:64px;background:rgba(192,157,95,.15);border:1.5px solid #C09D5F;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;font-size:1.8rem;">✓</div>
            <h2 style="font-family:'Cormorant Garamond',serif;font-size:2.2rem;font-weight:600;color:#fff;margin-bottom:12px;">You're on the list.</h2>
            <p style="font-size:.95rem;color:rgba(255,255,255,.65);line-height:1.7;margin-bottom:28px;">Early access coming soon. We'll be in touch at the email you provided.</p>
            <button onclick="location.hash='/'" style="padding:11px 28px;border:1.5px solid rgba(192,157,95,.4);border-radius:8px;font-size:.78rem;font-weight:600;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;background:transparent;color:#C09D5F;font-family:'Montserrat',sans-serif;">← Back to Home</button>
          </div>
        </div>
      </div>
    </div>`);
  },

  /* ── Login ── */
  login() {
    S.view = 'login';
    render(`
    <div style="min-height:100vh;display:grid;grid-template-columns:1fr 1fr;">
      <!-- Left panel -->
      <div style="background:#0B1F3A;padding:64px;display:flex;flex-direction:column;justify-content:center;position:relative;overflow:hidden;">
        <div style="position:absolute;inset:0;opacity:.04;background-image:url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22><circle cx=%2230%22 cy=%2230%22 r=%221%22 fill=%22%23C09D5F%22/></svg>');background-size:30px 30px;"></div>
        <div style="position:relative;z-index:1;">
          <div style="width:68px;height:68px;border:2px solid #C09D5F;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-bottom:28px;">
            ${logoSVG(40)}
          </div>
          <div style="font-family:'Cormorant Garamond',serif;font-size:2.6rem;font-weight:700;color:#fff;line-height:1.1;margin-bottom:6px;letter-spacing:.01em;">LexSchedule</div>
          <div style="font-size:.65rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#C09D5F;margin-bottom:32px;">Professional Legal Scheduling Platform</div>
          <div style="border-left:3px solid #C09D5F;padding-left:20px;margin-top:40px;">
            <blockquote style="font-family:'Cormorant Garamond',serif;font-size:1.2rem;font-style:italic;color:rgba(255,255,255,.82);line-height:1.55;margin-bottom:12px;">"Precision in scheduling reflects precision in practice. LexSchedule ensures every coordination reflects the highest standard of excellence."</blockquote>
            <cite style="font-size:.74rem;color:#C09D5F;font-style:normal;">— Professional Legal Scheduling</cite>
          </div>
        </div>
      </div>
      <!-- Right panel -->
      <div style="background:#FAFAF8;display:flex;align-items:center;justify-content:center;padding:60px;">
        <div style="width:100%;max-width:400px;">
          <h2 style="font-family:'Cormorant Garamond',serif;font-size:2.2rem;font-weight:600;color:#0B1F3A;margin-bottom:6px;">Welcome Back</h2>
          <p style="font-size:.84rem;color:#6B7280;margin-bottom:28px;">Sign in to your LexSchedule account.</p>
          <div id="login-error" style="display:none;background:#FBE9EC;border:1px solid #FCA5A5;border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:.82rem;color:#7F1D1D;border-left:3px solid #8B1C2E;"></div>
          <div style="margin-bottom:18px;">
            <label style="display:block;font-size:.72rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:6px;">Email Address <span style="color:#8B1C2E;">*</span></label>
            <input id="l-email" type="email" placeholder="attorney@woodsweidenmiller.com" value="attorney@woodsweidenmiller.com" style="width:100%;padding:10px 14px;border:1.5px solid #D5CCBA;border-radius:8px;font-size:.875rem;font-family:'Montserrat',sans-serif;outline:none;transition:border .2s;" onfocus="this.style.borderColor='#0B1F3A';this.style.boxShadow='0 0 0 3px rgba(11,31,58,.08)'" onblur="this.style.borderColor='#D5CCBA';this.style.boxShadow=''">
          </div>
          <div style="margin-bottom:10px;">
            <label style="display:block;font-size:.72rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:6px;">Password <span style="color:#8B1C2E;">*</span></label>
            <input id="l-pass" type="password" placeholder="Enter your password" value="Demo1234!" style="width:100%;padding:10px 14px;border:1.5px solid #D5CCBA;border-radius:8px;font-size:.875rem;font-family:'Montserrat',sans-serif;outline:none;transition:border .2s;" onfocus="this.style.borderColor='#0B1F3A'" onblur="this.style.borderColor='#D5CCBA'" onkeydown="if(event.key==='Enter')AUTH_login()">
          </div>
          <button onclick="AUTH_login()" style="width:100%;padding:12px;border:none;border-radius:8px;font-size:.82rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;background:#0B1F3A;color:#fff;font-family:'Montserrat',sans-serif;box-shadow:0 2px 8px rgba(11,31,58,.2);transition:all .2s;" onmouseover="this.style.background='#162d52'" onmouseout="this.style.background='#0B1F3A'">Sign In to LexSchedule</button>
          <div style="text-align:center;font-size:.82rem;color:#6B7280;margin-top:20px;">Interested in LexSchedule? <a onclick="location.hash='/waitlist'" style="color:#9e7e3f;font-weight:600;cursor:pointer;">Join the waitlist</a></div>
          <div style="text-align:center;margin-top:16px;"><a onclick="location.hash='/'" style="font-size:.76rem;color:#9CA3AF;cursor:pointer;">← Back to Home</a></div>
        </div>
      </div>
    </div>`);
  },

  /* ── Register ── */
  register() {
    S.view = 'register';
    render(`
    <div style="min-height:100vh;display:grid;grid-template-columns:1fr 1fr;">
      <div style="background:#0B1F3A;padding:64px;display:flex;flex-direction:column;justify-content:center;position:relative;overflow:hidden;">
        <div style="position:absolute;inset:0;opacity:.04;background-image:url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22><circle cx=%2230%22 cy=%2230%22 r=%221%22 fill=%22%23C09D5F%22/></svg>');background-size:30px 30px;"></div>
        <div style="position:relative;z-index:1;">
          <div style="width:68px;height:68px;border:2px solid #C09D5F;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-bottom:28px;">${logoSVG(40)}</div>
          <div style="font-family:'Cormorant Garamond',serif;font-size:2.4rem;font-weight:700;color:#fff;line-height:1.1;margin-bottom:8px;letter-spacing:.01em;">LexSchedule</div>
          <div style="font-size:.65rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#C09D5F;margin-bottom:32px;">Professional Legal Scheduling</div>
          <div style="display:flex;flex-direction:column;gap:16px;margin-top:20px;">
            ${[['✅','Free for firm personnel'],['⏱️','Set up in under 2 minutes'],['🔒','Secure and confidential'],['📧','Professional communications included']].map(([i,t])=>`<div style="display:flex;gap:12px;align-items:center;font-size:.84rem;color:rgba(255,255,255,.75);"><span>${i}</span>${t}</div>`).join('')}
          </div>
        </div>
      </div>
      <div style="background:#FAFAF8;display:flex;align-items:center;justify-content:center;padding:48px 60px;overflow-y:auto;">
        <div style="width:100%;max-width:420px;">
          <h2 style="font-family:'Cormorant Garamond',serif;font-size:2rem;font-weight:600;color:#0B1F3A;margin-bottom:6px;">Create Account</h2>
          <p style="font-size:.84rem;color:#6B7280;margin-bottom:24px;">All fields marked with <span style="color:#8B1C2E;">*</span> are required.</p>
          <div id="reg-error" style="display:none;background:#FBE9EC;border-left:3px solid #8B1C2E;border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:.82rem;color:#7F1D1D;"></div>
          ${['name:Full Name *:text:Jane A. Smith','email:Email Address *:email:jane.smith@firm.com','phone:Phone Number:tel:(239) 555-0000'].map(f => {
            const [id,lbl,type,ph] = f.split(':');
            return `<div style="margin-bottom:16px;"><label style="display:block;font-size:.72rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:6px;">${lbl}</label><input id="r-${id}" type="${type}" placeholder="${ph}" style="width:100%;padding:10px 14px;border:1.5px solid #D5CCBA;border-radius:8px;font-size:.875rem;font-family:'Montserrat',sans-serif;outline:none;" onfocus="this.style.borderColor='#0B1F3A'" onblur="this.style.borderColor='#D5CCBA'"></div>`;
          }).join('')}
          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:.72rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:8px;">I am signing up as *</label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <label id="role-atty-card" style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 10px;border:2px solid #D5CCBA;border-radius:10px;cursor:pointer;transition:all .2s;background:#fff;" onclick="REG_selectRole('Attorney')">
                <span style="font-size:1.6rem;">⚖️</span>
                <span style="font-size:.84rem;font-weight:700;color:#0B1F3A;">Attorney</span>
                <span style="font-size:.68rem;color:#9CA3AF;text-align:center;">I am a licensed attorney at this firm</span>
              </label>
              <label id="role-asst-card" style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 10px;border:2px solid #D5CCBA;border-radius:10px;cursor:pointer;transition:all .2s;background:#fff;" onclick="REG_selectRole('Assistant')">
                <span style="font-size:1.6rem;">🗂️</span>
                <span style="font-size:.84rem;font-weight:700;color:#0B1F3A;">Assistant</span>
                <span style="font-size:.68rem;color:#9CA3AF;text-align:center;">I support one or more attorneys</span>
              </label>
            </div>
            <input type="hidden" id="r-role" value="">
          </div>
          <!-- Attorney-only: Bar number + title -->
          <div id="bar-row" style="display:none;margin-bottom:16px;">
            <label style="display:block;font-size:.72rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:6px;">Florida Bar Number</label>
            <input id="r-bar" type="text" placeholder="e.g. 123456" style="width:100%;padding:10px 14px;border:1.5px solid #D5CCBA;border-radius:8px;font-size:.875rem;font-family:'Montserrat',sans-serif;outline:none;" onfocus="this.style.borderColor='#0B1F3A'" onblur="this.style.borderColor='#D5CCBA'">
          </div>
          <div id="bar-title-row" style="display:none;margin-bottom:16px;">
            <label style="display:block;font-size:.72rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:6px;">Title / Position</label>
            <input id="r-title" type="text" placeholder="e.g. Partner, Associate, Of Counsel" style="width:100%;padding:10px 14px;border:1.5px solid #D5CCBA;border-radius:8px;font-size:.875rem;font-family:'Montserrat',sans-serif;outline:none;" onfocus="this.style.borderColor='#0B1F3A'" onblur="this.style.borderColor='#D5CCBA'">
          </div>
          <!-- Assistant-only: supervising attorney -->
          <div id="asst-row" style="display:none;margin-bottom:16px;">
            <label style="display:block;font-size:.72rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:6px;">Assistant To (Attorney Name) *</label>
            <input id="r-assistant-for" type="text" placeholder="e.g. Jane A. Smith" style="width:100%;padding:10px 14px;border:1.5px solid #D5CCBA;border-radius:8px;font-size:.875rem;font-family:'Montserrat',sans-serif;outline:none;" onfocus="this.style.borderColor='#0B1F3A'" onblur="this.style.borderColor='#D5CCBA'">
            <p style="font-size:.72rem;color:#9CA3AF;margin:5px 0 0;">Enter the full name of the attorney you primarily assist.</p>
          </div>
          <div id="asst-title-row" style="display:none;margin-bottom:16px;">
            <label style="display:block;font-size:.72rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:6px;">Your Title</label>
            <input id="r-asst-title" type="text" placeholder="e.g. Legal Secretary, Paralegal, Administrative Assistant" style="width:100%;padding:10px 14px;border:1.5px solid #D5CCBA;border-radius:8px;font-size:.875rem;font-family:'Montserrat',sans-serif;outline:none;" onfocus="this.style.borderColor='#0B1F3A'" onblur="this.style.borderColor='#D5CCBA'">
          </div>
          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:.72rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:6px;">Firm / Organization</label>
            <input id="r-firm" type="text" placeholder="Your Firm / Organization" value="" style="width:100%;padding:10px 14px;border:1.5px solid #D5CCBA;border-radius:8px;font-size:.875rem;font-family:'Montserrat',sans-serif;outline:none;" onfocus="this.style.borderColor='#0B1F3A'" onblur="this.style.borderColor='#D5CCBA'">
          </div>
          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:.72rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:6px;">Password *</label>
            <input id="r-pass" type="password" placeholder="Minimum 8 characters" style="width:100%;padding:10px 14px;border:1.5px solid #D5CCBA;border-radius:8px;font-size:.875rem;font-family:'Montserrat',sans-serif;outline:none;" onfocus="this.style.borderColor='#0B1F3A'" onblur="this.style.borderColor='#D5CCBA'">
          </div>
          <div style="margin-bottom:20px;">
            <label style="display:block;font-size:.72rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:6px;">Confirm Password *</label>
            <input id="r-pass2" type="password" placeholder="Re-enter your password" style="width:100%;padding:10px 14px;border:1.5px solid #D5CCBA;border-radius:8px;font-size:.875rem;font-family:'Montserrat',sans-serif;outline:none;" onfocus="this.style.borderColor='#0B1F3A'" onblur="this.style.borderColor='#D5CCBA'" onkeydown="if(event.key==='Enter')AUTH_register()">
          </div>
          <label style="display:flex;align-items:flex-start;gap:10px;font-size:.8rem;color:#4B5563;cursor:pointer;margin-bottom:20px;">
            <input id="r-terms" type="checkbox" style="margin-top:2px;accent-color:#0B1F3A;">
            <span>I agree that my use of LexSchedule is subject to the firm's policies and that all scheduling communications are professional in nature.</span>
          </label>
          <button onclick="AUTH_register()" style="width:100%;padding:12px;border:none;border-radius:8px;font-size:.82rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;background:#0B1F3A;color:#fff;font-family:'Montserrat',sans-serif;transition:all .2s;" onmouseover="this.style.background='#162d52'" onmouseout="this.style.background='#0B1F3A'">Create Account</button>
          <div style="text-align:center;font-size:.82rem;color:#6B7280;margin-top:16px;">Already have an account? <a onclick="location.hash='/login'" style="color:#9e7e3f;font-weight:600;cursor:pointer;">Sign in</a></div>
        </div>
      </div>
    </div>`);
  },

  userMenu() {
    modal.open(`
      <div class="modal-header"><h3 class="modal-title">Account</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
      <div class="modal-body">
        <div style="display:flex;align-items:center;gap:16px;padding:16px;background:#F6F1E9;border-radius:10px;margin-bottom:20px;">
          <div style="width:52px;height:52px;border-radius:50%;background:#0B1F3A;color:#C09D5F;font-family:'Cormorant Garamond',serif;font-size:1.3rem;font-weight:700;display:flex;align-items:center;justify-content:center;">${initials(S.user?.name||'?')}</div>
          <div>
            <div style="font-weight:600;color:#0B1F3A;">${esc(S.user?.name||'')}</div>
            <div style="font-size:.8rem;color:#6B7280;">${esc(S.user?.email||'')}</div>
            <div style="font-size:.72rem;color:#9CA3AF;">${esc(S.user?.role||'')} · ${esc(S.user?.firm||'')}</div>
            ${S.user?.assistantFor ? `<div style="font-size:.74rem;color:#C09D5F;font-weight:600;margin-top:3px;">Assistant to ${esc(S.user.assistantFor)}</div>` : ''}
          </div>
        </div>
        ${S.user?.barNumber ? `<p style="font-size:.82rem;color:#4B5563;margin-bottom:10px;"><strong>Florida Bar No.:</strong> ${esc(S.user.barNumber)}</p>` : ''}
        ${S.user?.assistantFor ? `<div style="background:#F6F1E9;border-left:3px solid #C09D5F;border-radius:6px;padding:10px 14px;font-size:.8rem;color:#4B5563;margin-bottom:10px;"><strong style="color:#0B1F3A;">Scheduling on behalf of:</strong> ${esc(S.user.assistantFor)}</div>` : ''}
        <div style="margin-top:4px;display:flex;flex-direction:column;gap:10px;">
          <div>
            <div style="font-size:.7rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#9CA3AF;margin-bottom:4px;">Firm Name (shown in emails)</div>
            <input id="acct-firm" type="text" value="${esc(S.user?.firm||'')}" placeholder="e.g. Smith & Jones, P.A." style="width:100%;padding:8px 12px;border:1.5px solid #D5CCBA;border-radius:7px;font-size:.84rem;font-family:'Montserrat',sans-serif;outline:none;box-sizing:border-box;" onfocus="this.style.borderColor='#0B1F3A'" onblur="this.style.borderColor='#D5CCBA'">
          </div>
          <div>
            <div style="font-size:.7rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#9CA3AF;margin-bottom:4px;">Contact Phone (shown in emails)</div>
            <input id="acct-phone" type="tel" value="${esc(S.user?.phone||'')}" placeholder="e.g. (239) 555-0100" style="width:100%;padding:8px 12px;border:1.5px solid #D5CCBA;border-radius:7px;font-size:.84rem;font-family:'Montserrat',sans-serif;outline:none;box-sizing:border-box;" onfocus="this.style.borderColor='#0B1F3A'" onblur="this.style.borderColor='#D5CCBA'">
          </div>
          <div>
            <div style="font-size:.7rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#9CA3AF;margin-bottom:4px;">Fax Number (shown in emails)</div>
            <input id="acct-fax" type="tel" value="${esc(S.user?.firmFax||'')}" placeholder="e.g. (239) 555-0199" style="width:100%;padding:8px 12px;border:1.5px solid #D5CCBA;border-radius:7px;font-size:.84rem;font-family:'Montserrat',sans-serif;outline:none;box-sizing:border-box;" onfocus="this.style.borderColor='#0B1F3A'" onblur="this.style.borderColor='#D5CCBA'">
          </div>
          <div>
            <div style="font-size:.7rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#9CA3AF;margin-bottom:4px;">Firm Address (shown in emails)</div>
            <input id="acct-address" type="text" value="${esc(S.user?.firmAddress||'')}" placeholder="e.g. 1234 Main St, Suite 100, Naples, FL 34102" style="width:100%;padding:8px 12px;border:1.5px solid #D5CCBA;border-radius:7px;font-size:.84rem;font-family:'Montserrat',sans-serif;outline:none;box-sizing:border-box;" onfocus="this.style.borderColor='#0B1F3A'" onblur="this.style.borderColor='#D5CCBA'">
          </div>
          <button onclick="VIEWS_saveAccountContact()" style="align-self:flex-start;padding:8px 16px;border:none;border-radius:7px;background:#0B1F3A;color:#C09D5F;font-size:.76rem;font-weight:700;cursor:pointer;font-family:'Montserrat',sans-serif;white-space:nowrap;">Save Contact Info</button>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal()">Close</button>
        <button class="btn btn-outline" onclick="VIEWS.emailSettings()">&#9881; Email Settings</button>
        <button class="btn btn-danger" onclick="closeModal();AUTH.logout();">Sign Out</button>
      </div>`);
  },

  emailSettings() {
    const cfg = (() => { try { return JSON.parse(localStorage.getItem('ejs_config')||'{}'); } catch(e){return{};} })();
    const v = f => esc(cfg[f]||'');
    const field = (id, label, placeholder, val) =>
      `<div style="margin-bottom:14px;">
        <label style="display:block;font-size:.76rem;font-weight:600;color:#4B5563;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px;">${label}</label>
        <input id="ejs_${id}" type="text" value="${val}" placeholder="${placeholder}"
          style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #E5E7EB;border-radius:7px;font-size:.84rem;font-family:'Montserrat',sans-serif;outline:none;" />
      </div>`;
    modal.open(`
      <div class="modal-header" style="background:#0B1F3A;border-radius:18px 18px 0 0;">
        <h3 class="modal-title" style="color:#fff">&#9881; Email Settings</h3>
        <button class="modal-close" style="background:rgba(255,255,255,.1);color:#fff;border:none" onclick="closeModal()">&#10005;</button>
      </div>
      <div class="modal-body">
        <div style="background:#EBF0F7;border-radius:9px;padding:14px 16px;margin-bottom:20px;font-size:.8rem;color:#374151;line-height:1.55;">
          <strong style="color:#0B1F3A;">How to set up real email sending:</strong><br>
          1. Sign up free at <strong>emailjs.com</strong><br>
          2. Add Email Service (Gmail or Outlook) &rarr; copy the <strong>Service ID</strong><br>
          3. Create email templates &rarr; copy each <strong>Template ID</strong><br>
          4. Go to Account &rarr; copy your <strong>Public Key</strong><br>
          5. Paste below and save.
        </div>
        ${field('publicKey',    'Public Key',             'e.g. user_XXXXXXXXXXXX',      v('publicKey'))}
        ${field('serviceId',    'Service ID',             'e.g. service_XXXXXXX',        v('serviceId'))}
        ${field('templateInvitation',   'Template ID — Invitation',   'e.g. template_XXXXXXX', v('templateInvitation'))}
        ${field('templateReminder',     'Template ID — Reminder',     'e.g. template_XXXXXXX (or leave blank to reuse Invitation)', v('templateReminder'))}
        ${field('templateConfirmation', 'Template ID — Confirmation', 'e.g. template_XXXXXXX (or leave blank to reuse Invitation)', v('templateConfirmation'))}
        ${field('templateNoMatch',      'Template ID — No Match',     'e.g. template_XXXXXXX (or leave blank to reuse Invitation)', v('templateNoMatch'))}
        ${field('templateWaitlist',     'Template ID — Waitlist Notification', 'e.g. template_XXXXXXX', v('templateWaitlist'))}
        <div style="background:#FEF3C7;border-radius:8px;padding:12px 14px;font-size:.77rem;color:#92400E;margin-top:4px;">
          <strong>Template variables available:</strong> to_name, to_email, subject, matter_name, case_number,
          event_type, deadline, proposed_slots, respond_url, confirmed_date, confirmed_time, location, sender_name
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="EJS_saveConfig()">Save Settings</button>
      </div>`);
  },


  /* ── Dashboard ── */
  dashboard() {
    S.view = 'dashboard';
    const allEvts    = S.events.filter(e => e.status !== 'archived'); // active pool (excludes history)
    const historyEvts= S.events.filter(e => e.status === 'archived');
    const active    = allEvts.filter(e=>e.status==='active').length;
    const confirmed = allEvts.filter(e=>e.status==='confirmed').length;
    const noMatch   = allEvts.filter(e=>e.status==='no-match').length;
    const pending   = allEvts.reduce((n,e)=>n+e.participants.filter(p=>p.status==='pending').length, 0);

    const filterBtns = ['All','Active','Confirmed','Needs Attention','History'];
    render(`
    ${HEADER()}
    <div style="max-width:1300px;margin:0 auto;padding:32px 28px;">
      <!-- Page header -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:28px;gap:20px;">
        <div>
          <p style="font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9CA3AF;margin-bottom:4px;">Good morning, ${esc(S.user?.name?.split(' ')[0]||'Counselor')}${S.user?.assistantFor ? ` — Assisting ${esc(S.user.assistantFor)}` : ''}</p>
          <h1 style="font-family:'Cormorant Garamond',serif;font-size:2.2rem;font-weight:600;color:#0B1F3A;line-height:1.1;">Scheduling Dashboard</h1>
        </div>
        <button onclick="location.hash='/new'" style="padding:12px 26px;border:none;border-radius:8px;font-size:.8rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;background:#C09D5F;color:#0B1F3A;font-family:'Montserrat',sans-serif;box-shadow:0 4px 12px rgba(192,157,95,.3);white-space:nowrap;flex-shrink:0;transition:all .2s;" onmouseover="this.style.background='#d4b87a'" onmouseout="this.style.background='#C09D5F'">+ New Scheduling Event</button>
      </div>
      <!-- Stats -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:28px;">
        ${[
          ['Active Events',      active,    '📋', 'stat-active',    'Active'],
          ['Pending Responses',  pending,   '⏳', 'stat-pending',   'Pending'],
          ['Confirmed',          confirmed, '✅', 'stat-confirmed', 'Confirmed'],
          ['No Match Found',     noMatch,   '⚠️', 'stat-nomatch',   'No Match'],
        ].map(([label,val,icon,cardId,filterKey])=>`
          <div id="${cardId}" onclick="dashFilter('${filterKey}')" style="background:#fff;border-radius:12px;padding:20px 22px;border:1px solid #EDE6D9;box-shadow:0 1px 4px rgba(11,31,58,.06);position:relative;overflow:hidden;transition:all .2s;cursor:pointer;"
            onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 20px rgba(11,31,58,.1)';this.style.borderColor='#C09D5F';"
            onmouseout="if(!this.classList.contains('stat-active-filter')){this.style.transform='';this.style.boxShadow='0 1px 4px rgba(11,31,58,.06)';this.style.borderColor='#EDE6D9';}">
            <div style="position:absolute;top:0;left:0;right:0;height:3px;background:#C09D5F;"></div>
            <div style="font-family:'Cormorant Garamond',serif;font-size:2.4rem;font-weight:700;color:#0B1F3A;line-height:1;">${val}</div>
            <div style="font-size:.7rem;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:#9CA3AF;margin-top:5px;">${label}</div>
            <div style="position:absolute;top:16px;right:16px;font-size:1.4rem;opacity:.14;">${icon}</div>
            <div style="position:absolute;bottom:8px;right:10px;font-size:.58rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#C09D5F;opacity:0;transition:opacity .2s;" class="stat-click-hint">Click to filter</div>
          </div>
        `).join('')}
      </div>
      <!-- Filter bar -->
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px;">
        <!-- Status filter -->
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <span style="font-size:.68rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#9CA3AF;white-space:nowrap;min-width:44px;">Status</span>
          <div style="display:flex;gap:2px;background:#EDE6D9;padding:4px;border-radius:8px;">
            ${filterBtns.map(f=>`<button onclick="dashFilter('${f}')" id="ftab-${f.replace(/ /g,'-')}" style="padding:6px 16px;border-radius:6px;font-size:.74rem;font-weight:600;letter-spacing:.04em;background:${f==='All'?'#fff':'transparent'};color:${f==='All'?'#0B1F3A':'#6B7280'};border:none;cursor:pointer;font-family:'Montserrat',sans-serif;transition:all .15s;${f==='All'?'box-shadow:0 1px 3px rgba(11,31,58,.08);':''}">${f}</button>`).join('')}
          </div>
        </div>
        <!-- Type filter -->
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <span style="font-size:.68rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#9CA3AF;white-space:nowrap;min-width:44px;">Type</span>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button onclick="dashTypeFilter('All')" id="ttype-All" style="padding:5px 14px;border-radius:20px;font-size:.72rem;font-weight:600;letter-spacing:.04em;background:#0B1F3A;color:#fff;border:1.5px solid #0B1F3A;cursor:pointer;font-family:'Montserrat',sans-serif;transition:all .15s;">All Types</button>
            ${Object.entries(EVENT_TYPES).map(([key,et])=>`
              <button onclick="dashTypeFilter('${key}')" id="ttype-${key}" style="padding:5px 14px;border-radius:20px;font-size:.72rem;font-weight:600;letter-spacing:.03em;background:transparent;color:#6B7280;border:1.5px solid #E5E7EB;cursor:pointer;font-family:'Montserrat',sans-serif;transition:all .15s;display:flex;align-items:center;gap:5px;">
                <span>${et.icon}</span><span>${et.label}</span>
              </button>`).join('')}
          </div>
        </div>
      </div>
      <!-- Active filters summary -->
      <div id="dash-filter-summary" style="display:none;margin-bottom:12px;font-size:.76rem;color:#6B7280;"></div>
      <!-- Event list -->
      <div id="event-list" style="display:flex;flex-direction:column;gap:12px;">
        ${VIEWS.renderEventList(allEvts, false)}
      </div>
    </div>`);
  },

  renderEventList(evts, isHistory) {
    if (!evts.length) return `
      <div style="text-align:center;padding:60px 24px;">
        <div style="font-size:3rem;opacity:.2;margin-bottom:16px;">${isHistory ? '📁' : '📅'}</div>
        <h3 style="font-family:'Cormorant Garamond',serif;font-size:1.4rem;font-weight:500;color:#0B1F3A;margin-bottom:8px;">${isHistory ? 'No Events in History Yet' : 'No Scheduling Events Found'}</h3>
        <p style="font-size:.84rem;color:#9CA3AF;max-width:320px;margin:0 auto 24px;">${isHistory ? 'Past events will appear here once their meeting dates have passed.' : 'No events match the current filters, or none have been created yet.'}</p>
        ${isHistory ? '' : `<button onclick="location.hash='/new'" style="padding:10px 24px;border:none;border-radius:8px;font-size:.78rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;cursor:pointer;background:#0B1F3A;color:#fff;font-family:'Montserrat',sans-serif;">Create First Event</button>`}
      </div>`;
    const ACCENT_COLORS = { 'deposition':'#DC2626','mediation':'#D97706','client-meeting':'#2563EB','opposing-call':'#7C3AED','settlement':'#059669','document-review':'#0284C7','court-prep':'#EA580C','closing':'#1E3A5F','other':'#6B7280' };

    // Helper: get confirmed slot date string for an event (or null)
    const confirmedDate = ev => {
      if (!ev.confirmedSlot) return null;
      const slot = ev.proposedSlots.find(s => s.id === ev.confirmedSlot);
      return slot ? slot.date : null;
    };

    // Sort: 1) by case number (no case → bottom), 2) within case confirmed date chrono, 3) unconfirmed last
    const sorted = [...evts].sort((a, b) => {
      const ca = (a.caseNumber || '').trim();
      const cb = (b.caseNumber || '').trim();
      if (!ca && !cb) { /* fall through to date sort */ }
      else if (!ca) return 1;
      else if (!cb) return -1;
      else {
        const cmp = ca.localeCompare(cb, undefined, { numeric: true, sensitivity: 'base' });
        if (cmp !== 0) return cmp;
      }
      // Same case (or both no case): confirmed dates first, chrono
      const da = confirmedDate(a), db = confirmedDate(b);
      if (da && db) return da < db ? -1 : da > db ? 1 : 0;
      if (da) return -1;
      if (db) return 1;
      return 0;
    });

    // Render a subtle case-group divider when the case number changes
    let lastCase = null;
    return sorted.map(ev => {
      const et = EVENT_TYPES[ev.type] || { label: ev.type, icon:'📅', color:'#374151', bg:'#F3F4F6' };
      const responded = ev.participants.filter(p=>p.status!=='pending').length;
      const deadline = ev.deadline ? daysDiff(ev.deadline) : null;
      const deadlineStr = deadline === null ? '' : deadline < 0 ? 'Deadline passed' : deadline === 0 ? 'Due today' : `${deadline}d remaining`;
      const statusStyles = {
        active:    'background:#D1FAE5;color:#065F46',
        confirmed: 'background:#DBEAFE;color:#1E40AF',
        'no-match':'background:#FEE2E2;color:#991B1B',
        draft:     'background:#F3F4F6;color:#374151',
        expired:   'background:#FEF3C7;color:#92400E',
      };
      const caseKey = (ev.caseNumber || '').trim() || '__none__';
      const isFirstInGroup = caseKey !== lastCase;
      lastCase = caseKey;

      // How many events share this case number (for the group header badge)
      const groupCount = sorted.filter(e => (e.caseNumber||'').trim() === (ev.caseNumber||'').trim()).length;
      const caseLabel = ev.caseNumber ? esc(ev.caseNumber) : 'No Case No.';

      // Clickable case number — stops row navigation, applies case filter
      const caseChip = ev.caseNumber
        ? `<span onclick="event.stopPropagation();dashCaseFilter('${esc(ev.caseNumber)}')" title="Filter by this case number" style="font-size:.72rem;color:#0B1F3A;font-weight:700;background:#EBF0F7;padding:2px 8px;border-radius:4px;cursor:pointer;border:1px solid #C9D5E8;transition:all .15s;" onmouseover="this.style.background='#C09D5F';this.style.color='#0B1F3A';this.style.borderColor='#C09D5F'" onmouseout="this.style.background='#EBF0F7';this.style.color='#0B1F3A';this.style.borderColor='#C9D5E8'">📁 ${caseLabel}</span>`
        : `<span style="font-size:.72rem;color:#9CA3AF;">📁 ${caseLabel}</span>`;

      const groupDivider = isFirstInGroup ? `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;${caseKey==='__none__'?'margin-top:8px;':''}">
          <span style="font-family:'Cormorant Garamond',serif;font-size:.82rem;font-weight:600;color:${ev.caseNumber?'#0B1F3A':'#9CA3AF'};">
            ${ev.caseNumber ? `Case No. ${esc(ev.caseNumber)}` : 'No Case Number'}
          </span>
          ${groupCount > 1 ? `<span style="font-size:.64rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;background:#C09D5F;color:#0B1F3A;padding:2px 7px;border-radius:20px;">${groupCount} sessions</span>` : ''}
          <div style="flex:1;height:1px;background:#EDE6D9;"></div>
        </div>` : '';

      // Archive metadata for history cards
      const archivedDate = ev.archivedAt ? new Date(ev.archivedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '';
      const archBadgeLabel = ev.archivedStatus === 'confirmed' ? 'Completed' : ev.archivedStatus === 'no-match' ? 'No Match' : 'Expired';
      const archBadgeStyle = ev.archivedStatus === 'confirmed'
        ? 'background:#DBEAFE;color:#1E40AF'
        : ev.archivedStatus === 'no-match'
          ? 'background:#FEE2E2;color:#991B1B'
          : 'background:#FEF3C7;color:#92400E';

      const cardBg    = isHistory ? '#FAFAF8' : '#fff';
      const cardBorder= isHistory ? '#E8E2D8' : '#EDE6D9';
      const accentBar = isHistory ? '#B8AD9E' : (ACCENT_COLORS[ev.type]||'#C09D5F');
      const titleClr  = isHistory ? '#6B7280' : '#0B1F3A';

      return groupDivider + `
      <div style="background:${cardBg};border-radius:12px;border:1px solid ${cardBorder};padding:18px 22px;display:flex;align-items:center;gap:18px;box-shadow:0 1px 3px rgba(11,31,58,.04);cursor:pointer;transition:all .25s;margin-bottom:4px;${isHistory?'opacity:.88;':''}" onmouseover="this.style.boxShadow='0 6px 16px rgba(11,31,58,.08)';this.style.borderColor='#C09D5F';this.style.transform='translateX(2px)';this.style.opacity='1'" onmouseout="this.style.boxShadow='0 1px 3px rgba(11,31,58,.04)';this.style.borderColor='${cardBorder}';this.style.transform='';this.style.opacity='${isHistory?'.88':'1'}'" onclick="location.hash='/event/${ev.id}'">
        <div style="width:4px;height:52px;border-radius:2px;background:${accentBar};flex-shrink:0;"></div>
        <div style="width:36px;height:36px;border-radius:8px;background:${et.bg};display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;opacity:${isHistory?'.7':'1'};">${et.icon}</div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;">
            <div style="font-family:'Cormorant Garamond',serif;font-size:1.1rem;font-weight:600;color:${titleClr};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(ev.matterName)}</div>
            ${(() => {
              const cd = confirmedDate(ev);
              if (!cd || !(ev.status==='confirmed'||(isHistory&&ev.archivedStatus==='confirmed'))) return '';
              const dayNum = new Date(cd + 'T12:00:00').getDate();
              const fs = dayNum >= 10 ? '6.2' : '7.5';
              const calIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" width="16" height="16" style="vertical-align:middle;margin-right:3px;flex-shrink:0;"><rect x="1" y="2.5" width="14" height="12" rx="1.5" fill="#DBEAFE" stroke="#1E40AF" stroke-width="1.2"/><rect x="1" y="2.5" width="14" height="4.5" rx="1.5" fill="#1E40AF"/><rect x="1" y="5.5" width="14" height="1.5" fill="#1E40AF"/><line x1="5" y1="1.5" x2="5" y2="4.5" stroke="#93C5FD" stroke-width="1.2" stroke-linecap="round"/><line x1="11" y1="1.5" x2="11" y2="4.5" stroke="#93C5FD" stroke-width="1.2" stroke-linecap="round"/><text x="8" y="13.5" text-anchor="middle" font-family="Georgia,serif" font-size="${fs}" font-weight="700" fill="#1E40AF">${dayNum}</text></svg>`;
              return `<span style="display:inline-flex;align-items:center;gap:1px;font-family:'Cormorant Garamond',serif;font-size:.92rem;font-weight:600;color:#1E40AF;white-space:nowrap;">${calIcon}${fmtDateShort(cd)}</span>`;
            })()}
          </div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:4px;flex-wrap:wrap;">
            ${caseChip}
            <span style="font-size:.72rem;color:#9CA3AF;">👥 ${responded}/${ev.participants.length} responded</span>
            ${isHistory
              ? `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:.67rem;font-weight:600;letter-spacing:.05em;text-transform:uppercase;${archBadgeStyle}">📁 ${archBadgeLabel}</span>
                 ${archivedDate ? `<span style="font-size:.7rem;color:#9CA3AF;">Archived ${archivedDate}</span>` : ''}`
              : `${deadlineStr ? `<span style="font-size:.72rem;color:${deadline!==null&&deadline<=2?'#DC2626':'#9CA3AF'};">⏱ ${deadlineStr}</span>` : ''}
                 <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:.67rem;font-weight:600;letter-spacing:.05em;text-transform:uppercase;${statusStyles[ev.status]||statusStyles.draft}">${ev.status.replace('-',' ')}</span>`
            }
            <span style="padding:3px 8px;border-radius:4px;font-size:.68rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;background:${et.bg};color:${et.color};opacity:${isHistory?'.8':'1'};">${et.label}</span>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
          ${!isHistory && ev.status === 'active' ? `<button onclick="event.stopPropagation();VIEWS.sendReminderAll_dashboard('${ev.id}')" style="padding:7px 14px;border:1px solid #EDE6D9;border-radius:7px;font-size:.72rem;font-weight:600;background:#fff;color:#4B5563;cursor:pointer;font-family:'Montserrat',sans-serif;transition:all .2s;" onmouseover="this.style.borderColor='#C09D5F'" onmouseout="this.style.borderColor='#EDE6D9'">Remind</button>` : ''}
          <button onclick="event.stopPropagation();location.hash='/event/${ev.id}'" style="padding:7px 14px;border:none;border-radius:7px;font-size:.72rem;font-weight:700;letter-spacing:.03em;background:${isHistory?'#6B7280':'#0B1F3A'};color:#fff;cursor:pointer;font-family:'Montserrat',sans-serif;">View →</button>
        </div>
      </div>`;
    }).join('');
  },

  sendReminderAll_dashboard(eventId) {
    EMAIL.sendReminderAll(eventId);
    STORE.save();
  },


  /* ── Create Event Wizard ── */
  createEvent() {
    S.view = 'create';

    // Build datalist options from historical event data
    const _uniq = arr => [...new Set(arr.filter(Boolean))];
    const _allParticipants = S.events.flatMap(e => e.participants || []);
    const _dlMatters   = _uniq(S.events.map(e => e.matterName));
    const _dlCases     = _uniq(S.events.map(e => e.caseNumber));
    const _dlLocations = _uniq(S.events.map(e => e.locationDetails));
    const _dlPNames    = _uniq(_allParticipants.map(p => p.name));
    const _dlPEmails   = _uniq(_allParticipants.map(p => p.email));
    const _dlPOrgs     = _uniq(_allParticipants.map(p => p.organization));
    const _dlOpts = (arr) => arr.map(v => `<option value="${esc(v)}">`).join('');
    const _datalists = `
      <datalist id="dl-matters">${_dlOpts(_dlMatters)}</datalist>
      <datalist id="dl-cases">${_dlOpts(_dlCases)}</datalist>
      <datalist id="dl-locations">${_dlOpts(_dlLocations)}</datalist>
      <datalist id="dl-pnames">${_dlOpts(_dlPNames)}</datalist>
      <datalist id="dl-pemails">${_dlOpts(_dlPEmails)}</datalist>
      <datalist id="dl-porgs">${_dlOpts(_dlPOrgs)}</datalist>`;

    // Step 0 = mode picker (no progress bar)
    if (S.createStep === 0) {
      render(`${HEADER()}${_datalists}
      <div style="max-width:820px;margin:0 auto;padding:32px 28px;">
        <div style="margin-bottom:6px;"><a onclick="location.hash='/dashboard'" style="font-size:.76rem;color:#9CA3AF;cursor:pointer;">← Dashboard</a></div>
        <h1 style="font-family:'Cormorant Garamond',serif;font-size:2rem;font-weight:600;color:#0B1F3A;margin-bottom:24px;">New Scheduling Event</h1>
        <div style="background:#fff;border-radius:14px;border:1px solid #EDE6D9;box-shadow:0 2px 8px rgba(11,31,58,.06);overflow:hidden;">
          ${VIEWS.createStep0()}
        </div>
      </div>`);
      return;
    }

    const isPoll = S.createData.mode === 'poll';
    const steps = ['Event Details', 'Participants', isPoll ? 'Date Range' : 'Time Slots', 'Review & Send'];
    const stepHTML = steps.map((lbl,i)=>{
      const n=i+1, done=n<S.createStep, active=n===S.createStep;
      return `<div style="display:flex;align-items:center;flex:1;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.78rem;font-weight:700;transition:all .2s;
            background:${done?'#276749':active?'#0B1F3A':'#fff'};
            color:${done||active?'#fff':'#9CA3AF'};
            border:2px solid ${done?'#276749':active?'#0B1F3A':'#D5CCBA'};
            ${active?'box-shadow:0 0 0 4px rgba(11,31,58,.1)':''}">${done?'✓':n}</div>
          <span style="font-size:.76rem;font-weight:${active?'600':'400'};color:${active?'#0B1F3A':done?'#276749':'#9CA3AF'};">${lbl}</span>
        </div>
        ${n<4?`<div style="flex:1;height:2px;margin:0 12px;background:${done?'#276749':'#EDE6D9'};"></div>`:''}
      </div>`;
    }).join('');

    let stepContent = '';
    if (S.createStep === 1) stepContent = VIEWS.createStep1();
    else if (S.createStep === 2) stepContent = VIEWS.createStep2();
    else if (S.createStep === 3) stepContent = VIEWS.createStep3();
    else stepContent = VIEWS.createStep4();

    render(`
    ${HEADER()}
    ${_datalists}
    <div style="max-width:820px;margin:0 auto;padding:32px 28px;">
      <div style="margin-bottom:6px;"><a onclick="location.hash='/dashboard'" style="font-size:.76rem;color:#9CA3AF;cursor:pointer;">← Dashboard</a></div>
      <h1 style="font-family:'Cormorant Garamond',serif;font-size:2rem;font-weight:600;color:#0B1F3A;margin-bottom:24px;">New Scheduling Event
        <span style="font-size:.8rem;font-weight:600;padding:3px 10px;border-radius:20px;vertical-align:middle;margin-left:10px;${isPoll?'background:#EDE9FE;color:#5B21B6':'background:#DBEAFE;color:#1E40AF'};">${isPoll?'📊 Poll Mode':'📋 Propose Mode'}</span>
      </h1>
      <div style="display:flex;align-items:center;margin-bottom:32px;">${stepHTML}</div>
      <div style="background:#fff;border-radius:14px;border:1px solid #EDE6D9;box-shadow:0 2px 8px rgba(11,31,58,.06);overflow:hidden;">
        ${stepContent}
      </div>
    </div>`);
  },

  createStep0() {
    const mode = S.createData?.mode || '';
    const card = (m, icon, title, desc) => `
      <button onclick="CREATE_selectMode('${m}')" style="padding:28px 22px;border:2px solid ${mode===m?'#0B1F3A':'#D5CCBA'};border-radius:14px;background:${mode===m?'#EBF0F7':'#fff'};cursor:pointer;text-align:left;transition:all .2s;font-family:'Montserrat',sans-serif;width:100%;" onmouseover="if('${m}'!=='${mode}')this.style.borderColor='#9CA3AF'" onmouseout="if('${m}'!=='${mode}')this.style.borderColor='#D5CCBA'">
        <div style="font-size:2.2rem;margin-bottom:14px;">${icon}</div>
        <div style="font-family:'Cormorant Garamond',serif;font-size:1.25rem;font-weight:600;color:#0B1F3A;margin-bottom:8px;">${title}</div>
        <div style="font-size:.79rem;color:#6B7280;line-height:1.65;">${desc}</div>
        ${mode===m ? `<div style="margin-top:14px;display:inline-flex;align-items:center;gap:5px;font-size:.72rem;font-weight:700;color:#0B1F3A;letter-spacing:.04em;text-transform:uppercase;border-bottom:2px solid #C09D5F;padding-bottom:1px;">Selected ✓</div>` : ''}
      </button>`;
    return `
    <div style="padding:36px 32px;">
      <h3 style="font-family:'Cormorant Garamond',serif;font-size:1.5rem;font-weight:600;color:#0B1F3A;margin-bottom:4px;">How would you like to schedule?</h3>
      <div style="width:48px;height:2px;background:#C09D5F;margin-bottom:24px;"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:8px;">
        ${card('propose','📋','Propose Meeting Times','You select specific dates and times. Participants respond to confirm availability for each proposed slot. Best for when you have set times in mind.')}
        ${card('poll','📊','Poll for Availability','Set a date range. Participants mark when they\'re free using a morning/afternoon grid. The system finds a time that works for everyone.')}
      </div>
    </div>
    <div style="padding:18px 28px;border-top:1px solid #EDE6D9;background:#F6F1E9;border-radius:0 0 14px 14px;display:flex;justify-content:flex-end;">
      <button onclick="CREATE_next0()" style="padding:11px 28px;border:none;border-radius:8px;font-size:.8rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;background:#0B1F3A;color:#fff;font-family:'Montserrat',sans-serif;">Continue →</button>
    </div>`;
  },

  createStep1() {
    const cd = S.createData;
    return `
    <div style="padding:28px;">
      <h3 style="font-family:'Cormorant Garamond',serif;font-size:1.4rem;font-weight:600;color:#0B1F3A;margin-bottom:4px;">Event Details</h3>
      <div style="width:40px;height:2px;background:#C09D5F;margin-bottom:20px;"></div>
      <div style="margin-bottom:18px;">
        <label style="display:block;font-size:.72rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:6px;">Proceeding Type <span style="color:#8B1C2E;">*</span></label>
        <select id="c-type" style="width:100%;padding:10px 14px;border:1.5px solid #D5CCBA;border-radius:8px;font-size:.875rem;font-family:'Montserrat',sans-serif;outline:none;" onfocus="this.style.borderColor='#0B1F3A'" onblur="this.style.borderColor='#D5CCBA'">
          <option value="">Select proceeding type…</option>
          ${Object.entries(EVENT_TYPES).map(([k,v])=>`<option value="${k}" ${cd.type===k?'selected':''}>${v.icon} ${v.label}</option>`).join('')}
        </select>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px;">
        <div>
          <label style="display:block;font-size:.72rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:6px;">Matter / Case Name <span style="color:#8B1C2E;">*</span></label>
          <input id="c-matter" type="text" list="dl-matters" placeholder="e.g. Hernandez v. Gulf Coast Properties" value="${esc(cd.matterName)}" style="width:100%;padding:10px 14px;border:1.5px solid #D5CCBA;border-radius:8px;font-size:.875rem;font-family:'Montserrat',sans-serif;outline:none;" onfocus="this.style.borderColor='#0B1F3A'" onblur="this.style.borderColor='#D5CCBA'" oninput="CREATE_autoFillCase(this.value)">
        </div>
        <div>
          <label style="display:block;font-size:.72rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:6px;">Case Number</label>
          <input id="c-case" type="text" list="dl-cases" placeholder="e.g. 2026-CV-0001" value="${esc(cd.caseNumber)}" style="width:100%;padding:10px 14px;border:1.5px solid #D5CCBA;border-radius:8px;font-size:.875rem;font-family:'Montserrat',sans-serif;outline:none;" onfocus="this.style.borderColor='#0B1F3A'" onblur="this.style.borderColor='#D5CCBA'" oninput="CREATE_autoFillCase(null,this.value)">
        </div>
      </div>
      <div style="margin-bottom:18px;">
        <label style="display:block;font-size:.72rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:6px;">Location Type <span style="color:#8B1C2E;">*</span></label>
        <div style="display:flex;gap:10px;">
          ${[['in-person','🏢 In-Person'],['video','📹 Video Conference'],['phone','📞 Phone']].map(([v,lbl])=>`
            <label style="flex:1;display:flex;align-items:center;gap:10px;padding:11px 14px;border:1.5px solid ${cd.location===v?'#0B1F3A':'#D5CCBA'};border-radius:8px;cursor:pointer;background:${cd.location===v?'#EBF0F7':'#fff'};font-size:.84rem;font-weight:${cd.location===v?'600':'400'};">
              <input type="radio" name="loc" value="${v}" ${cd.location===v?'checked':''} style="accent-color:#0B1F3A;" onchange="CREATE_togglePhoneField(this.value)"> ${lbl}
            </label>`).join('')}
        </div>
      </div>
      <div id="c-phone-row" style="margin-bottom:18px;${cd.location==='phone'?'':'display:none;'}">
        <label style="display:block;font-size:.72rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:6px;">Conference Call Number <span style="color:#8B1C2E;">*</span></label>
        <input id="c-phone" type="tel" placeholder="e.g. (239) 555-0100 · access code 1234#" value="${esc(cd.phoneNumber)}" style="width:100%;padding:10px 14px;border:1.5px solid #D5CCBA;border-radius:8px;font-size:.875rem;font-family:'Montserrat',sans-serif;outline:none;" onfocus="this.style.borderColor='#0B1F3A'" onblur="this.style.borderColor='#D5CCBA'">
      </div>
      <div style="margin-bottom:18px;">
        <label style="display:block;font-size:.72rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:6px;">Location Details / Address / Link</label>
        <input id="c-locdet" type="text" list="dl-locations" placeholder="Address, Zoom link, or additional call-in details" value="${esc(cd.locationDetails)}" style="width:100%;padding:10px 14px;border:1.5px solid #D5CCBA;border-radius:8px;font-size:.875rem;font-family:'Montserrat',sans-serif;outline:none;" onfocus="this.style.borderColor='#0B1F3A'" onblur="this.style.borderColor='#D5CCBA'">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px;">
        <div>
          <label style="display:block;font-size:.72rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:6px;">Response Deadline</label>
          <input id="c-deadline" type="date" value="${cd.deadline}" style="width:100%;padding:10px 14px;border:1.5px solid #D5CCBA;border-radius:8px;font-size:.875rem;font-family:'Montserrat',sans-serif;outline:none;" onfocus="this.style.borderColor='#0B1F3A'" onblur="this.style.borderColor='#D5CCBA'">
        </div>
      </div>
      <div style="margin-bottom:18px;">
        <label style="display:block;font-size:.72rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:6px;">Special Instructions / Notes</label>
        <textarea id="c-notes" placeholder="Any special instructions for participants…" style="width:100%;padding:10px 14px;border:1.5px solid #D5CCBA;border-radius:8px;font-size:.875rem;font-family:'Montserrat',sans-serif;outline:none;resize:vertical;min-height:80px;" onfocus="this.style.borderColor='#0B1F3A'" onblur="this.style.borderColor='#D5CCBA'">${esc(cd.notes)}</textarea>
      </div>
      <div style="margin-bottom:20px;">
        <label style="display:block;font-size:.72rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:6px;">Your Contact Phone <span style="font-weight:400;text-transform:none;letter-spacing:0;color:#9CA3AF;">(shown to participants in emails)</span></label>
        <input id="c-scheduler-phone" type="tel" placeholder="e.g. (239) 555-0100" value="${esc(cd.schedulerPhone || S.user?.phone || '')}" style="width:100%;padding:10px 14px;border:1.5px solid #D5CCBA;border-radius:8px;font-size:.875rem;font-family:'Montserrat',sans-serif;outline:none;" onfocus="this.style.borderColor='#0B1F3A'" onblur="this.style.borderColor='#D5CCBA'">
      </div>
    </div>
    <div style="padding:18px 28px;border-top:1px solid #EDE6D9;background:#F6F1E9;border-radius:0 0 14px 14px;display:flex;justify-content:flex-end;">
      <button onclick="CREATE_next1()" style="padding:11px 28px;border:none;border-radius:8px;font-size:.8rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;background:#0B1F3A;color:#fff;font-family:'Montserrat',sans-serif;">Continue: Participants →</button>
    </div>`;
  },

  createStep2() {
    const cd = S.createData;
    const pHTML = cd.participants.map((p,i)=>`
      <div style="background:#F6F1E9;border:1px solid #EDE6D9;border-radius:8px;padding:12px 16px;display:flex;align-items:center;gap:12px;margin-bottom:8px;">
        <div style="width:36px;height:36px;border-radius:50%;background:#0B1F3A;color:#C09D5F;font-family:'Cormorant Garamond',serif;font-size:.9rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${initials(p.name)}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:.86rem;font-weight:600;color:#0B1F3A;">${esc(p.name)}</div>
          <div style="font-size:.74rem;color:#9CA3AF;">${esc(p.email)} · ${ROLES[p.role]||p.role} ${p.organization?'· '+esc(p.organization):''}</div>
        </div>
        <button onclick="CREATE_removeParticipant(${i})" style="width:28px;height:28px;border:1px solid #EDE6D9;border-radius:50%;background:#fff;color:#9CA3AF;cursor:pointer;font-size:.9rem;display:flex;align-items:center;justify-content:center;">✕</button>
      </div>`).join('');
    return `
    <div style="padding:28px;">
      <h3 style="font-family:'Cormorant Garamond',serif;font-size:1.4rem;font-weight:600;color:#0B1F3A;margin-bottom:4px;">Add Participants</h3>
      <div style="width:40px;height:2px;background:#C09D5F;margin-bottom:20px;"></div>
      ${cd.participants.length ? `<div style="margin-bottom:20px;">${pHTML}</div>` : ''}
      <div style="border:1.5px dashed #D5CCBA;border-radius:10px;padding:20px;background:#FAFAF8;margin-bottom:8px;">
        <h4 style="font-size:.84rem;font-weight:600;color:#0B1F3A;margin-bottom:14px;">Add Participant</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div><label style="display:block;font-size:.7rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:5px;">Full Name *</label>
            <input id="np-name" type="text" list="dl-pnames" placeholder="Jane A. Smith" style="width:100%;padding:9px 12px;border:1.5px solid #D5CCBA;border-radius:7px;font-size:.84rem;font-family:'Montserrat',sans-serif;outline:none;" onfocus="this.style.borderColor='#0B1F3A'" onblur="this.style.borderColor='#D5CCBA'" oninput="CREATE_autoFillParticipant('name',this.value)"></div>
          <div><label style="display:block;font-size:.7rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:5px;">Email Address *</label>
            <input id="np-email" type="email" list="dl-pemails" placeholder="jane.smith@firm.com" style="width:100%;padding:9px 12px;border:1.5px solid #D5CCBA;border-radius:7px;font-size:.84rem;font-family:'Montserrat',sans-serif;outline:none;" onfocus="this.style.borderColor='#0B1F3A'" onblur="this.style.borderColor='#D5CCBA'" oninput="CREATE_autoFillParticipant('email',this.value)"></div>
          <div><label style="display:block;font-size:.7rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:5px;">Role *</label>
            <select id="np-role" style="width:100%;padding:9px 12px;border:1.5px solid #D5CCBA;border-radius:7px;font-size:.84rem;font-family:'Montserrat',sans-serif;outline:none;">
              <option value="">Select role…</option>
              ${Object.entries(ROLES).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}
            </select></div>
          <div><label style="display:block;font-size:.7rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:5px;">Organization</label>
            <input id="np-org" type="text" list="dl-porgs" placeholder="Firm / Company" style="width:100%;padding:9px 12px;border:1.5px solid #D5CCBA;border-radius:7px;font-size:.84rem;font-family:'Montserrat',sans-serif;outline:none;" onfocus="this.style.borderColor='#0B1F3A'" onblur="this.style.borderColor='#D5CCBA'"></div>
        </div>
        <button onclick="CREATE_addParticipant()" style="padding:9px 20px;border:none;border-radius:7px;font-size:.76rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;cursor:pointer;background:#C09D5F;color:#0B1F3A;font-family:'Montserrat',sans-serif;">+ Add Participant</button>
      </div>
      <p style="font-size:.76rem;color:#9CA3AF;">Each participant will receive an email invitation with a unique link to indicate their availability.</p>
    </div>
    <div style="padding:18px 28px;border-top:1px solid #EDE6D9;background:#F6F1E9;border-radius:0 0 14px 14px;display:flex;justify-content:space-between;">
      <button onclick="S.createStep=1;VIEWS.createEvent()" style="padding:11px 22px;border:1.5px solid #0B1F3A;border-radius:8px;font-size:.78rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;cursor:pointer;background:transparent;color:#0B1F3A;font-family:'Montserrat',sans-serif;">← Back</button>
      <button onclick="CREATE_next2()" style="padding:11px 28px;border:none;border-radius:8px;font-size:.8rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;background:#0B1F3A;color:#fff;font-family:'Montserrat',sans-serif;">Continue: Time Slots →</button>
    </div>`;
  },

  createStep3() {
    if (S.createData.mode === 'poll') return VIEWS.createStep3Poll();
    const cd = S.createData;
    const slotsHTML = cd.slots.map((s,i)=>`
      <div style="background:#F6F1E9;border:1px solid #EDE6D9;border-radius:8px;padding:11px 16px;display:flex;align-items:center;gap:16px;margin-bottom:8px;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:.95rem;font-weight:600;color:#0B1F3A;flex-shrink:0;min-width:150px;">${fmtDay(s.date)}</div>
        <div style="font-size:.8rem;color:#6B7280;flex:1;">${fmtTime(s.startTime)} – ${fmtTime(s.endTime)}</div>
        <button onclick="CREATE_removeSlot(${i})" style="width:26px;height:26px;border:1px solid #EDE6D9;border-radius:50%;background:#fff;color:#9CA3AF;cursor:pointer;font-size:.85rem;display:flex;align-items:center;justify-content:center;">✕</button>
      </div>`).join('');
    return `
    <div style="padding:28px;">
      <h3 style="font-family:'Cormorant Garamond',serif;font-size:1.4rem;font-weight:600;color:#0B1F3A;margin-bottom:4px;">Proposed Time Slots</h3>
      <div style="width:40px;height:2px;background:#C09D5F;margin-bottom:6px;"></div>
      <p style="font-size:.82rem;color:#6B7280;margin-bottom:20px;">Add at least 3 date and time options for participants to choose from. More options increase the likelihood of finding a mutual time.</p>
      ${cd.slots.length ? `<div style="margin-bottom:20px;">${slotsHTML}</div>` : ''}
      <div style="border:1.5px dashed #D5CCBA;border-radius:10px;padding:20px;background:#FAFAF8;margin-bottom:8px;">
        <h4 style="font-size:.84rem;font-weight:600;color:#0B1F3A;margin-bottom:14px;">Add Time Slot</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px;">
          <div><label style="display:block;font-size:.7rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:5px;">Date *</label>
            <input id="ns-date" type="date" style="width:100%;padding:9px 12px;border:1.5px solid #D5CCBA;border-radius:7px;font-size:.84rem;font-family:'Montserrat',sans-serif;outline:none;" onfocus="this.style.borderColor='#0B1F3A'" onblur="this.style.borderColor='#D5CCBA'"></div>
          <div><label style="display:block;font-size:.7rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:5px;">Start Time *</label>
            <input id="ns-start" type="time" style="width:100%;padding:9px 12px;border:1.5px solid #D5CCBA;border-radius:7px;font-size:.84rem;font-family:'Montserrat',sans-serif;outline:none;" onfocus="this.style.borderColor='#0B1F3A'" onblur="this.style.borderColor='#D5CCBA'" onchange="applySlotTimeDefault('ns-start','ns-end')"></div>
          <div><label style="display:block;font-size:.7rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:5px;">End Time *</label>
            <input id="ns-end" type="time" style="width:100%;padding:9px 12px;border:1.5px solid #D5CCBA;border-radius:7px;font-size:.84rem;font-family:'Montserrat',sans-serif;outline:none;" onfocus="this.style.borderColor='#0B1F3A'" onblur="this.style.borderColor='#D5CCBA'" onchange="applySlotTimeDefault('ns-end',null)"></div>
        </div>
        <button onclick="CREATE_addSlot()" style="padding:9px 20px;border:none;border-radius:7px;font-size:.76rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;cursor:pointer;background:#C09D5F;color:#0B1F3A;font-family:'Montserrat',sans-serif;">+ Add Slot</button>
      </div>
    </div>
    <div style="padding:18px 28px;border-top:1px solid #EDE6D9;background:#F6F1E9;border-radius:0 0 14px 14px;display:flex;justify-content:space-between;">
      <button onclick="S.createStep=2;VIEWS.createEvent()" style="padding:11px 22px;border:1.5px solid #0B1F3A;border-radius:8px;font-size:.78rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;cursor:pointer;background:transparent;color:#0B1F3A;font-family:'Montserrat',sans-serif;">← Back</button>
      <button onclick="CREATE_next3()" style="padding:11px 28px;border:none;border-radius:8px;font-size:.8rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;background:#0B1F3A;color:#fff;font-family:'Montserrat',sans-serif;">Review & Send →</button>
    </div>`;
  },

  createStep3Poll() {
    const cd = S.createData;
    const pr = cd.pollRange || {};
    return `
    <div style="padding:28px;">
      <h3 style="font-family:'Cormorant Garamond',serif;font-size:1.4rem;font-weight:600;color:#0B1F3A;margin-bottom:4px;">Set Availability Range</h3>
      <div style="width:40px;height:2px;background:#C09D5F;margin-bottom:6px;"></div>
      <p style="font-size:.82rem;color:#6B7280;margin-bottom:22px;">Specify the window of dates within which participants will mark their availability. The system will find a morning or afternoon block that works for everyone.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
        <div>
          <label style="display:block;font-size:.72rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:6px;">Earliest Possible Date <span style="color:#8B1C2E;">*</span></label>
          <input id="poll-start" type="date" value="${esc(pr.startDate||'')}" style="width:100%;padding:10px 14px;border:1.5px solid #D5CCBA;border-radius:8px;font-size:.875rem;font-family:'Montserrat',sans-serif;outline:none;" onfocus="this.style.borderColor='#0B1F3A'" onblur="this.style.borderColor='#D5CCBA'">
        </div>
        <div>
          <label style="display:block;font-size:.72rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:6px;">Latest Possible Date <span style="color:#8B1C2E;">*</span></label>
          <input id="poll-end" type="date" value="${esc(pr.endDate||'')}" style="width:100%;padding:10px 14px;border:1.5px solid #D5CCBA;border-radius:8px;font-size:.875rem;font-family:'Montserrat',sans-serif;outline:none;" onfocus="this.style.borderColor='#0B1F3A'" onblur="this.style.borderColor='#D5CCBA'">
        </div>
      </div>
      <div style="margin-bottom:20px;">
        <label style="display:block;font-size:.72rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:10px;">Time Blocks to Include</label>
        <div style="display:flex;gap:12px;">
          ${POLL.BLOCKS.map(blk => `
            <label style="display:flex;align-items:center;gap:10px;padding:12px 18px;border:1.5px solid #D5CCBA;border-radius:8px;cursor:pointer;background:#fff;flex:1;">
              <input type="checkbox" name="poll-block" value="${blk.id}" checked style="accent-color:#0B1F3A;width:15px;height:15px;">
              <span><div style="font-size:.84rem;font-weight:600;color:#0B1F3A;">${blk.label}</div><div style="font-size:.72rem;color:#9CA3AF;">${blk.short.replace('9a','9:00 AM').replace('12p','12:00 PM').replace('6p','6:00 PM').replace('–',' – ')}</div></span>
            </label>`).join('')}
        </div>
      </div>
      <label style="display:flex;align-items:center;gap:10px;font-size:.84rem;color:#4B5563;cursor:pointer;margin-bottom:8px;">
        <input type="checkbox" id="poll-weekdays" ${cd.pollWeekdaysOnly===false?'':'checked'} style="accent-color:#0B1F3A;width:15px;height:15px;">
        <span>Weekdays only (Monday – Friday)</span>
      </label>
    </div>
    <div style="padding:18px 28px;border-top:1px solid #EDE6D9;background:#F6F1E9;border-radius:0 0 14px 14px;display:flex;justify-content:space-between;">
      <button onclick="S.createStep=2;VIEWS.createEvent()" style="padding:11px 22px;border:1.5px solid #0B1F3A;border-radius:8px;font-size:.78rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;cursor:pointer;background:transparent;color:#0B1F3A;font-family:'Montserrat',sans-serif;">← Back</button>
      <button onclick="CREATE_next3Poll()" style="padding:11px 28px;border:none;border-radius:8px;font-size:.8rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;background:#0B1F3A;color:#fff;font-family:'Montserrat',sans-serif;">Review & Send →</button>
    </div>`;
  },

  createStep4() {
    const cd = S.createData;
    const et = EVENT_TYPES[cd.type] || { label:'—', icon:'📅' };
    const isPoll = cd.mode === 'poll';
    const slotBlock = isPoll
      ? `<div style="background:#F6F1E9;border-radius:10px;padding:18px;margin-bottom:8px;">
          <div style="font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9CA3AF;margin-bottom:12px;">Availability Range</div>
          <div style="font-size:.82rem;color:#0B1F3A;margin-bottom:4px;"><strong>From:</strong> ${fmtDateShort(cd.pollRange.startDate)}</div>
          <div style="font-size:.82rem;color:#0B1F3A;margin-bottom:4px;"><strong>To:</strong> ${fmtDateShort(cd.pollRange.endDate)}</div>
          <div style="font-size:.82rem;color:#0B1F3A;"><strong>Days:</strong> ${cd.pollWeekdaysOnly===false?'All days':'Weekdays only'}</div>
          <div style="margin-top:10px;font-size:.78rem;color:#6B7280;">Participants will receive a grid of 30-minute time slots for each day. They click the blocks when they're free, and the system finds the best mutual slot.</div>
        </div>`
      : `<div style="background:#F6F1E9;border-radius:10px;padding:18px;margin-bottom:8px;">
          <div style="font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9CA3AF;margin-bottom:12px;">Proposed Time Slots (${cd.slots.length})</div>
          ${cd.slots.map(s=>`<div style="display:flex;gap:16px;font-size:.82rem;color:#0B1F3A;margin-bottom:6px;"><span style="font-weight:600;min-width:160px;">${fmtDay(s.date)}</span><span style="color:#6B7280;">${fmtTime(s.startTime)} – ${fmtTime(s.endTime)}</span></div>`).join('')}
        </div>`;
    return `
    <div style="padding:28px;">
      <h3 style="font-family:'Cormorant Garamond',serif;font-size:1.4rem;font-weight:600;color:#0B1F3A;margin-bottom:4px;">Review & Send Invitations</h3>
      <div style="width:40px;height:2px;background:#C09D5F;margin-bottom:20px;"></div>
      <div style="background:#EBF0F7;border:1px solid #BFCCDD;border-radius:10px;padding:16px 20px;margin-bottom:20px;font-size:.84rem;color:#1A4A7A;display:flex;gap:10px;">
        <span>ℹ️</span><span>Please review all details carefully. Once you click <strong>Send Invitations</strong>, all participants will immediately receive their scheduling invitations via email.</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
        <div style="background:#F6F1E9;border-radius:10px;padding:18px;">
          <div style="font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9CA3AF;margin-bottom:12px;">Event Details</div>
          <div style="font-family:'Cormorant Garamond',serif;font-size:1.15rem;font-weight:600;color:#0B1F3A;margin-bottom:8px;">${esc(cd.matterName)}</div>
          <div style="font-size:.8rem;color:#4B5563;margin-bottom:4px;"><strong>Type:</strong> ${et.icon} ${et.label}</div>
          <div style="font-size:.8rem;color:#4B5563;margin-bottom:4px;"><strong>Case No.:</strong> ${esc(cd.caseNumber||'—')}</div>
          <div style="font-size:.8rem;color:#4B5563;margin-bottom:4px;"><strong>Location:</strong> ${cd.location.replace('-',' ')}</div>
          ${cd.location==='phone'&&cd.phoneNumber?`<div style="font-size:.8rem;color:#4B5563;margin-bottom:4px;"><strong>Call Number:</strong> 📞 ${esc(cd.phoneNumber)}</div>`:''}
          ${cd.locationDetails?`<div style="font-size:.8rem;color:#4B5563;margin-bottom:4px;"><strong>Details:</strong> ${esc(cd.locationDetails)}</div>`:''}
          ${cd.deadline?`<div style="font-size:.8rem;color:#4B5563;"><strong>Response Deadline:</strong> ${fmtDateShort(cd.deadline)}</div>`:''}
        </div>
        <div style="background:#F6F1E9;border-radius:10px;padding:18px;">
          <div style="font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9CA3AF;margin-bottom:12px;">Participants (${cd.participants.length})</div>
          ${cd.participants.map(p=>`<div style="font-size:.82rem;color:#0B1F3A;margin-bottom:6px;"><strong>${esc(p.name)}</strong> <span style="color:#9CA3AF;">${ROLES[p.role]||p.role}</span></div>`).join('')}
        </div>
      </div>
      ${slotBlock}
    </div>
    <div style="padding:18px 28px;border-top:1px solid #EDE6D9;background:#F6F1E9;border-radius:0 0 14px 14px;display:flex;justify-content:space-between;">
      <button onclick="S.createStep=3;VIEWS.createEvent()" style="padding:11px 22px;border:1.5px solid #0B1F3A;border-radius:8px;font-size:.78rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;cursor:pointer;background:transparent;color:#0B1F3A;font-family:'Montserrat',sans-serif;">← Back</button>
      <button onclick="CREATE_submit()" style="padding:11px 32px;border:none;border-radius:8px;font-size:.82rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;background:#C09D5F;color:#0B1F3A;font-family:'Montserrat',sans-serif;box-shadow:0 4px 12px rgba(192,157,95,.3);">Send Invitations ✉</button>
    </div>`;
  },


  /* ── Event Detail ── */
  eventDetail(id) {
    S.view = 'eventDetail';
    S.currentEventId = id;
    const ev = S.events.find(e=>e.id===id);
    if (!ev) { toast('Event not found.','error'); return ROUTER.go('/dashboard'); }
    const et = EVENT_TYPES[ev.type] || { label:'Event', icon:'📅', color:'#374151', bg:'#F3F4F6' };
    const confirmed = ev.confirmedSlot ? ev.proposedSlots.find(s=>s.id===ev.confirmedSlot) : null;
    const best = AVAIL.bestSlots(ev);
    const responded = ev.participants.filter(p=>p.status!=='pending').length;
    const statusBadges = { active:'background:#D1FAE5;color:#065F46', confirmed:'background:#DBEAFE;color:#1E40AF', 'no-match':'background:#FEE2E2;color:#991B1B', draft:'background:#F3F4F6;color:#374151', expired:'background:#FEF3C7;color:#92400E' };
    const deadline = ev.deadline ? daysDiff(ev.deadline) : null;

    // Build availability grid
    const gridRows = ev.participants.map(p => {
      const cells = ev.proposedSlots.map(s => {
        const av = p.availability[s.id] || '';
        const isBest = best[0]?.id === s.id;
        const isConfirmed = ev.confirmedSlot === s.id;
        return `<td class="avail-cell-td ${AVAIL_CLASS[av]} ${isConfirmed?'cell-confirmed-outline':''}" 
          title="${p.name}: ${av||'No response'}" 
          onclick="DETAIL_toggleCell('${ev.id}','${p.id}','${s.id}')">
          <div class="cell-icon">${av ? AVAIL_ICON[av] : ''}</div>
        </td>`;
      }).join('');
      const statusStyle = { responded:'background:#D1FAE5;color:#065F46', 'manually-entered':'background:#EDE9FE;color:#5B21B6', pending:'background:#FEF9C3;color:#854D0E' };
      return `<tr>
        <td class="avail-name-cell">
          <div class="p-name">${esc(p.name)}</div>
          <div class="p-role">${ROLES[p.role]||p.role}</div>
          ${p.organization?`<div class="p-org">${esc(p.organization)}</div>`:''}
          <span style="display:inline-block;margin-top:3px;padding:2px 7px;border-radius:10px;font-size:.62rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;${statusStyle[p.status]||statusStyle.pending}">${p.status.replace('-',' ')}</span>
        </td>
        ${cells}
      </tr>`;
    }).join('');

    // Summary row
    const summaryRow = `<tr>
      <td class="avail-name-cell" style="font-size:.75rem;font-weight:700;color:#0B1F3A;text-transform:uppercase;letter-spacing:.05em;">Availability</td>
      ${ev.proposedSlots.map(s => {
        const sc = AVAIL.score(ev, s.id);
        const isBest = best[0]?.id === s.id && sc.available > 0;
        return `<td class="avail-sum-label ${isBest?'cell-avail':''}">
          <span class="sum-count">${sc.available}/${ev.participants.filter(p=>p.status!=='pending').length}</span>
          <span class="sum-pct">${sc.pct}%</span>
        </td>`;
      }).join('')}
    </tr>`;

    render(`
    ${HEADER()}
    <div style="max-width:1300px;margin:0 auto;padding:32px 28px;">
      <!-- Breadcrumb -->
      <div style="display:flex;align-items:center;gap:6px;font-size:.74rem;color:#9CA3AF;margin-bottom:10px;">
        <a onclick="location.hash='/dashboard'" style="color:#9e7e3f;cursor:pointer;">Dashboard</a>
        <span>›</span><span>Event Detail</span>
      </div>
      <!-- Event header -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;gap:20px;flex-wrap:wrap;">
        <div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap;">
            <span style="padding:4px 12px;border-radius:4px;font-size:.68rem;font-weight:600;letter-spacing:.05em;text-transform:uppercase;background:${et.bg};color:${et.color};">${et.icon} ${et.label}</span>
            <span style="display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;font-size:.68rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;${statusBadges[ev.status]||statusBadges.draft}">${ev.status.replace('-',' ')}</span>
          </div>
          <h1 style="font-family:'Cormorant Garamond',serif;font-size:2rem;font-weight:600;color:#0B1F3A;line-height:1.1;margin-bottom:8px;">${esc(ev.matterName)}</h1>
          <div style="display:flex;gap:18px;flex-wrap:wrap;">
            ${ev.caseNumber?`<span style="font-size:.78rem;color:#9CA3AF;">📁 Case No. ${esc(ev.caseNumber)}</span>`:''}
            <span style="font-size:.78rem;color:#9CA3AF;">👥 ${responded}/${ev.participants.length} responded</span>
            ${ev.location?`<span style="font-size:.78rem;color:#9CA3AF;">📍 ${ev.location.replace('-',' ')}</span>`:''}
            ${deadline!==null?`<span style="font-size:.78rem;color:${deadline<0?'#DC2626':deadline<=2?'#D97706':'#9CA3AF'};">⏱ ${deadline<0?'Deadline passed':deadline===0?'Due today':`${deadline} days remaining`}</span>`:''}
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;flex-shrink:0;">
          <button onclick="EMAIL.previewModal('${ev.id}','invitation')" style="padding:9px 16px;border:1px solid #EDE6D9;border-radius:8px;font-size:.74rem;font-weight:600;background:#fff;color:#4B5563;cursor:pointer;font-family:'Montserrat',sans-serif;">📧 Email Preview</button>
          <button onclick="EMAIL.sendReminderAll('${ev.id}');VIEWS.eventDetail('${ev.id}')" style="padding:9px 16px;border:1px solid #EDE6D9;border-radius:8px;font-size:.74rem;font-weight:600;background:#fff;color:#4B5563;cursor:pointer;font-family:'Montserrat',sans-serif;">📣 Remind All</button>
          ${ev.status !== 'confirmed' ? `<button onclick="VIEWS.confirmSlotModal('${ev.id}')" style="padding:9px 16px;border:none;border-radius:8px;font-size:.74rem;font-weight:700;background:#C09D5F;color:#0B1F3A;cursor:pointer;font-family:'Montserrat',sans-serif;">✓ Confirm Time</button>` : ''}
          <button onclick="VIEWS.restartModal('${ev.id}')" style="padding:9px 16px;border:1px solid #FCA5A5;border-radius:8px;font-size:.74rem;font-weight:600;background:#FBE9EC;color:#8B1C2E;cursor:pointer;font-family:'Montserrat',sans-serif;">🔄 Restart</button>
          <button onclick="VIEWS.deleteEventModal('${ev.id}')" style="padding:9px 16px;border:1px solid #FCA5A5;border-radius:8px;font-size:.74rem;font-weight:600;background:#fff;color:#8B1C2E;cursor:pointer;font-family:'Montserrat',sans-serif;">🗑 Delete</button>
        </div>
      </div>

      ${confirmed ? `
        <div style="background:linear-gradient(135deg,#0B1F3A,#162d52);border:2px solid #C09D5F;border-radius:12px;padding:22px 26px;display:flex;align-items:center;gap:18px;margin-bottom:24px;">
          <div style="font-size:2rem;">✅</div>
          <div>
            <div style="font-size:.62rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#C09D5F;margin-bottom:4px;">Confirmed Meeting Date</div>
            <div style="font-family:'Cormorant Garamond',serif;font-size:1.5rem;font-weight:600;color:#fff;">${fmtDate(confirmed.date)}</div>
            <div style="font-size:.84rem;color:rgba(255,255,255,.65);margin-top:3px;">${fmtTime(confirmed.startTime)} – ${fmtTime(confirmed.endTime)} Eastern · ${esc(ev.location==='phone'&&ev.phoneNumber ? '📞 '+ev.phoneNumber : ev.locationDetails||ev.location)}</div>
          </div>
          <div style="margin-left:auto;">
            <button onclick="EMAIL.previewModal('${ev.id}','confirmation')" style="padding:9px 18px;border:1px solid rgba(192,157,95,.5);border-radius:8px;font-size:.74rem;font-weight:600;background:transparent;color:#C09D5F;cursor:pointer;font-family:'Montserrat',sans-serif;">View Confirmation Email</button>
          </div>
        </div>` : ''}

      ${ev.status === 'no-match' ? `
        <div style="background:#FBE9EC;border:1.5px solid #FCA5A5;border-radius:12px;padding:18px 22px;display:flex;align-items:center;gap:14px;margin-bottom:24px;">
          <div style="font-size:1.6rem;">⚠️</div>
          <div style="flex:1;">
            <div style="font-size:.82rem;font-weight:600;color:#7F1D1D;margin-bottom:3px;">No Mutual Availability Found</div>
            <div style="font-size:.78rem;color:#991B1B;">All parties have responded but no common date was identified. All participants have been notified. Please restart the process with new proposed dates.</div>
          </div>
          <button onclick="VIEWS.restartModal('${ev.id}')" style="padding:9px 18px;border:none;border-radius:8px;font-size:.74rem;font-weight:700;background:#8B1C2E;color:#fff;cursor:pointer;font-family:'Montserrat',sans-serif;white-space:nowrap;">Restart Process</button>
        </div>` : ''}

      <div style="display:grid;grid-template-columns:1fr 320px;gap:20px;align-items:start;">
        <!-- Main grid — branches on mode -->
        <div>
          ${ev.mode === 'poll' ? `
          <!-- POLL MODE: aggregate grid -->
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:10px;">
            <h3 style="font-family:'Cormorant Garamond',serif;font-size:1.3rem;font-weight:600;color:#0B1F3A;">Availability Poll Grid</h3>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <span style="display:flex;align-items:center;gap:5px;font-size:.74rem;color:#4B5563;"><span style="width:14px;height:14px;background:#DCFCE7;border:1.5px solid #16A34A;border-radius:3px;display:inline-block;"></span> All available</span>
              <span style="display:flex;align-items:center;gap:5px;font-size:.74rem;color:#4B5563;"><span style="width:14px;height:14px;background:#FEF3C7;border-radius:3px;display:inline-block;"></span> Some available</span>
              <span style="display:flex;align-items:center;gap:5px;font-size:.74rem;color:#4B5563;"><span style="width:14px;height:14px;background:#F9FAFB;border-radius:3px;display:inline-block;"></span> None available</span>
            </div>
          </div>
          ${ev.status !== 'confirmed' ? `
          <div style="background:#F0FDF4;border:1px solid #86EFAC;border-radius:10px;padding:13px 16px;margin-bottom:14px;font-size:.82rem;color:#166534;display:flex;gap:8px;align-items:center;">
            <span>💡</span><span>Cells show <strong>available / responded</strong>. Green-bordered cells mean everyone who has responded is free — click to confirm. You can also schedule any slot regardless of availability.</span>
          </div>` : ''}
          ${POLL.renderGrid(ev, { isAdmin: true })}
          ${ev.status === 'active' || ev.status === 'no-match' ? `
          <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;">
            <button onclick="POLL_setNoMatch('${ev.id}')" style="padding:8px 18px;border:1px solid #EDE6D9;border-radius:7px;font-size:.76rem;font-weight:600;background:#fff;color:#6B7280;cursor:pointer;font-family:'Montserrat',sans-serif;">Mark No Match</button>
            <span style="font-size:.74rem;color:#9CA3AF;align-self:center;">← Click any cell in the bottom row to confirm that slot, or use this to declare no match.</span>
          </div>` : ''}
          <p style="font-size:.72rem;color:#9CA3AF;margin-top:8px;">Click <strong>Edit</strong> next to any participant to enter or change their availability on their behalf.</p>
          ` : `
          <!-- PROPOSE MODE: classic grid -->
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <h3 style="font-family:'Cormorant Garamond',serif;font-size:1.3rem;font-weight:600;color:#0B1F3A;">Availability Grid</h3>
            <div style="display:flex;gap:12px;font-size:.74rem;color:#9CA3AF;">
              <span style="display:flex;align-items:center;gap:5px;"><span style="width:14px;height:14px;background:#D1FAE5;border-radius:3px;display:inline-block;"></span> Available</span>
              <span style="display:flex;align-items:center;gap:5px;"><span style="width:14px;height:14px;background:#FEE2E2;border-radius:3px;display:inline-block;"></span> Unavailable</span>
              <span style="display:flex;align-items:center;gap:5px;"><span style="width:14px;height:14px;background:#FEF3C7;border-radius:3px;display:inline-block;"></span> If Needed</span>
            </div>
          </div>
          <div class="avail-table-wrap" style="border:1px solid #EDE6D9;border-radius:10px;box-shadow:0 2px 8px rgba(11,31,58,.06);">
            <table class="avail-table">
              <thead>
                <tr>
                  <th class="avail-head-name">Participant</th>
                  ${ev.proposedSlots.map((s,i) => {
                    const isBest = best[0]?.id === s.id && best[0]?.score?.available > 0;
                    const isConf = ev.confirmedSlot === s.id;
                    return `<th class="avail-head-slot ${isBest?'best':''}" style="${isConf?'background:#C09D5F;':''}">
                      <span class="slot-day">${new Date(s.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short'})}</span>
                      <span class="slot-date">${new Date(s.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
                      <span class="slot-time">${fmtTime(s.startTime)}</span>
                      ${isBest && !isConf ? '<span class="best-pill">Best Match</span>' : ''}
                      ${isConf ? '<span class="best-pill" style="background:rgba(255,255,255,.3);color:#0B1F3A;">✓ Confirmed</span>' : ''}
                    </th>`;
                  }).join('')}
                </tr>
              </thead>
              <tbody>
                ${gridRows}
                ${summaryRow}
              </tbody>
            </table>
          </div>
          <p style="font-size:.72rem;color:#9CA3AF;margin-top:8px;">Click any cell to manually enter or change availability on behalf of a participant.</p>
          `}
        </div>
        <!-- Sidebar -->
        <div style="display:flex;flex-direction:column;gap:16px;">
          <!-- Participants panel -->
          <div style="background:#fff;border-radius:12px;border:1px solid #EDE6D9;box-shadow:0 1px 4px rgba(11,31,58,.05);overflow:hidden;">
            <div style="padding:16px 18px;border-bottom:1px solid #EDE6D9;display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <h4 style="font-family:'Cormorant Garamond',serif;font-size:1.1rem;font-weight:600;color:#0B1F3A;">Participants</h4>
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:.74rem;color:#9CA3AF;">${responded}/${ev.participants.length} responded</span>
                ${ev.status !== 'archived' ? `<button onclick="EVENTS_addParticipantModal('${ev.id}')" style="padding:4px 10px;border:1.5px solid #C09D5F;border-radius:6px;background:#fff;color:#9e7e3f;font-size:.68rem;font-weight:700;cursor:pointer;font-family:'Montserrat',sans-serif;letter-spacing:.03em;white-space:nowrap;" onmouseover="this.style.background='#FDF8EF'" onmouseout="this.style.background='#fff'">+ Add</button>` : ''}
              </div>
            </div>
            <div style="padding:14px 18px;">
              ${ev.participants.map(p => {
                const statusCol = { responded:'#D1FAE5:#065F46', 'manually-entered':'#EDE9FE:#5B21B6', pending:'#FEF9C3:#854D0E' }[p.status] || '#F3F4F6:#374151';
                const [sbg,scolor] = statusCol.split(':');
                return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #F6F1E9;">
                  <div style="width:32px;height:32px;border-radius:50%;background:#0B1F3A;color:#C09D5F;font-family:'Cormorant Garamond',serif;font-size:.8rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${initials(p.name)}</div>
                  <div style="flex:1;min-width:0;">
                    <div style="font-size:.82rem;font-weight:600;color:#0B1F3A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.name)}</div>
                    <div style="font-size:.68rem;color:#9CA3AF;">${ROLES[p.role]||p.role}</div>
                    <span style="display:inline-block;padding:1px 7px;border-radius:10px;font-size:.6rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;background:${sbg};color:${scolor};">${p.status.replace('-',' ')}</span>
                  </div>
                  ${p.status === 'pending' ? `<button onclick="EMAIL.sendReminder('${ev.id}','${p.id}');VIEWS.eventDetail('${ev.id}')" title="Send reminder" style="width:26px;height:26px;border:1px solid #EDE6D9;border-radius:6px;background:#fff;font-size:.75rem;cursor:pointer;color:#4B5563;" onmouseover="this.style.background='#F6F1E9'" onmouseout="this.style.background='#fff'">📧</button>` : ''}
                  <button onclick="EVENTS_editParticipantEmailModal('${ev.id}','${p.id}')" title="Edit email address" style="width:26px;height:26px;border:1px solid #EDE6D9;border-radius:6px;background:#fff;font-size:.75rem;cursor:pointer;color:#4B5563;" onmouseover="this.style.background='#F6F1E9'" onmouseout="this.style.background='#fff'">@</button>
                  <button onclick="VIEWS.manualEntryModal('${ev.id}','${p.id}')" title="Manual entry" style="width:26px;height:26px;border:1px solid #EDE6D9;border-radius:6px;background:#fff;font-size:.75rem;cursor:pointer;color:#4B5563;" onmouseover="this.style.background='#F6F1E9'" onmouseout="this.style.background='#fff'">✏️</button>
                </div>`;
              }).join('')}
            </div>
          </div>
          <!-- Event info panel -->
          <div style="background:#fff;border-radius:12px;border:1px solid #EDE6D9;box-shadow:0 1px 4px rgba(11,31,58,.05);overflow:hidden;">
            <div style="padding:16px 18px;border-bottom:1px solid #EDE6D9;">
              <h4 style="font-family:'Cormorant Garamond',serif;font-size:1.1rem;font-weight:600;color:#0B1F3A;">Event Info</h4>
            </div>
            <div style="padding:14px 18px;font-size:.82rem;color:#4B5563;">
              ${ev.location==='phone'&&ev.phoneNumber?`<div style="margin-bottom:8px;"><strong>📞 Call Number:</strong> ${esc(ev.phoneNumber)}</div>`:''}
              ${ev.locationDetails?`<div style="margin-bottom:8px;"><strong>Location:</strong> ${esc(ev.locationDetails)}</div>`:''}
              ${ev.notes?`<div style="margin-bottom:8px;"><strong>Notes:</strong> ${esc(ev.notes)}</div>`:''}
              <div><strong>Created:</strong> ${fmtDateShort(new Date(ev.createdAt).toISOString().slice(0,10))}</div>
            </div>
          </div>
          <!-- History -->
          <div style="background:#fff;border-radius:12px;border:1px solid #EDE6D9;box-shadow:0 1px 4px rgba(11,31,58,.05);overflow:hidden;">
            <div style="padding:16px 18px;border-bottom:1px solid #EDE6D9;">
              <h4 style="font-family:'Cormorant Garamond',serif;font-size:1.1rem;font-weight:600;color:#0B1F3A;">Activity Log</h4>
            </div>
            <div style="padding:14px 18px;max-height:240px;overflow-y:auto;">
              ${(ev.history||[]).slice().reverse().map(h=>`
                <div class="hist-item"><div class="hist-dot"></div><span class="hist-time">${fmtTS(h.ts)}</span><span class="hist-txt">${esc(h.action)}</span></div>`).join('')||'<p style="font-size:.8rem;color:#9CA3AF;">No activity yet.</p>'}
            </div>
          </div>
        </div>
      </div>
    </div>`);
  },

  confirmSlotModal(eventId) {
    const ev = S.events.find(e=>e.id===eventId);
    if (!ev) return;
    const best = AVAIL.bestSlots(ev);
    const totalResponded = ev.participants.filter(p=>p.status!=='pending').length;
    const perfect = best.filter(s => s.score.available === totalResponded && totalResponded > 0);
    const others  = best.filter(s => s.score.available < totalResponded || totalResponded === 0);

    const slotCard = (s, isPerfect) => {
      const sc = s.score;
      const border = isPerfect ? '#2D7A4F' : '#EDE6D9';
      const bg     = isPerfect ? '#F0FDF4' : '#fff';
      return `<div onclick="closeModal();EVENTS.confirm('${eventId}','${s.id}')" style="border:2px solid ${border};border-radius:10px;padding:14px 18px;margin-bottom:10px;cursor:pointer;background:${bg};transition:all .2s;" onmouseover="this.style.borderColor='#C09D5F';this.style.background='#F5EDD8'" onmouseout="this.style.borderColor='${border}';this.style.background='${bg}'">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-family:'Cormorant Garamond',serif;font-size:1.1rem;font-weight:600;color:#0B1F3A;">${fmtDate(s.date)}</div>
            <div style="font-size:.8rem;color:#6B7280;">${fmtTime(s.startTime)} – ${fmtTime(s.endTime)}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:.9rem;font-weight:700;color:${sc.available>0?'#276749':'#9CA3AF'};">${sc.available}/${totalResponded} available</div>
            ${isPerfect?'<div style="font-size:.68rem;font-weight:700;color:#2D7A4F;text-transform:uppercase;letter-spacing:.06em;">All Available</div>':''}
          </div>
        </div>
      </div>`;
    };

    const perfectSection = perfect.length ? `
      ${perfect.length > 1 ? `<p style="font-size:.74rem;font-weight:700;color:#2D7A4F;text-transform:uppercase;letter-spacing:.06em;margin:0 0 10px;">${perfect.length} times work for everyone</p>` : ''}
      ${perfect.map(s => slotCard(s, true)).join('')}` : '';

    const othersSection = others.length ? `
      ${perfect.length ? `<p style="font-size:.74rem;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.06em;margin:${perfect.length?'14px':'0'} 0 10px;">Partial availability</p>` : ''}
      ${others.map(s => slotCard(s, false)).join('')}` : '';

    modal.open(`
      <div class="modal-header"><h3 class="modal-title">Confirm a Time Slot</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
      <div class="modal-body">
        <p style="font-size:.84rem;color:#4B5563;margin-bottom:18px;">Select the time slot you wish to confirm. A confirmation email will be sent to all participants.</p>
        ${perfectSection}${othersSection}
      </div>
      <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button></div>`);
  },

  restartModal(eventId) {
    modal.open(`
      <div class="modal-header"><h3 class="modal-title">Restart Scheduling Process</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
      <div class="modal-body">
        <div style="background:#FBE9EC;border:1px solid #FCA5A5;border-radius:8px;padding:14px 18px;margin-bottom:18px;font-size:.84rem;color:#7F1D1D;border-left:3px solid #8B1C2E;">
          <strong>Warning:</strong> This will clear all participant responses and time slots. All parties will be notified that a new scheduling process is underway.
        </div>
        <p style="font-size:.84rem;color:#4B5563;">Are you certain you wish to restart the scheduling process for this matter? You will need to propose new dates and re-send invitations.</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
        <button class="btn btn-danger" onclick="closeModal();EVENTS.restart('${eventId}')">Confirm Restart</button>
      </div>`);
  },

  deleteEventModal(eventId) {
    const ev = S.events.find(e=>e.id===eventId);
    if (!ev) return;
    modal.open(`
      <div class="modal-header" style="background:#8B1C2E;border-radius:18px 18px 0 0;">
        <h3 class="modal-title" style="color:#fff;">Delete Scheduling Event</h3>
        <button class="modal-close" style="background:rgba(255,255,255,.15);color:#fff;border:none;" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div style="text-align:center;padding:8px 0 20px;">
          <div style="font-size:2.8rem;margin-bottom:12px;">🗑</div>
          <h4 style="font-family:'Cormorant Garamond',serif;font-size:1.3rem;color:#0B1F3A;margin:0 0 8px 0;">Are you sure you want to delete this event?</h4>
          <p style="font-size:.84rem;color:#6B7280;max-width:360px;margin:0 auto 20px;">This will permanently remove the following scheduling event and all associated participant data, availability responses, and email history.</p>
          <div style="background:#F6F1E9;border:1px solid #EDE6D9;border-left:4px solid #8B1C2E;border-radius:8px;padding:14px 18px;text-align:left;margin-bottom:4px;">
            <div style="font-family:'Cormorant Garamond',serif;font-size:1.05rem;font-weight:700;color:#0B1F3A;">${esc(ev.matterName)}</div>
            <div style="font-size:.76rem;color:#9CA3AF;margin-top:3px;">${esc(ev.caseNumber||'No Case No.')} &nbsp;·&nbsp; ${EVENT_TYPES[ev.type]?.label||ev.type} &nbsp;·&nbsp; ${ev.participants.length} participant(s)</div>
          </div>
        </div>
        <div style="background:#FBE9EC;border:1px solid #FCA5A5;border-radius:8px;padding:12px 16px;font-size:.8rem;color:#7F1D1D;">
          <strong>This action cannot be undone.</strong> All data associated with this event will be permanently deleted.
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
        <button class="btn btn-danger" onclick="VIEWS.deleteEventPassword('${eventId}')">Yes, Delete This Event</button>
      </div>`);
  },

  deleteEventPassword(eventId) {
    const ev = S.events.find(e=>e.id===eventId);
    if (!ev) return;
    modal.open(`
      <div class="modal-header" style="background:#8B1C2E;border-radius:18px 18px 0 0;">
        <h3 class="modal-title" style="color:#fff;">Confirm Your Identity</h3>
        <button class="modal-close" style="background:rgba(255,255,255,.15);color:#fff;border:none;" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div style="text-align:center;padding:8px 0 20px;">
          <div style="width:52px;height:52px;border-radius:50%;background:#FBE9EC;border:2px solid #FCA5A5;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;">🔒</div>
          <h4 style="font-family:'Cormorant Garamond',serif;font-size:1.2rem;color:#0B1F3A;margin:0 0 6px 0;">Enter your password to confirm deletion</h4>
          <p style="font-size:.82rem;color:#6B7280;max-width:340px;margin:0 auto 24px;">For your security, please verify your identity before permanently deleting <strong style="color:#0B1F3A;">${esc(ev.matterName)}</strong>.</p>
        </div>
        <div style="margin-bottom:8px;">
          <label style="display:block;font-size:.74rem;font-weight:700;color:#4B5563;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Password</label>
          <input id="del-password" type="password" placeholder="Enter your password"
            style="width:100%;box-sizing:border-box;padding:11px 14px;border:1.5px solid #E5E7EB;border-radius:8px;font-size:.9rem;font-family:'Montserrat',sans-serif;outline:none;transition:border-color .2s;"
            onfocus="this.style.borderColor='#8B1C2E'"
            onblur="this.style.borderColor='#E5E7EB'"
            onkeydown="if(event.key==='Enter')EVENTS.deleteConfirmed('${eventId}')" />
          <div id="del-error" style="display:none;margin-top:8px;padding:9px 12px;background:#FBE9EC;border-radius:6px;font-size:.78rem;color:#8B1C2E;font-weight:600;"></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="VIEWS.deleteEventModal('${eventId}')">← Back</button>
        <button class="btn btn-danger" onclick="EVENTS.deleteConfirmed('${eventId}')">Delete Permanently</button>
      </div>`);
    setTimeout(() => document.getElementById('del-password')?.focus(), 100);
  },

  manualEntryModal(eventId, participantId) {
    const ev = S.events.find(e=>e.id===eventId);
    const p  = ev?.participants.find(x=>x.id===participantId);
    if (!ev || !p) return;
    modal.open(`
      <div class="modal-header"><h3 class="modal-title">Manual Availability Entry</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
      <div class="modal-body">
        <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:#F6F1E9;border-radius:8px;margin-bottom:20px;">
          <div style="width:38px;height:38px;border-radius:50%;background:#0B1F3A;color:#C09D5F;font-family:'Cormorant Garamond',serif;font-size:.95rem;font-weight:700;display:flex;align-items:center;justify-content:center;">${initials(p.name)}</div>
          <div><div style="font-weight:600;color:#0B1F3A;font-size:.9rem;">${esc(p.name)}</div><div style="font-size:.76rem;color:#9CA3AF;">${ROLES[p.role]||p.role}</div></div>
        </div>
        <p style="font-size:.82rem;color:#4B5563;margin-bottom:16px;">Select availability for each proposed time slot. Changes are saved immediately.</p>
        ${ev.proposedSlots.map(s => {
          const cur = p.availability[s.id] || '';
          return `<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border:1px solid #EDE6D9;border-radius:8px;margin-bottom:8px;background:#FAFAF8;">
            <div>
              <div style="font-family:'Cormorant Garamond',serif;font-size:1rem;font-weight:600;color:#0B1F3A;">${fmtDay(s.date)}</div>
              <div style="font-size:.78rem;color:#9CA3AF;">${fmtTime(s.startTime)} – ${fmtTime(s.endTime)}</div>
            </div>
            <div style="display:flex;gap:6px;">
              ${[['available','✓','#D1FAE5','#065F46'],['unavailable','✗','#FEE2E2','#8B1C2E'],['maybe','~','#FEF3C7','#92400E'],['','—','#F3F4F6','#9CA3AF']].map(([v,lbl,bg,color])=>`
                <button onclick="EVENTS.setManualAvailability('${eventId}','${participantId}','${s.id}','${v}');VIEWS.manualEntryModal('${eventId}','${participantId}')" style="width:34px;height:34px;border:2px solid ${cur===v?'#0B1F3A':'#EDE6D9'};border-radius:7px;background:${cur===v?bg:'#fff'};color:${cur===v?color:'#9CA3AF'};cursor:pointer;font-size:.9rem;font-weight:700;transition:all .15s;" title="${v||'Clear'}">${lbl}</button>`).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" onclick="closeModal();VIEWS.eventDetail('${eventId}')">Done</button>
      </div>`);
  },


  /* ── Apple Calendar ICS Download (public) ── */
  calDownload(eventId, firmId) {
    const tryDownload = ev => {
      if (!ev.confirmedSlot) {
        render(`<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F6F1E9;">
          <div style="text-align:center;padding:40px;"><h2 style="font-family:'Cormorant Garamond',serif;font-size:1.8rem;color:#0B1F3A;margin-bottom:12px;">No Confirmed Date</h2>
          <p style="font-size:.9rem;color:#6B7280;">This event has not yet been confirmed. Please check back after a date is selected.</p></div>
        </div>`);
        return;
      }
      const slot = ev.proposedSlots.find(s => s.id === ev.confirmedSlot);
      if (slot) ICS.download(ev, slot);
    };
    // Try in-memory first
    const local = S.events.find(e => e.id === eventId);
    if (local) { tryDownload(local); return; }
    // Load from Firestore
    const fId = firmId || _firmId();
    render(`<div class="loading-screen"><div class="spinner"></div><p class="loading-text">Preparing calendar file…</p></div>`);
    db.collection('firms').doc(fId).collection('events').doc(eventId).get().then(doc => {
      if (!doc.exists) {
        render(`<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F6F1E9;">
          <div style="text-align:center;padding:40px;"><h2 style="font-family:'Cormorant Garamond',serif;font-size:1.8rem;color:#0B1F3A;margin-bottom:12px;">Event Not Found</h2>
          <p style="font-size:.9rem;color:#6B7280;">This calendar link is invalid or has expired.</p></div>
        </div>`);
        return;
      }
      tryDownload(doc.data());
    }).catch(() => {
      render(`<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F6F1E9;">
        <div style="text-align:center;padding:40px;"><h2 style="font-family:'Cormorant Garamond',serif;font-size:1.8rem;color:#0B1F3A;margin-bottom:12px;">Unable to Load</h2>
        <p style="font-size:.9rem;color:#6B7280;">Please check your internet connection and try again.</p></div>
      </div>`);
    });
  },

  /* ── Respond Page (public) ── */
  respond(token, eventId, firmId) {
    S.view = 'respond';
    let ev = null, participant = null;
    // First try in-memory events (logged-in user)
    for (const e of S.events) {
      const p = e.participants.find(x=>x.token===token);
      if (p) { ev = e; participant = p; break; }
    }
    // If not found and we have firmId+eventId, load from Firestore
    if (!ev && eventId && firmId) {
      render(`<div class="loading-screen"><div class="spinner"></div><p class="loading-text">Loading invitation…</p></div>`);
      db.collection('firms').doc(firmId).collection('events').doc(eventId).get().then(doc => {
        if (!doc.exists) {
          render(`<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F6F1E9;">
            <div style="text-align:center;padding:40px;"><h2 style="font-family:'Cormorant Garamond',serif;font-size:1.8rem;color:#0B1F3A;margin-bottom:12px;">Invitation Not Found</h2>
            <p style="font-size:.9rem;color:#6B7280;">This scheduling link is invalid or has expired. Please contact the scheduling coordinator.</p></div>
          </div>`);
          return;
        }
        const loadedEv = doc.data();
        const loadedP  = loadedEv.participants.find(x=>x.token===token);
        if (!loadedP) {
          render(`<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F6F1E9;">
            <div style="text-align:center;padding:40px;"><h2 style="font-family:'Cormorant Garamond',serif;font-size:1.8rem;color:#0B1F3A;margin-bottom:12px;">Invitation Not Found</h2>
            <p style="font-size:.9rem;color:#6B7280;">This scheduling link is invalid or has expired.</p></div>
          </div>`);
          return;
        }
        // Cache for RESPOND_toggleSlot and RESPOND_submit
        if (!window._respondCache) window._respondCache = {};
        window._respondCache[token] = { ev: loadedEv, firmId };
        VIEWS._renderRespond(token, loadedEv, loadedP);
      }).catch(() => {
        render(`<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F6F1E9;">
          <div style="text-align:center;padding:40px;"><h2 style="font-family:'Cormorant Garamond',serif;font-size:1.8rem;color:#0B1F3A;margin-bottom:12px;">Unable to Load Invitation</h2>
          <p style="font-size:.9rem;color:#6B7280;">Please check your internet connection and try again.</p></div>
        </div>`);
      });
      return;
    }
    if (!ev || !participant) {
      render(`<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F6F1E9;">
        <div style="text-align:center;padding:40px;"><h2 style="font-family:'Cormorant Garamond',serif;font-size:1.8rem;color:#0B1F3A;margin-bottom:12px;">Invitation Not Found</h2>
        <p style="font-size:.9rem;color:#6B7280;">This scheduling link is invalid or has expired. Please contact the scheduling coordinator.</p></div>
      </div>`);
      return;
    }
    VIEWS._renderRespond(token, ev, participant);
  },

  _renderRespond(token, ev, participant) {
    if (participant.status === 'responded' || ev.status === 'confirmed') {
      const confirmed = ev.confirmedSlot ? ev.proposedSlots.find(s=>s.id===ev.confirmedSlot) : null;
      render(VIEWS.respondThankYou(ev, participant, confirmed));
      return;
    }
    const et = EVENT_TYPES[ev.type] || { label:'Meeting', icon:'📅' };
    // Initialize temp state
    if (!window._respondState) window._respondState = {};
    window._respondState[token] = window._respondState[token] || {};
    const rs = window._respondState[token];

    render(`
    <div style="min-height:100vh;background:#F6F1E9;padding-bottom:48px;">
      <!-- Header -->
      <div style="background:#0B1F3A;padding:0;">
        <div style="max-width:900px;margin:0 auto;padding:18px 24px;display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:38px;height:38px;border:2px solid #C09D5F;border-radius:50%;display:flex;align-items:center;justify-content:center;">${logoSVG(21)}</div>
            <div style="font-family:'Cormorant Garamond',serif;font-size:1.2rem;font-weight:700;color:#fff;letter-spacing:.02em;">LexSchedule</div>
          </div>
          <div style="font-size:.74rem;color:rgba(255,255,255,.5);">Secure Scheduling Portal</div>
        </div>
        <div style="height:3px;background:linear-gradient(90deg,#9e7e3f,#d4b87a,#9e7e3f);"></div>
      </div>
      <div style="max-width:900px;margin:0 auto;padding:32px 24px;">
        <!-- Greeting -->
        <div style="background:#fff;border-radius:14px;border:1px solid #EDE6D9;box-shadow:0 2px 12px rgba(11,31,58,.07);overflow:hidden;margin-bottom:24px;">
          <div style="background:#0B1F3A;padding:22px 26px;display:flex;align-items:center;gap:16px;">
            <div style="width:44px;height:44px;background:${et.bg||'#F3F4F6'};border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;">${et.icon}</div>
            <div><div style="font-family:'Cormorant Garamond',serif;font-size:1.3rem;font-weight:600;color:#fff;">${esc(ev.matterName)}</div><div style="font-size:.74rem;color:rgba(255,255,255,.55);">${et.label} · ${ev.caseNumber||''}${ev.location?' · '+ev.location.replace('-',' '):''}</div></div>
          </div>
          <div style="padding:22px 26px;">
            <p style="font-size:.9rem;color:#374151;line-height:1.75;margin-bottom:12px;">Dear <strong>${esc(participant.name)}</strong>,</p>
            <p style="font-size:.88rem;color:#4B5563;line-height:1.75;margin-bottom:12px;">You have been invited to indicate your availability for the above-referenced matter. Please review the proposed dates and times below and indicate whether you are available, unavailable, or available if necessary.</p>
            ${ev.deadline?`<p style="font-size:.82rem;color:#9CA3AF;"><strong>Response requested by:</strong> ${fmtDate(new Date(ev.deadline).toISOString().slice(0,10))}</p>`:''}
            ${ev.location==='phone'&&ev.phoneNumber?`<p style="font-size:.82rem;color:#4B5563;margin-top:6px;"><strong>📞 Conference Call Number:</strong> ${esc(ev.phoneNumber)}</p>`:''}
            ${ev.locationDetails?`<p style="font-size:.82rem;color:#4B5563;margin-top:6px;"><strong>Location/Details:</strong> ${esc(ev.locationDetails)}</p>`:''}
            ${ev.notes?`<p style="font-size:.82rem;color:#4B5563;margin-top:6px;"><strong>Notes:</strong> ${esc(ev.notes)}</p>`:''}
          </div>
        </div>
        ${ev.mode === 'poll' ? `
        <!-- Poll grid instructions -->
        <div style="background:#F5EDD8;border:1px solid rgba(192,157,95,.3);border-radius:10px;padding:14px 18px;margin-bottom:18px;display:flex;gap:12px;align-items:flex-start;">
          <span style="font-size:1rem;margin-top:1px;">💡</span>
          <div style="font-size:.84rem;color:#7A5C20;line-height:1.6;">Click each cell to mark yourself as <strong>Available (✓)</strong> for that morning or afternoon block. Leave unchecked if you are unavailable. Mark as many slots as possible to help find a mutual time.</div>
        </div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:8px;font-size:.78rem;color:#4B5563;"><div style="width:24px;height:24px;background:#D1FAE5;border-radius:5px;display:flex;align-items:center;justify-content:center;color:#065F46;font-weight:700;">✓</div>Available</div>
          <div style="display:flex;align-items:center;gap:8px;font-size:.78rem;color:#4B5563;"><div style="width:24px;height:24px;background:#F9FAFB;border:2px solid #E5E7EB;border-radius:5px;"></div>Not Available</div>
        </div>
        <!-- Poll availability grid -->
        ${POLL.renderGrid(ev, { token, isAdmin: false })}
        ` : `
        <!-- Propose mode: instructions -->
        <div style="background:#F5EDD8;border:1px solid rgba(192,157,95,.3);border-radius:10px;padding:14px 18px;margin-bottom:18px;display:flex;gap:12px;align-items:center;">
          <span style="font-size:1rem;">💡</span>
          <div style="font-size:.84rem;color:#7A5C20;">Click each date to cycle through: <strong>Available (✓)</strong> → <strong>Unavailable (✗)</strong> → <strong>If Necessary (~)</strong> → Clear. Select your availability for all proposed dates, then submit.</div>
        </div>
        <!-- Legend -->
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;">
          ${[['✓','Available','#D1FAE5','#065F46'],['✗','Unavailable','#FEE2E2','#8B1C2E'],['~','If Necessary','#FEF3C7','#92400E']].map(([icon,lbl,bg,color])=>`<div style="display:flex;align-items:center;gap:8px;font-size:.78rem;color:#4B5563;"><div style="width:24px;height:24px;background:${bg};border-radius:5px;display:flex;align-items:center;justify-content:center;color:${color};font-weight:700;font-size:.85rem;">${icon}</div>${lbl}</div>`).join('')}
        </div>
        <!-- Slot grid -->
        <div class="respond-slot-grid" id="rs-grid">
          ${ev.proposedSlots.map(s => {
            const cur = rs[s.id] || participant.availability[s.id] || '';
            const classes = { available:'rs-avail', unavailable:'rs-unavail', maybe:'rs-maybe', '':'' };
            const labels  = { available:'Available', unavailable:'Unavailable', maybe:'If Necessary', '':'Click to Select' };
            return `<div class="respond-slot-card ${classes[cur]}" onclick="RESPOND_toggleSlot('${token}','${s.id}','${ev.id}')" id="rsc-${s.id}">
              <div class="rs-date">${new Date(s.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</div>
              <div class="rs-time">${fmtTime(s.startTime)} – ${fmtTime(s.endTime)}</div>
              <div class="rs-status" style="color:${cur==='available'?'#065F46':cur==='unavailable'?'#8B1C2E':cur==='maybe'?'#92400E':'#9CA3AF'};">${cur?AVAIL_ICON[cur]+' ':''} ${labels[cur]}</div>
            </div>`;
          }).join('')}
        </div>`}
        <!-- Comment -->
        <div style="background:#fff;border-radius:12px;border:1px solid #EDE6D9;padding:20px 24px;margin-top:20px;">
          <label style="display:block;font-size:.72rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:8px;">Additional Comments (Optional)</label>
          <textarea id="rs-comment" placeholder="Any scheduling constraints, preferences, or notes for the scheduling coordinator…" style="width:100%;padding:10px 14px;border:1.5px solid #D5CCBA;border-radius:8px;font-size:.875rem;font-family:'Montserrat',sans-serif;outline:none;resize:vertical;min-height:80px;" onfocus="this.style.borderColor='#0B1F3A'" onblur="this.style.borderColor='#D5CCBA'"></textarea>
        </div>
        <!-- Submit -->
        <div style="margin-top:20px;display:flex;justify-content:center;">
          <button onclick="RESPOND_submit('${token}','${ev.id}','${participant.id}')" style="padding:14px 48px;border:none;border-radius:8px;font-size:.86rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;background:#0B1F3A;color:#fff;font-family:'Montserrat',sans-serif;box-shadow:0 4px 16px rgba(11,31,58,.2);">Submit My Availability</button>
        </div>
        <p style="text-align:center;font-size:.74rem;color:#9CA3AF;margin-top:12px;">Your response will be transmitted securely via LexSchedule.</p>
      </div>
    </div>`);
  },

  respondThankYou(ev, participant, confirmed) {
    return `
    <div style="min-height:100vh;background:#F6F1E9;display:flex;align-items:center;justify-content:center;padding:24px;">
      <div style="max-width:560px;width:100%;text-align:center;">
        <div style="width:80px;height:80px;border-radius:50%;background:#D1FAE5;display:flex;align-items:center;justify-content:center;font-size:2rem;margin:0 auto 20px;">✅</div>
        <h2 style="font-family:'Cormorant Garamond',serif;font-size:2rem;font-weight:600;color:#0B1F3A;margin-bottom:10px;">
          ${confirmed ? 'This Meeting Has Been Confirmed' : 'Thank You for Your Response'}
        </h2>
        ${confirmed ? `
          <div style="background:linear-gradient(135deg,#0B1F3A,#162d52);border:2px solid #C09D5F;border-radius:12px;padding:20px 24px;margin:20px 0;text-align:left;">
            <div style="font-size:.62rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#C09D5F;margin-bottom:6px;">Confirmed Date & Time</div>
            <div style="font-family:'Cormorant Garamond',serif;font-size:1.5rem;font-weight:600;color:#fff;">${fmtDate(confirmed.date)}</div>
            <div style="font-size:.84rem;color:rgba(255,255,255,.65);margin-top:4px;">${fmtTime(confirmed.startTime)} – ${fmtTime(confirmed.endTime)} Eastern</div>
            ${ev.location==='phone'&&ev.phoneNumber?`<div style="font-size:.82rem;color:rgba(255,255,255,.65);margin-top:4px;">📞 ${esc(ev.phoneNumber)}</div>`:''}
            ${ev.locationDetails?`<div style="font-size:.82rem;color:rgba(255,255,255,.55);margin-top:4px;">📍 ${esc(ev.locationDetails)}</div>`:''}
          </div>` : `
          <p style="font-size:.9rem;color:#4B5563;line-height:1.75;">Your availability has been successfully recorded for <strong>${esc(ev.matterName)}</strong>. The scheduling coordinator will review all responses and notify you once a date has been confirmed.</p>`}
        <div style="margin-top:24px;padding:16px;background:#fff;border-radius:10px;border:1px solid #EDE6D9;">
          <p style="font-size:.8rem;color:#9CA3AF;">If you have questions, please contact our office.</p>
          <p style="font-size:.84rem;font-weight:600;color:#0B1F3A;margin-top:6px;">LexSchedule</p>
          <p style="font-size:.78rem;color:#9CA3AF;">Professional Legal Scheduling</p>
        </div>
      </div>
    </div>`;
  },

  /* ── Email Verification ── */
  verify() {
    S.view = 'verify';
    const pv = S.pendingVerify;
    if (!pv) { ROUTER.go('/login'); return; }
    render(`
    <div style="min-height:100vh;display:grid;grid-template-columns:1fr 1fr;">
      <!-- Left panel -->
      <div style="background:#0B1F3A;padding:64px;display:flex;flex-direction:column;justify-content:center;position:relative;overflow:hidden;">
        <div style="position:absolute;inset:0;opacity:.04;background-image:url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22><circle cx=%2230%22 cy=%2230%22 r=%221%22 fill=%22%23C09D5F%22/></svg>');background-size:30px 30px;"></div>
        <div style="position:relative;z-index:1;">
          <div style="width:68px;height:68px;border:2px solid #C09D5F;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-bottom:28px;">
            ${logoSVG(40)}
          </div>
          <div style="font-family:'Cormorant Garamond',serif;font-size:2.6rem;font-weight:700;color:#fff;line-height:1.1;margin-bottom:6px;">LexSchedule</div>
          <div style="font-size:.65rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#C09D5F;margin-bottom:40px;">Professional Legal Scheduling Platform</div>
          <div style="background:rgba(192,157,95,.12);border:1px solid rgba(192,157,95,.3);border-radius:12px;padding:28px;">
            <div style="font-size:2.2rem;margin-bottom:12px;">📧</div>
            <div style="font-family:'Cormorant Garamond',serif;font-size:1.3rem;color:#fff;font-weight:600;margin-bottom:8px;">Verify Your Identity</div>
            <p style="font-size:.82rem;color:rgba(255,255,255,.65);line-height:1.6;">A verification link has been sent to your firm email address. Click the link to activate your account.</p>
            <p style="font-size:.78rem;color:rgba(192,157,95,.85);margin-top:12px;line-height:1.5;">Only <strong style="color:#C09D5F;">@lawfirmnaples.com</strong> email addresses are authorized to access LexSchedule.</p>
          </div>
        </div>
      </div>
      <!-- Right panel -->
      <div style="background:#FAFAF8;display:flex;align-items:center;justify-content:center;padding:60px;">
        <div style="width:100%;max-width:400px;">
          <h2 style="font-family:'Cormorant Garamond',serif;font-size:2.2rem;font-weight:600;color:#0B1F3A;margin-bottom:6px;">Check Your Email</h2>
          <p style="font-size:.84rem;color:#6B7280;margin-bottom:6px;">We sent a verification link to:</p>
          <p style="font-size:.9rem;font-weight:600;color:#0B1F3A;margin-bottom:24px;">${esc(pv.email)}</p>
          <div id="verify-error" style="display:none;background:#FBE9EC;border:1px solid #FCA5A5;border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:.82rem;color:#7F1D1D;border-left:3px solid #8B1C2E;"></div>
          <p style="font-size:.82rem;color:#6B7280;margin-bottom:24px;line-height:1.6;">Open your email and click the verification link. Once verified, click the button below to continue.</p>
          <button onclick="AUTH_verify()" style="width:100%;padding:12px;border:none;border-radius:8px;font-size:.82rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;background:#0B1F3A;color:#fff;font-family:'Montserrat',sans-serif;box-shadow:0 2px 8px rgba(11,31,58,.2);transition:all .2s;margin-bottom:16px;" onmouseover="this.style.background='#162d52'" onmouseout="this.style.background='#0B1F3A'">I've Verified My Email</button>
          <div style="text-align:center;font-size:.82rem;color:#6B7280;">Didn't receive the email? <a onclick="AUTH_resendCode()" style="color:#9e7e3f;font-weight:600;cursor:pointer;">Resend</a></div>
          <div style="text-align:center;margin-top:14px;"><a onclick="AUTH.logout()" style="font-size:.76rem;color:#9CA3AF;cursor:pointer;">← Sign in with a different account</a></div>
        </div>
      </div>
    </div>`);
  },
};


/* ── Global event handlers (called from inline onclick) ── */

window.WAITLIST_submit = async function() {
  const name  = document.getElementById('wl-name')?.value.trim();
  const email = document.getElementById('wl-email')?.value.trim();
  const use   = document.getElementById('wl-use')?.value.trim();
  const errEl = document.getElementById('wl-error');
  const btn   = document.getElementById('wl-btn');
  errEl.style.display = 'none';
  if (!name)  { errEl.textContent = 'Please enter your name.';          errEl.style.display='block'; return; }
  if (!email) { errEl.textContent = 'Please enter your email address.'; errEl.style.display='block'; return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errEl.textContent = 'Please enter a valid email address.'; errEl.style.display='block'; return; }
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="border-color:rgba(11,31,58,.3);border-top-color:#0B1F3A;"></span>';
  try {
    await db.collection('waitlist').add({ name, email, use: use || '', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    // Notify admin
    EMAIL._send(EMAILJS_CONFIG.templateWaitlist, {
      to_name:  'Mick',
      to_email: 'mickm@me.com',
      wl_name:  name,
      wl_email: email,
      wl_use:   use || '(not provided)',
      subject:  'New Waitlist Signup — ' + name
    }, 'Mick', 'mickm@me.com');
    document.getElementById('wl-form-wrap').style.display = 'none';
    document.getElementById('wl-success').style.display   = 'block';
  } catch(e) {
    btn.disabled = false;
    btn.textContent = 'Request Early Access';
    errEl.textContent = 'Something went wrong. Please try again.';
    errEl.style.display = 'block';
  }
};

window.AUTH_login = async function() {
  const email = document.getElementById('l-email')?.value.trim();
  const pass  = document.getElementById('l-pass')?.value;
  if (!email || !pass) { document.getElementById('login-error').style.display='flex'; document.getElementById('login-error').textContent='Please enter your email and password.'; return; }
  const btn = document.querySelector('button[onclick="AUTH_login()"]');
  if (btn) { btn.disabled=true; btn.innerHTML='<span class="spinner"></span>'; }
  const result = await AUTH.login(email, pass);
  if (btn) { btn.disabled=false; btn.textContent='Sign In to LexSchedule'; }
  if (result === true) { toast(`Welcome back, ${S.user.name.split(' ')[0]}.`, 'success'); ROUTER.go('/dashboard'); }
  else if (result === 'unverified') { toast('Please verify your email address to continue.', 'warning'); ROUTER.go('/verify'); }
  else {
    const el = document.getElementById('login-error');
    el.style.display = 'flex';
    el.textContent = 'Invalid email or password. Please try again.';
  }
};

window.REG_selectRole = function(roleType) {
  document.getElementById('r-role').value = roleType;
  // Card highlight
  const attyCard = document.getElementById('role-atty-card');
  const asstCard = document.getElementById('role-asst-card');
  const gold = '2px solid #C09D5F';
  const grey = '2px solid #D5CCBA';
  attyCard.style.border = roleType === 'Attorney' ? gold : grey;
  attyCard.style.background = roleType === 'Attorney' ? '#F5EDD8' : '#fff';
  asstCard.style.border = roleType === 'Assistant' ? gold : grey;
  asstCard.style.background = roleType === 'Assistant' ? '#F5EDD8' : '#fff';
  // Show/hide conditional fields
  document.getElementById('bar-row').style.display       = roleType === 'Attorney' ? 'block' : 'none';
  document.getElementById('bar-title-row').style.display = roleType === 'Attorney' ? 'block' : 'none';
  document.getElementById('asst-row').style.display      = roleType === 'Assistant' ? 'block' : 'none';
  document.getElementById('asst-title-row').style.display= roleType === 'Assistant' ? 'block' : 'none';
};

window.VIEWS_saveAccountPhone = function() { window.VIEWS_saveAccountContact(); };
window.VIEWS_saveAccountContact = function() {
  const firm    = document.getElementById('acct-firm')?.value.trim() || '';
  const phone   = document.getElementById('acct-phone')?.value.trim() || '';
  const fax     = document.getElementById('acct-fax')?.value.trim() || '';
  const address = document.getElementById('acct-address')?.value.trim() || '';
  if (S.user) {
    S.user.firm = firm;
    S.user.phone = phone;
    S.user.firmFax = fax;
    S.user.firmAddress = address;
    db.collection('userProfiles').doc(S.user.id).set(S.user).catch(console.error);
    toast('Contact info saved.', 'success', 3000);
  }
};

window.AUTH_register = async function() {
  const name         = document.getElementById('r-name')?.value.trim();
  const email        = document.getElementById('r-email')?.value.trim();
  const phone        = document.getElementById('r-phone')?.value.trim();
  const roleType     = document.getElementById('r-role')?.value;          // 'Attorney' or 'Assistant'
  const bar          = document.getElementById('r-bar')?.value.trim();
  const attyTitle    = document.getElementById('r-title')?.value.trim();
  const asstFor      = document.getElementById('r-assistant-for')?.value.trim();
  const asstTitle    = document.getElementById('r-asst-title')?.value.trim();
  const firm         = document.getElementById('r-firm')?.value.trim();
  const pass         = document.getElementById('r-pass')?.value;
  const pass2        = document.getElementById('r-pass2')?.value;
  const terms        = document.getElementById('r-terms')?.checked;
  const errEl        = document.getElementById('reg-error');
  const showErr = msg => { errEl.style.display='flex'; errEl.textContent=msg; };

  if (!name || !email || !roleType || !pass) return showErr('Please fill in all required fields and select a role.');
  if (!email.toLowerCase().endsWith('@lawfirmnaples.com')) return showErr('Registration is restricted to @lawfirmnaples.com email addresses.');
  if (roleType === 'Assistant' && !asstFor) return showErr('Please enter the name of the attorney you assist.');
  if (pass.length < 8) return showErr('Password must be at least 8 characters.');
  if (pass !== pass2) return showErr('Passwords do not match. Please try again.');
  if (!terms) return showErr('Please agree to the terms to create your account.');

  // Build the role label shown in the app
  const role = roleType === 'Assistant'
    ? (asstTitle || 'Legal Assistant')
    : (attyTitle || 'Attorney');

  const btn = document.querySelector('button[onclick="AUTH_register()"]');
  if (btn) { btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Creating Account...'; }

  const result = await AUTH.register({
    name,
    email,
    phone,
    role,
    roleType,                                           // 'Attorney' | 'Assistant'
    assistantFor: roleType === 'Assistant' ? asstFor : '',
    barNumber: roleType === 'Attorney' ? bar : '',
    firm: firm || '',
    password: pass,
  });

  if (btn) { btn.disabled=false; btn.textContent='Create Account'; }
  if (result === 'email-exists') return showErr('An account with this email address already exists.');
  if (result === 'error') return showErr('Registration failed. Please try again.');

  toast(`Welcome to LexSchedule, ${name.split(' ')[0]}!`, 'success');
  ROUTER.go('/dashboard');
};

window.AUTH_verify = async function() {
  const fbUser = fbAuth.currentUser;
  const errEl  = document.getElementById('verify-error');
  const showErr = msg => { if (errEl) { errEl.style.display='flex'; errEl.textContent=msg; } };
  if (!fbUser) {
    // User signed out while waiting — try signing back in to re-check
    if (!S.pendingVerify?.email) { ROUTER.go('/login'); return; }
    showErr('Please open the verification link in this browser, then click the button again.');
    return;
  }
  await fbUser.reload();
  if (fbUser.emailVerified) {
    const doc = await db.collection('userProfiles').doc(fbUser.uid).get();
    if (doc.exists) {
      S.user = doc.data();
      S.pendingVerify = null;
      await STORE.load();
      toast(`Welcome to LexSchedule, ${S.user.name.split(' ')[0]}!`, 'success');
      ROUTER.go('/dashboard');
    }
  } else {
    showErr('Email not verified yet. Please click the link in your email, then try again.');
  }
};

window.AUTH_resendCode = async function() {
  const fbUser = fbAuth.currentUser;
  if (fbUser) {
    await fbUser.sendEmailVerification({ url: 'https://micksterm.github.io/lexschedule/#/login' });
    toast('A new verification email has been sent.', 'success', 5000);
  } else {
    toast('Please sign in again to resend verification.', 'warning', 5000);
    ROUTER.go('/login');
  }
};

// Shared filter state
window._dashF = { status: 'All', type: 'All', caseNumber: '' };

function _applyDashFilters() {
  const { status, type, caseNumber } = window._dashF;
  const isHistory = status === 'History';

  const statusFns = {
    'All':            e => e.status !== 'archived',
    'Active':         e => e.status === 'active',
    'Pending':        e => e.status !== 'archived' && e.participants.some(p => p.status === 'pending'),
    'Confirmed':      e => e.status === 'confirmed',
    'No Match':       e => e.status === 'no-match',
    'Needs Attention':e => e.status === 'no-match',
    'History':        e => e.status === 'archived',
  };
  const statusFn   = statusFns[status] || (e => e.status !== 'archived');
  const typeFn     = type === 'All' ? () => true : e => e.type === type;
  const caseNumFn  = caseNumber ? e => (e.caseNumber||'').trim() === caseNumber.trim() : () => true;

  const evts = S.events.filter(e => statusFn(e) && typeFn(e) && caseNumFn(e));
  document.getElementById('event-list').innerHTML = VIEWS.renderEventList(evts, isHistory);

  // Update summary line
  const summary = document.getElementById('dash-filter-summary');
  if (summary) {
    const parts = [];
    if (status !== 'All') parts.push(status);
    if (type !== 'All') parts.push(EVENT_TYPES[type]?.label || type);
    if (caseNumber) parts.push(`Case No. ${caseNumber}`);
    if (parts.length) {
      summary.style.display = 'block';
      summary.innerHTML = `Showing <strong style="color:#0B1F3A;">${evts.length}</strong> event${evts.length!==1?'s':''} &nbsp;·&nbsp; ${parts.join(' &nbsp;+&nbsp; ')} &nbsp;<button onclick="_dashClearAll()" style="background:none;border:none;color:#C09D5F;font-size:.72rem;font-weight:700;cursor:pointer;text-decoration:underline;padding:0;font-family:'Montserrat',sans-serif;">Clear filters</button>`;
    } else {
      summary.style.display = 'none';
    }
  }
}

window.dashCaseFilter = function(caseNumber) {
  window._dashF.caseNumber = caseNumber;
  _applyDashFilters();
};

window._dashClearAll = function() {
  window._dashF.status     = 'All';
  window._dashF.type       = 'All';
  window._dashF.caseNumber = '';
  // Reset status tabs
  document.querySelectorAll('[id^="ftab-"]').forEach(b => { b.style.background='transparent'; b.style.color='#6B7280'; b.style.boxShadow=''; });
  const allTab = document.getElementById('ftab-All');
  if (allTab) { allTab.style.background='#fff'; allTab.style.color='#0B1F3A'; allTab.style.boxShadow='0 1px 3px rgba(11,31,58,.08)'; }
  // Reset stat cards
  document.querySelectorAll('[id^="stat-"]').forEach(c => {
    c.classList.remove('stat-active-filter');
    c.style.borderColor='#EDE6D9'; c.style.boxShadow='0 1px 4px rgba(11,31,58,.06)'; c.style.transform='';
    const h = c.querySelector('.stat-click-hint'); if (h) h.style.opacity='0';
  });
  // Reset type pills
  document.querySelectorAll('[id^="ttype-"]').forEach(b => { b.style.background='transparent'; b.style.color='#6B7280'; b.style.borderColor='#E5E7EB'; });
  const allType = document.getElementById('ttype-All');
  if (allType) { allType.style.background='#0B1F3A'; allType.style.color='#fff'; allType.style.borderColor='#0B1F3A'; }
  _applyDashFilters();
};

window.dashFilter = function(f) {
  window._dashF.status = f;

  // Reset & set status tab styles
  document.querySelectorAll('[id^="ftab-"]').forEach(b => { b.style.background='transparent'; b.style.color='#6B7280'; b.style.boxShadow=''; });
  const tabKey = { 'All':'All', 'Active':'Active', 'Confirmed':'Confirmed', 'Needs-Attention':'Needs-Attention', 'Needs Attention':'Needs-Attention', 'No Match':'Needs-Attention', 'Pending':'' }[f] || '';
  const btn = document.getElementById(`ftab-${tabKey}`);
  if (btn) { btn.style.background='#fff'; btn.style.color='#0B1F3A'; btn.style.boxShadow='0 1px 3px rgba(11,31,58,.08)'; }

  // Reset & set stat card styles
  document.querySelectorAll('[id^="stat-"]').forEach(c => {
    c.classList.remove('stat-active-filter');
    c.style.borderColor='#EDE6D9'; c.style.boxShadow='0 1px 4px rgba(11,31,58,.06)'; c.style.transform='';
    const h = c.querySelector('.stat-click-hint'); if (h) h.style.opacity='0';
  });
  const statCardMap = { 'Active':'stat-active', 'Pending':'stat-pending', 'Confirmed':'stat-confirmed', 'No Match':'stat-nomatch', 'Needs Attention':'stat-nomatch' };
  const card = document.getElementById(statCardMap[f]);
  if (card) {
    card.classList.add('stat-active-filter');
    card.style.borderColor='#C09D5F'; card.style.boxShadow='0 4px 20px rgba(192,157,95,.25)'; card.style.transform='translateY(-2px)';
    const h = card.querySelector('.stat-click-hint'); if (h) h.style.opacity='1';
  }

  _applyDashFilters();
};

window.dashTypeFilter = function(t) {
  window._dashF.type = t;

  // Reset all type pills
  document.querySelectorAll('[id^="ttype-"]').forEach(b => { b.style.background='transparent'; b.style.color='#6B7280'; b.style.borderColor='#E5E7EB'; });

  if (t === 'All') {
    const allBtn = document.getElementById('ttype-All');
    if (allBtn) { allBtn.style.background='#0B1F3A'; allBtn.style.color='#fff'; allBtn.style.borderColor='#0B1F3A'; }
  } else {
    const et  = EVENT_TYPES[t] || {};
    const btn = document.getElementById(`ttype-${t}`);
    if (btn) { btn.style.background=et.bg||'#EDE6D9'; btn.style.color=et.color||'#0B1F3A'; btn.style.borderColor=et.color||'#0B1F3A'; }
    // Deselect the "All" pill
    const allBtn = document.getElementById('ttype-All');
    if (allBtn) { allBtn.style.background='transparent'; allBtn.style.color='#6B7280'; allBtn.style.borderColor='#E5E7EB'; }
  }

  _applyDashFilters();
};

// Auto-fill case number when a known matter name is selected (or vice versa)
window.CREATE_autoFillCase = function(matterVal, caseVal) {
  const ev = matterVal
    ? S.events.find(e => e.matterName === matterVal)
    : S.events.find(e => e.caseNumber === caseVal);
  if (!ev) return;
  if (matterVal) {
    const caseEl = document.getElementById('c-case');
    if (caseEl && !caseEl.value) caseEl.value = ev.caseNumber || '';
  } else {
    const matterEl = document.getElementById('c-matter');
    if (matterEl && !matterEl.value) matterEl.value = ev.matterName || '';
  }
};

// Auto-fill participant email/org/role when a known name or email is selected
window.CREATE_autoFillParticipant = function(field, value) {
  if (!value || value.length < 2) return;
  const allP = S.events.flatMap(e => e.participants || []);
  const match = field === 'name'
    ? allP.find(p => p.name === value)
    : allP.find(p => p.email === value);
  if (!match) return;
  if (field === 'name') {
    const emailEl = document.getElementById('np-email');
    const orgEl   = document.getElementById('np-org');
    const roleEl  = document.getElementById('np-role');
    if (emailEl && !emailEl.value) emailEl.value = match.email || '';
    if (orgEl   && !orgEl.value)   orgEl.value   = match.organization || '';
    if (roleEl  && !roleEl.value && match.role)  roleEl.value = match.role;
  } else {
    const nameEl = document.getElementById('np-name');
    const orgEl  = document.getElementById('np-org');
    const roleEl = document.getElementById('np-role');
    if (nameEl && !nameEl.value) nameEl.value = match.name || '';
    if (orgEl  && !orgEl.value)  orgEl.value  = match.organization || '';
    if (roleEl && !roleEl.value && match.role) roleEl.value = match.role;
  }
};

window.CREATE_togglePhoneField = function(locValue) {
  const row = document.getElementById('c-phone-row');
  if (!row) return;
  if (locValue === 'phone') {
    row.style.display = '';
    document.getElementById('c-phone')?.focus();
  } else {
    row.style.display = 'none';
  }
};

window.CREATE_selectMode = function(mode) {
  if (!S.createData) S.createData = {};
  S.createData.mode = mode;
  VIEWS.createEvent(); // re-render step 0 to show selection highlight
};

window.CREATE_next0 = function() {
  if (!S.createData?.mode) { toast('Please select a scheduling method to continue.', 'error'); return; }
  S.createStep = 1;
  VIEWS.createEvent();
};

window.CREATE_next3Poll = function() {
  const startDate = document.getElementById('poll-start')?.value;
  const endDate   = document.getElementById('poll-end')?.value;
  if (!startDate || !endDate) { toast('Please enter both a start and end date.', 'error'); return; }
  if (endDate < startDate)    { toast('End date must be on or after the start date.', 'error'); return; }
  const weekdaysOnly = document.getElementById('poll-weekdays')?.checked !== false;
  const selectedBlocks = [...document.querySelectorAll('input[name="poll-block"]:checked')].map(el => el.value);
  if (!selectedBlocks.length) { toast('Please select at least one time block (Morning or Afternoon).', 'error'); return; }
  const slots = POLL.slotsFromRange(startDate, endDate, weekdaysOnly, selectedBlocks);
  if (!slots.length) { toast('No valid dates in that range. Try including weekends or extending the range.', 'error'); return; }
  S.createData.pollRange        = { startDate, endDate };
  S.createData.pollWeekdaysOnly = weekdaysOnly;
  S.createData.pollBlocks       = selectedBlocks;
  S.createData.slots            = slots;
  S.createStep = 4;
  VIEWS.createEvent();
};

window.CREATE_next1 = function() {
  const type   = document.getElementById('c-type')?.value;
  const matter = document.getElementById('c-matter')?.value.trim();
  const loc    = document.querySelector('input[name="loc"]:checked')?.value;
  const phone  = document.getElementById('c-phone')?.value.trim();
  if (!type || !matter) { toast('Please select a proceeding type and enter the matter name.','error'); return; }
  if ((loc || 'in-person') === 'phone' && !phone) { toast('Please enter the conference call number.','error'); return; }
  S.createData.type = type;
  S.createData.matterName = matter;
  S.createData.caseNumber = document.getElementById('c-case')?.value.trim();
  S.createData.location   = loc || 'in-person';
  S.createData.phoneNumber = (loc || 'in-person') === 'phone' ? phone : '';
  S.createData.locationDetails = document.getElementById('c-locdet')?.value.trim();
  S.createData.deadline   = document.getElementById('c-deadline')?.value;
  S.createData.notes          = document.getElementById('c-notes')?.value.trim();
  S.createData.schedulerPhone = document.getElementById('c-scheduler-phone')?.value.trim();
  S.createStep = 2;
  VIEWS.createEvent();
};

window.CREATE_addParticipant = function() {
  const name  = document.getElementById('np-name')?.value.trim();
  const email = document.getElementById('np-email')?.value.trim();
  const role  = document.getElementById('np-role')?.value;
  const org   = document.getElementById('np-org')?.value.trim();
  if (!name || !email || !role) { toast('Please enter name, email, and role.','error'); return; }
  if (!/\S+@\S+\.\S+/.test(email)) { toast('Please enter a valid email address.','error'); return; }
  S.createData.participants.push({ name, email, role, organization:org });
  S.createStep = 2;
  VIEWS.createEvent();
};

window.CREATE_removeParticipant = function(i) {
  S.createData.participants.splice(i,1);
  VIEWS.createEvent();
};

window.CREATE_next2 = function() {
  if (!S.createData.participants.length) { toast('Please add at least one participant.','error'); return; }
  S.createStep = 3;
  VIEWS.createEvent();
};

// Auto-apply AM/PM defaults based on hour:
//   8-11  → AM (leave as-is, already 08-11 in 24h)
//   12    → PM noon (leave as-is, already 12 in 24h)
//   1-5   → PM (convert 01-05 → 13-17)
// When startId is corrected, optionally auto-set endId to 1 hour later if empty.
window.applySlotTimeDefault = function(inputId, endId) {
  const input = document.getElementById(inputId);
  if (!input || !input.value) return;
  const [hStr, mStr] = input.value.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  // Hours 1–5 typed as AM (01–05 in 24h) → convert to PM (13–17)
  if (h >= 1 && h <= 5) {
    h += 12;
    input.value = `${String(h).padStart(2,'0')}:${m}`;
  }
  // Auto-populate end time to 1 hour later if it is empty and endId provided
  if (endId) {
    const endInput = document.getElementById(endId);
    if (endInput && !endInput.value) {
      const endH = h + 1;
      if (endH <= 23) {
        endInput.value = `${String(endH).padStart(2,'0')}:${m}`;
      }
    }
  }
};

window.CREATE_addSlot = function() {
  const date  = document.getElementById('ns-date')?.value;
  const start = document.getElementById('ns-start')?.value;
  const end   = document.getElementById('ns-end')?.value;
  if (!date || !start || !end) { toast('Please select a date, start time, and end time.','error'); return; }
  if (start >= end) { toast('End time must be after start time.','error'); return; }
  if (S.createData.slots.find(s=>s.date===date&&s.startTime===start)) { toast('This slot has already been added.','error'); return; }
  S.createData.slots.push({ date, startTime:start, endTime:end });
  VIEWS.createEvent();
};

window.CREATE_removeSlot = function(i) {
  S.createData.slots.splice(i,1);
  VIEWS.createEvent();
};

window.CREATE_next3 = function() {
  if (S.createData.slots.length < 1) { toast('Please add at least one time slot.','error'); return; }
  S.createStep = 4;
  VIEWS.createEvent();
};

window.CREATE_submit = function() {
  const cd = S.createData;
  const isPoll = cd.mode === 'poll';
  // Poll mode: slots were already generated in CREATE_next3Poll; propose: slots come from cd.slots
  const proposedSlots = isPoll
    ? cd.slots  // already have id from POLL.slotsFromRange (kept as-is, they have unique ids)
    : cd.slots.map(s => ({ ...s, id: uid() }));
  const newEvent = {
    id: uid(),
    mode: cd.mode || 'propose',
    title: cd.matterName,
    type: cd.type,
    caseNumber: cd.caseNumber,
    matterName: cd.matterName,
    description: cd.description || '',
    status: 'active',
    createdBy: S.user.id,
    createdAt: Date.now(),
    deadline: cd.deadline ? new Date(cd.deadline).getTime() : null,
    location: cd.location,
    locationDetails: cd.locationDetails,
    phoneNumber: cd.phoneNumber || '',
    schedulerPhone: cd.schedulerPhone || S.user?.phone || '',
    pollRange: isPoll ? cd.pollRange : null,
    pollWeekdaysOnly: isPoll ? cd.pollWeekdaysOnly : null,
    proposedSlots,
    participants: cd.participants.map(p => ({
      ...p,
      id: uid(),
      token: 'tok-' + uid().slice(0,8),
      status: 'pending',
      availability: {}
    })),
    confirmedSlot: null,
    emailLog: [],
    history: [{ ts: Date.now(), action: `Event created (${isPoll?'poll':'propose'} mode)`, user: S.user.name }],
    notes: cd.notes,
  };
  S.events.unshift(newEvent);
  STORE.save();
  S.createStep = 0;
  S.createData = { mode:'', slots:[], participants:[] };
  EMAIL.sendInvitations(newEvent.id);
  STORE.save();
  toast(`Scheduling event created. Invitations sent to ${newEvent.participants.length} participant(s).`, 'success', 6000);
  ROUTER.go(`/event/${newEvent.id}`);
};

window.DETAIL_toggleCell = function(eventId, participantId, slotId) {
  const ev = S.events.find(e=>e.id===eventId);
  const p  = ev?.participants.find(x=>x.id===participantId);
  if (!ev || !p) return;
  const cur = p.availability[slotId] || '';
  const next = AVAIL_CYCLE[cur];
  EVENTS.setManualAvailability(eventId, participantId, slotId, next);
  VIEWS.eventDetail(eventId);
};

// Poll mode: toggle a half-day cell available / not
window.POLL_toggleCell = function(token, slotId, eventId) {
  if (!window._respondState) window._respondState = {};
  if (!window._respondState[token]) window._respondState[token] = {};
  const rs  = window._respondState[token];
  const cur = rs[slotId] !== undefined ? rs[slotId] : '';
  const next = cur === 'available' ? '' : 'available';
  rs[slotId] = next;
  const btn = document.getElementById('pollc-' + slotId);
  if (!btn) return;
  const isAvail = next === 'available';
  btn.style.background  = isAvail ? '#D1FAE5' : '#F9FAFB';
  btn.style.border      = isAvail ? '2px solid #6EE7B7' : '1px solid #E5E7EB';
  btn.innerHTML = isAvail ? '<span style="font-size:.9rem;color:#065F46;font-weight:700;">✓</span>' : '';
};

window.RESPOND_toggleSlot = function(token, slotId, eventId) {
  if (!window._respondState) window._respondState = {};
  if (!window._respondState[token]) window._respondState[token] = {};
  const rs = window._respondState[token];
  const ev = S.events.find(e=>e.id===eventId) || window._respondCache?.[token]?.ev;
  const participant = ev?.participants.find(p=>p.token===token);
  const cur = rs[slotId] !== undefined ? rs[slotId] : (participant?.availability[slotId] || '');
  const next = AVAIL_CYCLE[cur];
  rs[slotId] = next;
  const card = document.getElementById('rsc-'+slotId);
  if (!card) return;
  const classMap = { available:'rs-avail', unavailable:'rs-unavail', maybe:'rs-maybe', '':'' };
  const labelMap = { available:'✓  Available', unavailable:'✗  Unavailable', maybe:'~  If Necessary', '':'Click to Select' };
  const colorMap = { available:'#065F46', unavailable:'#8B1C2E', maybe:'#92400E', '':'#9CA3AF' };
  card.className = 'respond-slot-card ' + (classMap[next]||'');
  card.querySelector('.rs-status').textContent = labelMap[next];
  card.querySelector('.rs-status').style.color  = colorMap[next];
};

window.RESPOND_submit = function(token, eventId, participantId) {
  // Get event from memory (logged-in user) or from public cache (recipient)
  const cached  = window._respondCache?.[token];
  const ev = S.events.find(e=>e.id===eventId) || cached?.ev;
  const p  = ev?.participants.find(x=>x.id===participantId);
  if (!ev || !p) return;
  const rs = window._respondState?.[token] || {};
  const comment = document.getElementById('rs-comment')?.value.trim();
  if (ev.mode === 'poll') {
    ev.proposedSlots.forEach(s => {
      const val = rs[s.id] !== undefined ? rs[s.id] : ((p.availability||{})[s.id]||'');
      p.availability[s.id] = val === 'available' ? 'available' : 'unavailable';
    });
  } else {
    ev.proposedSlots.forEach(s => {
      const val = rs[s.id] !== undefined ? rs[s.id] : (p.availability[s.id]||'');
      if (val) p.availability[s.id] = val;
      else delete p.availability[s.id];
    });
  }
  p.status = 'responded';
  ev.history = ev.history || [];
  if (comment) {
    ev.history.push({ ts: Date.now(), action: `${p.name} responded with note: "${comment}"`, user: p.name });
  } else {
    ev.history.push({ ts: Date.now(), action: `${p.name} submitted availability`, user: 'System' });
  }
  delete (window._respondState||{})[token];
  // Save: either via STORE (logged in) or directly to Firestore (public recipient)
  if (S.user) {
    AVAIL.checkAutoConfirm(eventId);
    STORE.save();
  } else if (cached?.firmId) {
    db.collection('firms').doc(cached.firmId).collection('events').doc(eventId).set(ev).catch(console.error);
  }
  const confirmed = ev.confirmedSlot ? ev.proposedSlots.find(s=>s.id===ev.confirmedSlot) : null;
  render(VIEWS.respondThankYou(ev, p, confirmed));
};

/* ── Add Participant to Active Event ─────────────────── */

window.EVENTS_addParticipantModal = function(eventId) {
  const roleOptions = Object.entries(ROLES).map(([k,v]) =>
    `<option value="${k}">${v}</option>`).join('');
  modal.open(`
    <div class="modal-header" style="background:#0B1F3A;border-radius:18px 18px 0 0;">
      <h3 class="modal-title" style="color:#fff">Add Participant</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div style="padding:24px 28px;display:flex;flex-direction:column;gap:14px;">
      <div id="add-p-error" style="display:none;background:#FBE9EC;border-left:3px solid #8B1C2E;border-radius:8px;padding:10px 14px;font-size:.82rem;color:#7F1D1D;"></div>
      <div>
        <label style="display:block;font-size:.7rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:5px;">Full Name <span style="color:#8B1C2E;">*</span></label>
        <input id="add-p-name" type="text" placeholder="Jane Smith" style="width:100%;padding:9px 12px;border:1.5px solid #D5CCBA;border-radius:8px;font-size:.875rem;font-family:'Montserrat',sans-serif;outline:none;box-sizing:border-box;" onfocus="this.style.borderColor='#0B1F3A'" onblur="this.style.borderColor='#D5CCBA'">
      </div>
      <div>
        <label style="display:block;font-size:.7rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:5px;">Email Address <span style="color:#8B1C2E;">*</span></label>
        <input id="add-p-email" type="email" placeholder="jane@example.com" style="width:100%;padding:9px 12px;border:1.5px solid #D5CCBA;border-radius:8px;font-size:.875rem;font-family:'Montserrat',sans-serif;outline:none;box-sizing:border-box;" onfocus="this.style.borderColor='#0B1F3A'" onblur="this.style.borderColor='#D5CCBA'">
      </div>
      <div>
        <label style="display:block;font-size:.7rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:5px;">Role <span style="color:#8B1C2E;">*</span></label>
        <select id="add-p-role" style="width:100%;padding:9px 12px;border:1.5px solid #D5CCBA;border-radius:8px;font-size:.875rem;font-family:'Montserrat',sans-serif;outline:none;background:#fff;" onfocus="this.style.borderColor='#0B1F3A'" onblur="this.style.borderColor='#D5CCBA'">
          <option value="">Select role…</option>
          ${roleOptions}
        </select>
      </div>
      <div>
        <label style="display:block;font-size:.7rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:5px;">Organization</label>
        <input id="add-p-org" type="text" placeholder="Firm or company name" style="width:100%;padding:9px 12px;border:1.5px solid #D5CCBA;border-radius:8px;font-size:.875rem;font-family:'Montserrat',sans-serif;outline:none;box-sizing:border-box;" onfocus="this.style.borderColor='#0B1F3A'" onblur="this.style.borderColor='#D5CCBA'">
      </div>
      <p style="font-size:.76rem;color:#9CA3AF;margin:0;">An invitation will be sent immediately so they can indicate their availability.</p>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:4px;">
        <button onclick="closeModal()" style="padding:9px 20px;border:1px solid #D1D5DB;border-radius:8px;background:#fff;color:#6B7280;font-size:.82rem;font-weight:600;cursor:pointer;font-family:'Montserrat',sans-serif;">Cancel</button>
        <button onclick="EVENTS_addParticipantSave('${eventId}')" style="padding:9px 22px;border:none;border-radius:8px;background:#0B1F3A;color:#C09D5F;font-size:.82rem;font-weight:700;cursor:pointer;font-family:'Montserrat',sans-serif;letter-spacing:.04em;">Add &amp; Send Invite</button>
      </div>
    </div>`);
  document.getElementById('add-p-name')?.focus();
};

window.EVENTS_addParticipantSave = function(eventId) {
  const ev   = S.events.find(e => e.id === eventId);
  if (!ev) return;
  const name  = document.getElementById('add-p-name')?.value.trim();
  const email = document.getElementById('add-p-email')?.value.trim();
  const role  = document.getElementById('add-p-role')?.value;
  const org   = document.getElementById('add-p-org')?.value.trim();
  const errEl = document.getElementById('add-p-error');
  const showErr = msg => { errEl.textContent = msg; errEl.style.display = 'block'; };

  if (!name)  return showErr('Please enter a name.');
  if (!email) return showErr('Please enter an email address.');
  if (!/\S+@\S+\.\S+/.test(email)) return showErr('Please enter a valid email address.');
  if (!role)  return showErr('Please select a role.');
  if (ev.participants.some(p => p.email.toLowerCase() === email.toLowerCase()))
    return showErr('A participant with this email address is already on this event.');

  const newP = {
    id:           uid(),
    token:        'tok-' + uid().slice(0, 8),
    name,
    email,
    role,
    organization: org,
    status:       'pending',
    availability: {},
  };
  ev.participants.push(newP);
  EMAIL.addHistory(eventId, `${name} added as a participant by ${S.user?.name || 'scheduler'}`);
  STORE.save();

  // Send invitation immediately
  const cfg = (() => { try { return JSON.parse(localStorage.getItem('ejs_config')||'{}'); } catch(e){return{};} })();
  const et  = EVENT_TYPES[ev.type] || {};
  const deadline   = ev.deadline ? fmtDate(new Date(ev.deadline).toISOString().slice(0,10)) : 'As soon as possible';
  const slotsText = EMAIL._slotsHtml(ev);
  const respondUrl = EMAIL._respondUrl(newP.token, ev.id);
  const subj = `Scheduling Invitation: ${ev.matterName}`;
  EMAIL._send(cfg.templateInvitation, {
    to_email:       newP.email,
    to_name:        newP.name,
    subject:        subj,
    matter_name:    ev.matterName,
    case_number:    ev.caseNumber || 'N/A',
    event_type:     et.label || ev.type,
    deadline,
    proposed_slots: slotsText,
    respond_url:    respondUrl,
    sender_name:    S.user?.name || 'LexSchedule',
    sender_phone:   ev.schedulerPhone || '',
  }, newP.name, newP.email);
  EMAIL.log(eventId, newP.email, subj, 'invitation');

  modal.close();
  toast(`${name} added and invitation sent.`, 'success', 5000);
  VIEWS.eventDetail(eventId);
};

/* ── Edit Participant Email ───────────────────────────── */

window.EVENTS_editParticipantEmailModal = function(eventId, participantId) {
  const ev = S.events.find(e => e.id === eventId);
  if (!ev) return;
  const p = ev.participants.find(x => x.id === participantId);
  if (!p) return;
  modal.open(`
    <div class="modal-header" style="background:#0B1F3A;border-radius:18px 18px 0 0;">
      <h3 class="modal-title" style="color:#fff">Edit Email — ${esc(p.name)}</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div style="padding:24px 28px;display:flex;flex-direction:column;gap:14px;">
      <div id="edit-email-error" style="display:none;background:#FBE9EC;border-left:3px solid #8B1C2E;border-radius:8px;padding:10px 14px;font-size:.82rem;color:#7F1D1D;"></div>
      <div>
        <label style="display:block;font-size:.7rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0B1F3A;margin-bottom:5px;">Email Address <span style="color:#8B1C2E;">*</span></label>
        <input id="edit-email-input" type="email" value="${esc(p.email)}" style="width:100%;padding:9px 12px;border:1.5px solid #D5CCBA;border-radius:8px;font-size:.875rem;font-family:'Montserrat',sans-serif;outline:none;box-sizing:border-box;" onfocus="this.style.borderColor='#0B1F3A'" onblur="this.style.borderColor='#D5CCBA'">
      </div>
      <p style="font-size:.76rem;color:#9CA3AF;margin:0;">Updating the email address will not automatically resend any invitations.</p>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:4px;">
        <button onclick="closeModal()" style="padding:9px 20px;border:1px solid #D1D5DB;border-radius:8px;background:#fff;color:#6B7280;font-size:.82rem;font-weight:600;cursor:pointer;font-family:'Montserrat',sans-serif;">Cancel</button>
        <button onclick="EVENTS_editParticipantEmailSave('${eventId}','${participantId}')" style="padding:9px 22px;border:none;border-radius:8px;background:#0B1F3A;color:#C09D5F;font-size:.82rem;font-weight:700;cursor:pointer;font-family:'Montserrat',sans-serif;letter-spacing:.04em;">Save</button>
      </div>
    </div>`);
  document.getElementById('edit-email-input')?.focus();
};

window.EVENTS_editParticipantEmailSave = function(eventId, participantId) {
  const ev = S.events.find(e => e.id === eventId);
  if (!ev) return;
  const p = ev.participants.find(x => x.id === participantId);
  if (!p) return;
  const newEmail = document.getElementById('edit-email-input')?.value.trim();
  const errEl = document.getElementById('edit-email-error');
  const showErr = msg => { errEl.textContent = msg; errEl.style.display = 'block'; };

  if (!newEmail) return showErr('Please enter an email address.');
  if (!/\S+@\S+\.\S+/.test(newEmail)) return showErr('Please enter a valid email address.');
  if (ev.participants.some(x => x.id !== participantId && x.email.toLowerCase() === newEmail.toLowerCase()))
    return showErr('Another participant already has this email address.');

  const oldEmail = p.email;
  if (oldEmail.toLowerCase() === newEmail.toLowerCase()) { modal.close(); return; }

  p.email = newEmail;
  EMAIL.addHistory(eventId, `Email for ${p.name} updated from ${oldEmail} to ${newEmail}`);
  STORE.save();
  modal.close();
  toast(`Email updated for ${p.name}.`, 'success', 4000);
  VIEWS.eventDetail(eventId);
};

/* ── POLL Global Actions ──────────────────────────────── */

/* ── Poll multi-slot selection ────────────────────────── */
window._pollSelected = { eventId: null, slotIds: [] };

window.POLL_selectCell = function(eventId, slotId) {
  const ev = S.events.find(e => e.id === eventId);
  if (!ev) return;

  // Reset selection when switching events
  if (window._pollSelected.eventId !== eventId) {
    window._pollSelected = { eventId, slotIds: [] };
  }
  const sel = window._pollSelected;
  const idx = sel.slotIds.indexOf(slotId);

  if (idx !== -1) {
    // Already selected — single-click deselects; if it was the only one open detail
    if (sel.slotIds.length === 1) {
      sel.slotIds = [];
      POLL_updateSelectionUI(eventId);
      POLL_showSlotDetail(eventId, slotId);
      return;
    }
    sel.slotIds.splice(idx, 1);
  } else {
    // Try to add — validate same day and consecutive
    const candidate = [...sel.slotIds, slotId];
    const slots = candidate
      .map(id => ev.proposedSlots.find(s => s.id === id))
      .filter(Boolean);
    const days = new Set(slots.map(s => s.date));
    if (days.size > 1) {
      toast('You can only combine slots on the same day.', 'error', 3000);
      return;
    }
    slots.sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (let i = 0; i < slots.length - 1; i++) {
      if (slots[i].endTime !== slots[i + 1].startTime) {
        toast('Only consecutive time slots can be combined.', 'error', 3000);
        return;
      }
    }
    sel.slotIds.push(slotId);
  }
  POLL_updateSelectionUI(eventId);
};

window.POLL_clearSelection = function(eventId) {
  window._pollSelected = { eventId, slotIds: [] };
  POLL_updateSelectionUI(eventId);
};

window.POLL_updateSelectionUI = function(eventId) {
  const ev = S.events.find(e => e.id === eventId);
  if (!ev) return;
  const sel     = window._pollSelected;
  const matches = new Set(POLL.matchSlots(ev).map(s => s.id));

  // Update every admin cell's visual state
  ev.proposedSlots.forEach(slot => {
    const btn = document.getElementById('pollac-' + slot.id);
    if (!btn) return;
    const isSelected = sel.slotIds.includes(slot.id);
    if (isSelected) {
      btn.style.background = '#DBEAFE';
      btn.style.border     = '2px solid #2563EB';
      btn.style.filter     = '';
    } else {
      const s = POLL.slotSummary(ev, slot.id);
      btn.style.background = s.responded === 0 ? '#F9FAFB' : s.available === 0 ? '#FEE2E2' : matches.has(slot.id) ? '#DCFCE7' : '#FEF3C7';
      btn.style.border     = matches.has(slot.id) ? '2px solid #16A34A' : '1px solid #E5E7EB';
      btn.style.filter     = '';
    }
  });

  // Update selection bar
  const bar   = document.getElementById('poll-sel-bar');
  const label = document.getElementById('poll-sel-label');
  const time  = document.getElementById('poll-sel-time');
  if (!bar) return;

  if (sel.slotIds.length === 0) {
    bar.style.display = 'none';
    return;
  }

  const sorted = sel.slotIds
    .map(id => ev.proposedSlots.find(s => s.id === id))
    .filter(Boolean)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const first = sorted[0];
  const last  = sorted[sorted.length - 1];
  const fmtDt = new Date(first.date + 'T12:00:00').toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'});

  bar.style.display = 'flex';
  if (label) label.textContent = `${sel.slotIds.length} slot${sel.slotIds.length > 1 ? 's' : ''} selected · ${fmtDt}`;
  if (time)  time.textContent  = `${POLL.fmtTime(first.startTime)} – ${POLL.fmtTime(last.endTime)}`;
};

window.POLL_scheduleSelected = function(eventId) {
  const ev  = S.events.find(e => e.id === eventId);
  if (!ev) return;
  const sel = window._pollSelected;
  if (!sel.slotIds.length) return;

  const sorted = sel.slotIds
    .map(id => ev.proposedSlots.find(s => s.id === id))
    .filter(Boolean)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const first = sorted[0];
  const last  = sorted[sorted.length - 1];

  // Participants available for ALL selected slots
  const available   = ev.participants.filter(p => sel.slotIds.every(id => (p.availability||{})[id] === 'available'));
  const unavailable = ev.participants.filter(p => p.status !== 'pending' && !sel.slotIds.every(id => (p.availability||{})[id] === 'available'));
  const pending     = ev.participants.filter(p => p.status === 'pending');
  const isMatch     = available.length > 0 && unavailable.length === 0 && pending.length === 0;

  const fmtDt    = new Date(first.date + 'T12:00:00').toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric', year:'numeric'});
  const timeRange = `${POLL.fmtTime(first.startTime)} – ${POLL.fmtTime(last.endTime)}`;

  const nameList = (people, bg, dot) => people.length === 0 ? '' : `
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">
      ${people.map(p => `
        <div style="display:flex;align-items:center;gap:6px;background:${bg};border-radius:20px;padding:4px 10px 4px 6px;">
          <span style="width:20px;height:20px;border-radius:50%;background:#0B1F3A;color:#C09D5F;font-size:.6rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${initials(p.name)}</span>
          <span style="font-size:.78rem;font-weight:500;color:#0B1F3A;">${esc(p.name)}</span>
          <span style="font-size:.75rem;">${dot}</span>
        </div>`).join('')}
    </div>`;

  const hasConflict = unavailable.length > 0;
  const warningHtml = hasConflict ? `
    <div style="background:#FEF3C7;border:1px solid #F59E0B;border-radius:8px;padding:10px 14px;margin:12px 0;font-size:.8rem;color:#92400E;">
      <strong>Note:</strong> ${unavailable.length} participant(s) marked as unavailable during part or all of this window.
    </div>` : '';

  modal.open(`
    <div class="modal-header" style="background:#0B1F3A;border-radius:18px 18px 0 0;">
      <h3 class="modal-title" style="color:#fff">Schedule Combined Slot</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div style="padding:22px 26px;">
      <div style="background:#F6F1E9;border:1px solid #EDE6D9;border-radius:10px;padding:13px 16px;margin-bottom:16px;">
        <div style="font-size:.7rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#9e7e3f;margin-bottom:3px;">${fmtDt}</div>
        <div style="font-family:'Cormorant Garamond',serif;font-size:1.4rem;font-weight:600;color:#0B1F3A;">${timeRange}</div>
        <div style="font-size:.72rem;color:#9CA3AF;margin-top:3px;">${sorted.length} consecutive half-hour slot${sorted.length > 1 ? 's' : ''}</div>
        ${isMatch ? `<div style="margin-top:8px;display:inline-flex;align-items:center;gap:5px;background:#DCFCE7;border-radius:12px;padding:3px 10px;font-size:.7rem;font-weight:700;color:#166534;">✓ Everyone available for full window</div>` : ''}
      </div>
      ${warningHtml}
      ${available.length > 0 ? `<div style="margin-bottom:12px;"><div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#166534;">Available for full window (${available.length})</div>${nameList(available,'#F0FDF4','✓')}</div>` : ''}
      ${unavailable.length > 0 ? `<div style="margin-bottom:12px;"><div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#B91C1C;">Not fully available (${unavailable.length})</div>${nameList(unavailable,'#FEF2F2','✗')}</div>` : ''}
      ${pending.length > 0 ? `<div style="margin-bottom:12px;"><div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9CA3AF;">No response yet (${pending.length})</div>${nameList(pending,'#F9FAFB','·')}</div>` : ''}
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px;padding-top:14px;border-top:1px solid #EDE6D9;">
        <button onclick="closeModal()" style="padding:9px 20px;border:1px solid #D1D5DB;border-radius:8px;background:#fff;color:#6B7280;font-size:.82rem;font-weight:600;cursor:pointer;font-family:'Montserrat',sans-serif;">Cancel</button>
        <button onclick="closeModal();EVENTS.confirm('${eventId}','${first.id}','${last.endTime}')"
          style="padding:9px 22px;border:none;border-radius:8px;background:#0B1F3A;color:#C09D5F;font-size:.82rem;font-weight:700;cursor:pointer;font-family:'Montserrat',sans-serif;letter-spacing:.04em;">
          Schedule ${timeRange}
        </button>
      </div>
    </div>`);
};

// Show who is available/unavailable/pending for a slot
window.POLL_showSlotDetail = function(eventId, slotId) {
  const ev   = S.events.find(e => e.id === eventId);
  if (!ev) return;
  const slot = ev.proposedSlots.find(s => s.id === slotId);
  if (!slot) return;

  const fmtDt = new Date(slot.date + 'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  const fmtRange = `${POLL.fmtTime(slot.startTime)} – ${POLL.fmtTime(slot.endTime)}`;

  const available   = ev.participants.filter(p => (p.availability||{})[slotId] === 'available');
  const unavailable = ev.participants.filter(p => p.status !== 'pending' && (p.availability||{})[slotId] !== 'available');
  const pending     = ev.participants.filter(p => p.status === 'pending');
  const isMatch     = available.length > 0 && unavailable.length === 0 && pending.length === 0;
  const canConfirm  = ev.status !== 'confirmed' && ev.status !== 'archived';

  const nameList = (people, bg, dot) => people.length === 0 ? '' : `
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">
      ${people.map(p => `
        <div style="display:flex;align-items:center;gap:6px;background:${bg};border-radius:20px;padding:4px 10px 4px 6px;">
          <span style="width:20px;height:20px;border-radius:50%;background:#0B1F3A;color:#C09D5F;font-size:.6rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${initials(p.name)}</span>
          <span style="font-size:.78rem;font-weight:500;color:#0B1F3A;">${esc(p.name)}</span>
          <span style="font-size:.75rem;">${dot}</span>
        </div>`).join('')}
    </div>`;

  const confirmBtn = canConfirm ? `
    <button onclick="closeModal();POLL_confirmSlot('${eventId}','${slotId}')"
      style="padding:9px 22px;border:none;border-radius:8px;background:#0B1F3A;color:#C09D5F;font-size:.82rem;font-weight:700;cursor:pointer;font-family:'Montserrat',sans-serif;letter-spacing:.04em;">
      Schedule This Time
    </button>` : '';

  modal.open(`
    <div class="modal-header" style="background:#0B1F3A;border-radius:18px 18px 0 0;">
      <h3 class="modal-title" style="color:#fff">Slot Availability</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div style="padding:22px 26px;">
      <div style="background:#F6F1E9;border:1px solid #EDE6D9;border-radius:10px;padding:13px 16px;margin-bottom:18px;">
        <div style="font-size:.72rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#9e7e3f;margin-bottom:3px;">${fmtDt}</div>
        <div style="font-family:'Cormorant Garamond',serif;font-size:1.35rem;font-weight:600;color:#0B1F3A;">${fmtRange}</div>
        ${isMatch ? `<div style="margin-top:6px;display:inline-flex;align-items:center;gap:5px;background:#DCFCE7;border-radius:12px;padding:3px 10px;font-size:.7rem;font-weight:700;color:#166534;letter-spacing:.03em;">✓ Everyone available</div>` : ''}
      </div>

      ${available.length > 0 ? `
        <div style="margin-bottom:14px;">
          <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#166534;">Available (${available.length})</div>
          ${nameList(available, '#F0FDF4', '✓')}
        </div>` : ''}

      ${unavailable.length > 0 ? `
        <div style="margin-bottom:14px;">
          <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#B91C1C;">Unavailable (${unavailable.length})</div>
          ${nameList(unavailable, '#FEF2F2', '✗')}
        </div>` : ''}

      ${pending.length > 0 ? `
        <div style="margin-bottom:14px;">
          <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9CA3AF;">No Response Yet (${pending.length})</div>
          ${nameList(pending, '#F9FAFB', '·')}
        </div>` : ''}

      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:6px;padding-top:16px;border-top:1px solid #EDE6D9;">
        <button onclick="closeModal()" style="padding:9px 20px;border:1px solid #D1D5DB;border-radius:8px;background:#fff;color:#6B7280;font-size:.82rem;font-weight:600;cursor:pointer;font-family:'Montserrat',sans-serif;">Close</button>
        ${confirmBtn}
      </div>
    </div>`);
};

// Confirm a specific poll slot (with or without full agreement)
window.POLL_confirmSlot = function(eventId, slotId) {
  const ev = S.events.find(e => e.id === eventId);
  if (!ev) return;
  const slot = ev.proposedSlots.find(s => s.id === slotId);
  if (!slot) return;
  const matches = POLL.matchSlots(ev);
  const isMatch = matches.some(s => s.id === slotId);
  const responded = ev.participants.filter(p => p.status !== 'pending');
  const summary   = POLL.slotSummary(ev, slotId);
  const fmtBlk = `${POLL.fmtTime(slot.startTime)} – ${POLL.fmtTime(slot.endTime)}`;
  const fmtDt  = new Date(slot.date + 'T12:00:00').toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });
  const hasNonMatching = responded.length > 0 && !isMatch;
  const warningHtml = hasNonMatching ? `
    <div style="background:#FEF3C7;border:1px solid #F59E0B;border-radius:8px;padding:12px 14px;margin:14px 0;font-size:.82rem;color:#92400E;">
      <strong>Note:</strong> ${summary.responded - summary.available} of ${summary.responded} responded participant(s) marked this slot as unavailable.
      Confirming will schedule this time regardless.
    </div>` : '';
  modal.open(`
    <div class="modal-header" style="background:#0B1F3A;border-radius:18px 18px 0 0;">
      <h3 class="modal-title" style="color:#fff">Confirm Meeting Slot</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div style="padding:24px 28px;">
      <p style="font-size:.9rem;color:#374151;margin:0 0 6px;">You are about to confirm:</p>
      <div style="background:#F6F1E9;border:1px solid #E5E0D4;border-radius:10px;padding:14px 18px;margin-bottom:4px;">
        <div style="font-size:1rem;font-weight:700;color:#0B1F3A;">${esc(ev.matterName)}</div>
        <div style="font-size:.85rem;color:#6B5D4F;margin-top:4px;">${fmtDt} &mdash; ${fmtBlk}</div>
        ${ev.caseNumber ? `<div style="font-size:.75rem;color:#9CA3AF;margin-top:2px;">Case ${esc(ev.caseNumber)}</div>` : ''}
      </div>
      ${warningHtml}
      <p style="font-size:.8rem;color:#6B7280;margin:12px 0 20px;">Confirmation emails with calendar invites will be sent to all participants.</p>
      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button onclick="closeModal()" style="padding:9px 20px;border:1px solid #D1D5DB;border-radius:8px;background:#fff;color:#6B7280;font-size:.82rem;font-weight:600;cursor:pointer;font-family:'Montserrat',sans-serif;">Cancel</button>
        <button onclick="POLL_doConfirm('${eventId}','${slotId}')" style="padding:9px 22px;border:none;border-radius:8px;background:#0B1F3A;color:#C09D5F;font-size:.82rem;font-weight:700;cursor:pointer;font-family:'Montserrat',sans-serif;letter-spacing:.04em;">Confirm Meeting</button>
      </div>
    </div>`);
};

window.POLL_doConfirm = function(eventId, slotId) {
  modal.close();
  EVENTS.confirm(eventId, slotId);
};

// Mark the poll event as no-match
window.POLL_setNoMatch = function(eventId) {
  const ev = S.events.find(e => e.id === eventId);
  if (!ev) return;
  modal.open(`
    <div class="modal-header" style="background:#0B1F3A;border-radius:18px 18px 0 0;">
      <h3 class="modal-title" style="color:#fff">Mark as No Match</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div style="padding:24px 28px;">
      <p style="font-size:.88rem;color:#374151;margin:0 0 14px;">No time slot works for all participants for <strong>${esc(ev.matterName)}</strong>.</p>
      <p style="font-size:.82rem;color:#6B7280;margin:0 0 22px;">The event will be marked as <em>No Match</em>. You can still manually confirm any slot if needed, or restart the scheduling process.</p>
      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button onclick="closeModal()" style="padding:9px 20px;border:1px solid #D1D5DB;border-radius:8px;background:#fff;color:#6B7280;font-size:.82rem;font-weight:600;cursor:pointer;font-family:'Montserrat',sans-serif;">Cancel</button>
        <button onclick="POLL_doNoMatch('${eventId}')" style="padding:9px 22px;border:none;border-radius:8px;background:#8B1C2E;color:#fff;font-size:.82rem;font-weight:700;cursor:pointer;font-family:'Montserrat',sans-serif;">Mark No Match</button>
      </div>
    </div>`);
};

window.POLL_doNoMatch = function(eventId) {
  const ev = S.events.find(e => e.id === eventId);
  if (!ev) return;
  ev.status = 'no-match';
  EMAIL.addHistory(eventId, 'Marked as no match — no mutually available time slot found');
  STORE.save();
  modal.close();
  toast('Event marked as No Match.', 'info', 4000);
  VIEWS.eventDetail(eventId);
};

// Edit a participant's poll availability on their behalf (admin)
window.POLL_editResponse = function(eventId, participantId) {
  const ev  = S.events.find(e => e.id === eventId);
  const par = ev?.participants.find(p => p.id === participantId);
  if (!ev || !par) return;

  const dates  = POLL.uniqueDates(ev.proposedSlots);
  const byDate = POLL.slotsByDate(ev.proposedSlots);

  const dateFmt = d => {
    const dt = new Date(d + 'T12:00:00');
    return { day: dt.toLocaleDateString('en-US',{weekday:'short'}), date: dt.toLocaleDateString('en-US',{month:'short',day:'numeric'}) };
  };

  const avail = Object.assign({}, par.availability || {});

  const buildGrid = () => {
    const dateHeaders = dates.map(d => {
      const { day, date } = dateFmt(d);
      return `<th style="padding:6px 8px;text-align:center;min-width:68px;border:1px solid #E5E7EB;background:#0B1F3A;white-space:nowrap;">
        <div style="font-size:.66rem;font-weight:700;color:#fff;text-transform:uppercase;">${day}</div>
        <div style="font-size:.6rem;color:rgba(255,255,255,.65);">${date}</div>
      </th>`;
    }).join('');

    const usedBlockIds = [...new Set(ev.proposedSlots.map(s => s.block))];
    const blockRows = POLL.BLOCKS.filter(b => usedBlockIds.includes(b.id)).map(blk => {
      const times = [...new Set(ev.proposedSlots.filter(s => s.block === blk.id).map(s => s.startTime))].sort();
      const sectionRow = `<tr><td colspan="${dates.length + 1}" style="padding:4px 10px;background:#F0F4FA;border:1px solid #E5E7EB;font-size:.63rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#0B1F3A;">${blk.label} &mdash; ${blk.short}</td></tr>`;
      const timeRows = times.map(time => {
        const cells = dates.map(d => {
          const slot = byDate[d]?.[time];
          if (!slot) return `<td style="background:#F3F4F6;border:1px solid #E5E7EB;"></td>`;
          const isAvail = avail[slot.id] === 'available';
          return `<td style="padding:2px;border:1px solid #E5E7EB;">
            <button onclick="POLL_editToggle('${eventId}','${participantId}','${slot.id}')" id="edit-cell-${slot.id}"
              style="width:100%;height:32px;border:${isAvail?'2px solid #6EE7B7':'1px solid #E5E7EB'};cursor:pointer;background:${isAvail?'#D1FAE5':'#F9FAFB'};border-radius:3px;transition:all .1s;display:flex;align-items:center;justify-content:center;font-size:.9rem;font-weight:700;color:${isAvail?'#065F46':'#D1D5DB'};"
              onmouseover="this.style.filter='brightness(.93)'" onmouseout="this.style.filter=''">
              ${isAvail?'✓':''}
            </button></td>`;
        }).join('');
        return `<tr>
          <td style="padding:3px 10px;background:#FAFAF8;border:1px solid #E5E7EB;white-space:nowrap;font-size:.74rem;color:#374151;font-weight:500;">${POLL.fmtTime(time)}</td>
          ${cells}
        </tr>`;
      }).join('');
      return sectionRow + timeRows;
    }).join('');

    return `<div style="overflow-x:auto;max-height:60vh;overflow-y:auto;">
      <table style="border-collapse:collapse;width:100%;">
        <thead>
          <tr>
            <th style="padding:8px 10px;background:#0B1F3A;color:#C09D5F;font-size:.62rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;border:1px solid #0B1F3A;white-space:nowrap;min-width:84px;">Time</th>
            ${dateHeaders}
          </tr>
        </thead>
        <tbody>${blockRows}</tbody>
      </table>
    </div>`;
  };

  // Store working copy on window for toggles to mutate
  window._pollEditAvail = window._pollEditAvail || {};
  window._pollEditAvail[participantId] = avail;

  modal.open(`
    <div class="modal-header" style="background:#0B1F3A;border-radius:18px 18px 0 0;">
      <h3 class="modal-title" style="color:#fff">Edit Availability — ${esc(par.name)}</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div style="padding:20px 24px;">
      <p style="font-size:.82rem;color:#6B7280;margin:0 0 14px;">Toggle cells to set this participant's availability on their behalf.</p>
      <div id="poll-edit-grid">${buildGrid()}</div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px;">
        <button onclick="closeModal()" style="padding:9px 20px;border:1px solid #D1D5DB;border-radius:8px;background:#fff;color:#6B7280;font-size:.82rem;font-weight:600;cursor:pointer;font-family:'Montserrat',sans-serif;">Cancel</button>
        <button onclick="POLL_saveEditResponse('${eventId}','${participantId}')" style="padding:9px 22px;border:none;border-radius:8px;background:#0B1F3A;color:#C09D5F;font-size:.82rem;font-weight:700;cursor:pointer;font-family:'Montserrat',sans-serif;letter-spacing:.04em;">Save Availability</button>
      </div>
    </div>`);
};

window.POLL_editToggle = function(eventId, participantId, slotId) {
  if (!window._pollEditAvail) return;
  const avail = window._pollEditAvail[participantId];
  if (!avail) return;
  avail[slotId] = avail[slotId] === 'available' ? 'unavailable' : 'available';
  const btn = document.getElementById('edit-cell-' + slotId);
  if (!btn) return;
  const nowAvail = avail[slotId] === 'available';
  btn.style.background = nowAvail ? '#D1FAE5' : '#F9FAFB';
  btn.style.border      = nowAvail ? '2px solid #6EE7B7' : '1px solid #E5E7EB';
  btn.style.color       = nowAvail ? '#065F46' : '#D1D5DB';
  btn.innerHTML         = nowAvail ? '✓' : '';
};

window.POLL_saveEditResponse = function(eventId, participantId) {
  const ev  = S.events.find(e => e.id === eventId);
  const par = ev?.participants.find(p => p.id === participantId);
  if (!ev || !par) return;
  const avail = (window._pollEditAvail || {})[participantId];
  if (!avail) return;
  par.availability = Object.assign({}, avail);
  par.status = 'manually-entered';
  EMAIL.addHistory(eventId, `Scheduler updated availability for ${par.name}`);
  delete (window._pollEditAvail || {})[participantId];
  STORE.save();
  AVAIL.checkAutoConfirm(eventId);
  STORE.save();
  modal.close();
  toast(`Availability for ${par.name} updated.`, 'success', 4000);
  VIEWS.eventDetail(eventId);
};

// Expose POLL to global scope
window.POLL = POLL;

/* ── Expose to global scope for inline onclick handlers ── */
window.EMAIL  = EMAIL;
window.EVENTS = EVENTS;
window.VIEWS  = VIEWS;
window.AUTH   = AUTH;
window.S      = S;
window.AVAIL  = AVAIL;
window.STORE  = STORE;
window.ROUTER = ROUTER;
window.modal  = modal;
window.toast  = toast;

/* ── Init ─────────────────────────────────────────────── */
let _routerReady = false;
function _appInit() {
  fbAuth.onAuthStateChanged(async (firebaseUser) => {
    if (!_routerReady) {
      // First auth state — determine initial user and start router
      if (firebaseUser) {
        const doc = await db.collection('userProfiles').doc(firebaseUser.uid).get();
        if (doc.exists) {
          S.user = doc.data();
          await STORE.load();
          EVENTS.archiveExpired();
        }
      }
      _routerReady = true;
      ROUTER.init();
    }
    // Subsequent auth changes (login/register/logout) are handled
    // explicitly by AUTH_login, AUTH_register, AUTH.logout
  });
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _appInit);
} else {
  _appInit();
}

