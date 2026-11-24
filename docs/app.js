import { firebaseConfig, ADMIN_USERNAME, ADMIN_EMAIL } from './firebase-config.js';
let initializeApp, getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
 getFirestore, collection, doc, getDoc, getDocs, query, where, runTransaction,
 getStorage, ref, uploadBytes, getDownloadURL, deleteObject, getMetadata;

const main = document.querySelector('main');
const states = ['Recibido', 'En trámite', 'Atendido'];
const destinations = {
  'Gestión institucional': ['Mesa de partes', 'Dirección general', 'Administración', 'Secretaría', 'Calidad'],
  'Gestión académica': ['Secretaría académica', 'Unidad académica', 'Bienestar y empleabilidad', 'Investigación e innovación tecnológica'],
  'Coordinaciones de programas': ['Construcción Civil', 'Producción Agropecuaria', 'Arquitectura de Plataformas y Servicios de Tecnologías de la Información']
};
const programs = [
  { slug: 'agropecuaria', area: 'Producción Agropecuaria', summary: 'Manejo de cultivos, producción pecuaria y gestión de empresas agroalimentarias.' },
  { slug: 'construccion', area: 'Construcción Civil', summary: 'Diseño estructural, materiales, seguridad y ejecución de obras.' },
  { slug: 'tecnologias', area: 'Arquitectura de Plataformas y Servicios de Tecnologías de la Información', summary: 'Programación, desarrollo de software, administración de plataformas digitales y soporte técnico.' }
];
const milestones = [
  ['1989', 'El instituto fue creado el 12 de julio mediante la Resolución Ministerial N.º 448-89-ED.'],
  ['1990', 'Las clases comenzaron en abril con 101 estudiantes de Agropecuaria, distribuidos en dos secciones.'],
  ['1994', 'El instituto adoptó el nombre Manuel Scorza Torre.'],
  ['1998', 'Se autorizó la carrera de Construcción Civil.'],
  ['2000', 'Se autorizó la carrera de Computación e Informática.']
];

let app, auth, db, storage;
let firebaseReady = false;
let firebaseInitError = '';
let authReadyResolve;
const authReady = new Promise(resolve => { authReadyResolve = resolve; });
let currentUser = null;
let session = { admin: false, signedIn: false };
let trackingKey = '';
async function waitForFirebase(){let timer;try {await Promise.race([authReady,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('La conexión tarda demasiado. Revisa Internet y vuelve a intentar.')),15000)})])}finally{clearTimeout(timer)}}
try {trackingKey=sessionStorage.getItem('mst-tracking')||''} catch {}
let connected = false;
let version = 0;

async function initializeFirebase() {
 try {
  const base='https://www.gstatic.com/firebasejs/13.4.0/';
  const modules=await Promise.all(['app','auth','firestore','storage'].map(name=>import(base+'firebase-'+name+'.js')));
  ({initializeApp}=modules[0]);
  ({getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut}=modules[1]);
  ({getFirestore,collection,doc,getDoc,getDocs,query,where,runTransaction}=modules[2]);
  ({getStorage,ref,uploadBytes,getDownloadURL,deleteObject,getMetadata}=modules[3]);
  app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);storage=getStorage(app);
  await new Promise((resolve,reject)=>{let unsubscribe=onAuthStateChanged(auth,()=>{unsubscribe();resolve()},reject)});
  currentUser=auth.currentUser;firebaseReady=true;
 } catch(error) {firebaseInitError=friendlyError(error)}
 finally {authReadyResolve()}
}
initializeFirebase();

function destinationOptions(selected) {
  return Object.entries(destinations).map(([group, names]) =>
    '<optgroup label="' + esc(group) + '">' + opts(names, selected) + '</optgroup>'
  ).join('');
}
const fmt = t => new Date(t).toLocaleString('es-PE', { timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short' });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const opts = (a, v) => a.map(s => '<option ' + (s === v ? 'selected' : '') + '>' + esc(s) + '</option>').join('');
const code = r => 'MST-' + new Date(r.time).toLocaleDateString('en-US', { year: 'numeric', timeZone: 'America/Lima' }) + '-' + String(r.id).padStart(6, '0');
const internalNumber = r => r.internalNumber || ('DOC-' + new Date(r.time).toLocaleDateString('en-US', { year: 'numeric', timeZone: 'America/Lima' }) + '-' + String(r.id).padStart(6, '0'));
const randomHex = bytes => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), b => b.toString(16).padStart(2, '0')).join('');

function friendlyError(error) {
  const code = error?.code || '';
  const map = {
    'auth/invalid-credential': 'Usuario o contraseña incorrectos.',
    'auth/user-not-found': 'La cuenta de administrador todavía no existe en Firebase Authentication.',
    'auth/wrong-password': 'Usuario o contraseña incorrectos.',
    'auth/too-many-requests': 'Firebase bloqueó temporalmente los intentos. Espera y vuelve a probar.',
    'auth/unauthorized-domain': 'Este dominio no está autorizado. Agrega localhost o 127.0.0.1 en Firebase Authentication → Configuración → Dominios autorizados.',
    'auth/network-request-failed': 'No hay conexión con Firebase. Revisa Internet y vuelve a intentar.',
    'auth/operation-not-allowed': 'Activa Correo electrónico/contraseña en Firebase Authentication.',
    'auth/configuration-not-found': 'Falta activar Authentication en tu proyecto Firebase.',
    'permission-denied': 'Firebase rechazó la operación. Revisa que hayas publicado firestore.rules y storage.rules.',
    'storage/unauthorized': 'Firebase Storage rechazó el archivo. Revisa storage.rules y que Storage esté habilitado.',
    'storage/bucket-not-found': 'No se encuentra el bucket de Firebase Storage. Habilita Storage y verifica el bucket configurado.',
    'unavailable': 'Firebase no está disponible en este momento. Vuelve a intentar.'
  };
  return map[code] || error?.message || 'No se pudo completar la operación. Revisa la configuración de Firebase.';
}

function ensureFirebase() {
  if (!firebaseReady) throw new Error(firebaseInitError || 'No se pudo iniciar Firebase. Revisa web/firebase-config.js.');
}

async function refreshSession() {
  await waitForFirebase();
  currentUser = auth ? auth.currentUser : null;
  if (!currentUser) {
    session = { admin: false, signedIn: false };
    return session;
  }
  try {
    const adminSnap = await getDoc(doc(db, 'admins', currentUser.uid));
    session = { admin: adminSnap.exists() && adminSnap.data().role === 'admin', signedIn: true };
  } catch (error) {
    session = { admin: false, signedIn: true };
    throw error;
  }
  return session;
}

function safeRecord(record, isAdmin) {
  const copy = { ...record, log: (record.log || []).map(item => ({ ...item })) };
  if (!isAdmin) copy.log = copy.log.map(({ area, state, time }) => ({ area, state, time, note: '' }));
  return copy;
}

async function registerDocument(formData, token) {
  ensureFirebase();
  const subject = String(formData.get('subject') || '').trim();
  const sender = String(formData.get('sender') || '').trim();
  const type = String(formData.get('type') || 'Solicitud');
  const number = String(formData.get('number') || '').trim();
  const area = String(formData.get('area') || 'Mesa de partes');
  const folios = Number(formData.get('folios'));
  const file = formData.get('file');
  const allowedAreas = Object.values(destinations).flat();
  if (!subject || subject.length > 220 || !sender || sender.length > 180) throw new Error('Completa el asunto y el nombre del remitente.');
  if (!['Solicitud', 'Oficio', 'Carta', 'Informe', 'Otro'].includes(type)) throw new Error('Selecciona un tipo de documento válido.');
  if (!allowedAreas.includes(area)) throw new Error('Selecciona un área de destino válida.');
  if (!Number.isInteger(folios) || folios < 1 || folios > 99999) throw new Error('El número de folios debe ser un entero mayor que cero.');
  const hasFile = file instanceof File && file.size > 0;
  if (hasFile) {
    const validType = ['application/pdf', 'image/jpeg', 'image/png'].includes(file.type);
    if (!validType || file.size > 10 * 1024 * 1024) throw new Error('Adjunta un PDF, JPG o PNG de hasta 10 MB.');
  }

  const docId = token || randomHex(16);
  const existing=await getDoc(doc(db,'expedientes',docId));
  if(existing.exists()) return {id:existing.data().id,key:existing.data().id+'-'+docId};
  const time = Date.now();
  const filename = hasFile ? file.name.slice(0, 255) : '';
  const storagePath = hasFile ? 'attachments/' + docId : '';

  if (hasFile) {
    try {
      let uploaded=false;
      try {const metadata=await getMetadata(ref(storage,storagePath));uploaded=metadata.size===file.size && metadata.contentType===file.type; if(!uploaded) throw new Error('El adjunto cambió después del intento anterior. Abre un nuevo formulario.')}
      catch(error){if(error.code!=='storage/object-not-found') throw error}
      if(!uploaded) await uploadBytes(ref(storage, storagePath), file, { contentType: file.type, customMetadata: { expediente: docId } });
    } catch (error) {
      throw new Error(friendlyError(error));
    }
  }

  let id;
  try {
    id = await runTransaction(db, async transaction => {
      const counterRef = doc(db, 'config', 'counter');
      const recordRef = doc(db, 'expedientes', docId);
      const counterSnap = await transaction.get(counterRef);
      const next = counterSnap.exists() ? Number(counterSnap.data().value) + 1 : 1;
      const year = new Date(time).toLocaleDateString('en-US', { year: 'numeric', timeZone: 'America/Lima' });
      const record = {
        id: next, time, subject, sender, type, number, area, folios, filename,
        state: 'Recibido',
        internalNumber: 'DOC-' + year + '-' + String(next).padStart(6, '0'),
        storagePath,
        log: [{ time, state: 'Recibido', area, note: 'Ingreso por mesa de partes.' }]
      };
      transaction.set(counterRef, { value: next });
      transaction.set(doc(db,'registroVinculo','actual'), {value: next, token: docId});
      transaction.set(recordRef, record);
      return next;
    });
  } catch (error) {
    // Keep the uploaded file on uncertain commits; administrators can clean orphan files.
    throw new Error(friendlyError(error));
  }
  return { id, key: id + '-' + docId };
}

async function findRecord(id) {
  const numericId = Number(id);
  if (!Number.isSafeInteger(numericId) || numericId < 1) throw new Error('Número de expediente no válido.');
  if (session.admin) {
    const result = await getDocs(query(collection(db, 'expedientes'), where('id', '==', numericId)));
    if (result.empty) return null;
    const item = result.docs[0];
    const record=safeRecord(item.data(),true);
    const notes=await getDoc(doc(db,'notasInternas',item.id));
    if(notes.exists()) for(const [i,note] of Object.entries(notes.data().notes||{})) if(record.log[Number(i)]) record.log[Number(i)].note=note;
    return {...record,_docId:item.id};
  }
  const match = trackingKey.match(/^(\d+)-([a-f0-9]{32})$/);
  if (!match || Number(match[1]) !== numericId) throw new Error('Ingresa la clave completa que aparece en tu cargo de recepción.');
  const snap = await getDoc(doc(db, 'expedientes', match[2]));
  if (!snap.exists() || Number(snap.data().id) !== numericId) throw new Error('No se encontró el expediente. Verifica la clave de seguimiento.');
  return { ...safeRecord(snap.data(), false), _docId: snap.id };
}

async function api(path, options = {}) {
  await waitForFirebase();
  ensureFirebase();
  const method = (options.method || 'GET').toUpperCase();
  if (path === 'session') {
    await refreshSession();
    return { ...session, local: false, firebase: true };
  }
  if (path === 'login' && method === 'POST') {
    let input;
    try { input = JSON.parse(options.body || '{}'); } catch { throw new Error('Completa usuario y contraseña.'); }
    if (String(input.username || '').trim().toLowerCase() !== ADMIN_USERNAME) throw new Error('Usuario o contraseña incorrectos.');
    try {
      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, String(input.password || ''));
      await refreshSession();
      if (!session.admin) {
        await signOut(auth);
        session = { admin: false, signedIn: false };
        throw new Error('La cuenta inició sesión, pero no tiene permisos de administrador. Revisa el documento admins en Firestore.');
      }
      return { ok: true };
    } catch (error) { throw new Error(friendlyError(error)); }
  }
  if (path === 'logout' && method === 'POST') {
    await signOut(auth);
    session = { admin: false, signedIn: false };
    return { ok: true };
  }
  if (path === 'register' && method === 'POST') return registerDocument(options.body,options.token);
  if (path === 'records' && method === 'GET') {
    if (!session.admin) throw new Error('Acceso administrativo requerido.');
    const result = await getDocs(collection(db, 'expedientes'));
    return result.docs.map(item => ({ ...safeRecord(item.data(), true), _docId: item.id })).sort((a, b) => b.id - a.id);
  }
  const match = path.match(/^record\/(\d+)(?:\/(move|file))?$/);
  if (match) {
    const [, id, action] = match;
    const record = await findRecord(id);
    if (!record) throw new Error('Expediente no encontrado.');
    if (action === 'file' && method === 'GET') {
      if (!record.storagePath) throw new Error('Este expediente no tiene archivo adjunto.');
      try { return await getDownloadURL(ref(storage, record.storagePath)); }
      catch (error) { throw new Error(friendlyError(error)); }
    }
    if (action === 'move' && method === 'POST') {
      if (!session.admin) throw new Error('Solo el administrador puede derivar expedientes.');
      let input;
      try { input = JSON.parse(options.body || '{}'); } catch { throw new Error('Movimiento no válido.'); }
      const allowedAreas = Object.values(destinations).flat();
      if (!states.includes(input.state) || !allowedAreas.includes(input.area) || typeof input.note !== 'string' || input.note.length > 1000) throw new Error('Revisa el estado, área y observación.');
      const recordRef = doc(db, 'expedientes', record._docId);
      await runTransaction(db, async transaction => {
        const notesRef=doc(db,'notasInternas',record._docId);
        const snap = await transaction.get(recordRef);
        const notesSnap=await transaction.get(notesRef);
        if (!snap.exists()) throw new Error('El expediente ya no existe.');
        const latest = snap.data();
        if (input.revision !== latest.log.length) throw new Error('El expediente cambió. Actualiza la página y vuelve a intentar.');
        const entry = { time: Date.now(), state: input.state, area: input.area, note: '' };
        const notes=notesSnap.exists()?notesSnap.data().notes||{}:{};
        if(input.note.trim()) notes[String(latest.log.length)]=input.note.trim();
        transaction.set(notesRef,{notes});
        transaction.update(recordRef, { state: input.state, area: input.area, log: [...latest.log, entry] });
      });
      return { ok: true };
    }
    return record;
  }
  throw new Error('Operación no reconocida.');
}

const paths = [
  'M3 7h7l2 2h9v10H3z M3 7V5h7l2 2h7v2',
  'M4 5h16v14H4z M4 13h4l2 3h4l2-3h4',
  'M12 3a9 9 0 1 0 9 9a9 9 0 0 0-9-9z M12 7v6l4 2',
  'M3 12l6 6L21 6'
];

function entry(r) {
  return '<a class="record" href="#exp/' + r.id + '"><div class="row"><small>' + code(r) + ' · ' + esc(internalNumber(r)) + '</small><span class="status">' + esc(r.state) + '</span></div><strong>' + esc(r.subject) + '</strong><small>' + esc(r.sender) + ' · ' + esc(r.area) + '</small></a>';
}

function formPage(selected) {
  return '<h1 class="page">Nuevo expediente</h1><form class="panel narrow" id="new"><h2>Datos del documento</h2><div class="fields"><label>Tipo de documento<select name="type">' + opts(['Solicitud', 'Oficio', 'Carta', 'Informe', 'Otro']) + '</select></label><label>Número interno de documento<span class="auto-field">Correlativo automático al registrar</span></label></div><label>Referencia del remitente (opcional)<input name="number" maxlength="70" placeholder="Ej. Oficio 025-2026"></label><label>Asunto<input required name="subject" maxlength="220"></label><label>Nombre del remitente o razón social<input required name="sender" maxlength="180"></label><div class="fields"><label>Área de destino<select name="area">' + destinationOptions(selected) + '</select></label><label>Número de folios<input required type="number" name="folios" value="1" min="1" max="99999"></label></div><label>Documento adjunto (opcional)<input type="file" name="file" accept=".pdf,.jpg,.jpeg,.png"><small>PDF, JPG o PNG de hasta 10 MB.</small></label><div><button>Registrar expediente</button></div><output role="status"></output></form>';
}

function institutionPage() {
  return '<h1 class="page">El instituto</h1><section class="institution-intro"><div><span class="eyebrow">Acobamba · Huancavelica</span><h2>Manuel Scorza Torre</h2><p>El instituto forma profesionales técnicos mediante clases y prácticas vinculadas con la producción agropecuaria, la construcción y los servicios de tecnología.</p></div><figure><img src="sede.webp" alt="Vista exterior del edificio del instituto"><figcaption>Sede del IESTP Manuel Scorza Torre en Acobamba.</figcaption></figure></section><div class="sectionhead"><h2>Programas de estudio</h2></div><div class="programs">' + programs.map(p => '<article class="panel"><h3>' + esc(p.area) + '</h3><p>' + esc(p.summary) + '</p><a class="link" href="#registro/' + p.slug + '">Registrar expediente para este programa →</a></article>').join('') + '</div><div class="sectionhead"><h2>Reseña histórica</h2></div><section class="panel"><ol class="timeline">' + milestones.map(([year, event]) => '<li><strong>' + year + '</strong><div>' + event + '</div></li>').join('') + '</ol><a class="link" href="https://iestmst.edu.pe/presentacion/" target="_blank" rel="noopener">Ver presentación, fotografía y reseña en el portal del instituto ↗</a></section>';
}

function home(rows) {
  const nums = [rows.length, ...states.map(s => rows.filter(r => r.state === s).length)];
  return '<section class="hero"><div class="portal-copy"><span class="eyebrow">Gestión documental</span><h1>Mesa de partes</h1><p>Registro y seguimiento de expedientes del instituto.</p><a class="btn" href="#registro"><b>＋</b> Nuevo expediente</a><a class="about-link" href="#instituto">Conoce el instituto →</a></div><img class="campus" src="sede.webp" alt="Sede del instituto en Acobamba"></section><div class="sectionhead"><h2>Resumen de expedientes</h2><span class="date">' + new Date().toLocaleDateString('es-PE', { dateStyle: 'long', timeZone: 'America/Lima' }) + '</span></div><div class="metrics">' + ['Total registrado', 'Recibidos', 'En trámite', 'Atendidos'].map((s, i) => '<a class="metric" href="#bandeja' + (i ? '/' + (i - 1) : '') + '"><span class="icon m' + i + '"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="' + paths[i] + '"/></svg></span><div><strong>' + nums[i] + '</strong><small>' + s + '</small></div></a>').join('') + '</div><div class="lower"><section class="panel"><div class="sectionhead"><h2>Últimos expedientes</h2><a class="link" href="#bandeja">Ver bandeja →</a></div>' + (rows.slice(0, 3).map(entry).join('') || '<div class="empty">Aún no hay expedientes registrados.</div>') + '</section><section class="card"><small style="color:white">Archivo documental</small><a href="#bandeja">Consultar expedientes →</a></section></div>';
}

function detail(r) {
  const pairs = [
    ['Fecha de ingreso', fmt(r.time)], ['Remitente', r.sender], ['N.º de documento', internalNumber(r)],
    ['Tipo de documento', r.type], ...(r.number ? [['Referencia del remitente', r.number]] : []),
    ['Asunto', r.subject], ['Folios', r.folios], ['Destino inicial', r.log[0].area], ['Adjunto', r.filename || 'Sin adjunto']
  ];
  return '<a class="link noprint" href="#bandeja">← Volver a la bandeja</a><div class="panel narrow report"><img class="receipt-logo" src="instituto.png" alt="Instituto Manuel Scorza Torre"><small>IESTP Manuel Scorza Torre · Acobamba, Huancavelica</small><h1 class="page">Cargo de recepción</h1><span class="pill">Expediente</span> <strong>' + code(r) + '</strong><dl>' + pairs.map(([k, v]) => '<dt>' + k + '</dt><dd>' + esc(v) + '</dd>').join('') + '</dl></div><div class="noprint"><div class="tools"><button id="print">Imprimir cargo / PDF</button>' + (r.filename ? '<button class="light" id="download">Descargar adjunto</button>' : '') + '</div><section class="panel narrow"><div class="sectionhead"><h2>Seguimiento</h2><span class="status">' + esc(r.state) + '</span></div><p>Área responsable · <strong>' + esc(r.area) + '</strong></p><ol class="timeline">' + r.log.slice().reverse().map(e => '<li><strong>' + esc(e.state) + ' · ' + esc(e.area) + '</strong><br><small>' + fmt(e.time) + '</small><div>' + esc(e.note) + '</div></li>').join('') + '</ol><form id="move"><h2>Registrar movimiento</h2><div class="fields"><label>Estado<select name="state">' + opts(states, r.state) + '</select></label><label>Área responsable<select name="area">' + destinationOptions(r.area) + '</select></label></div><label>Observación interna (solo administración)<textarea name="note" maxlength="1000"></textarea></label><div><button>Guardar movimiento</button></div><output role="status"></output></form></section></div>';
}

function bindForm(id, handler) {
  const form = document.getElementById(id);
  form.onsubmit = async event => {
    event.preventDefault();
    const button = form.querySelector('button');
    const output = form.querySelector('output');
    button.disabled = true;
    if (output) output.textContent = 'Procesando…';
    form.setAttribute('aria-busy','true');
    try {
      await handler(form, new FormData(form));
    } catch (error) {
      if (output) output.textContent = friendlyError(error);
      else alert(friendlyError(error));
    } finally {
      form.removeAttribute('aria-busy');
      if (button.isConnected) button.disabled = false;
    }
  };
}

async function register(form, data) {
  form.dataset.token ||= randomHex(16);
  const receipt = await api('register', { method: 'POST', body: data, token: form.dataset.token });
  trackingKey = receipt.key;
  try {sessionStorage.setItem('mst-tracking',trackingKey)} catch {}
  location.hash = 'exp/' + receipt.id;
}

function publicHome() {
  return '<section class="welcome"><div class="welcome-copy"><span class="eyebrow">Servicios a la comunidad educativa</span><h1>Tus trámites,<br><em>más cerca.</em></h1><p>Mesa de partes digital del Instituto Manuel Scorza Torre. Presenta tu documento sin crear una cuenta y consulta cada avance con la clave de tu cargo.</p><div class="hero-actions"><a class="btn" href="#registro">Presentar documento <span>↗</span></a><a class="secondary-action" href="#consulta">Consultar trámite →</a></div></div><figure class="welcome-photo"><img src="sede.webp" alt="Sede del Instituto Manuel Scorza Torre en Acobamba"><figcaption><span>Nuestro instituto</span><strong>Formación técnica en Acobamba</strong><a href="#instituto">Conócenos ↗</a></figcaption></figure></section><section class="service-grid" aria-label="Servicios digitales"><a href="#registro" class="service"><span class="service-symbol">＋</span><div><h2>Presenta tu documento</h2><p>Registra tu solicitud y obtén tu cargo de recepción.</p></div><span>↗</span></a><a href="#consulta" class="service"><span class="service-symbol">⌕</span><div><h2>Consulta tu trámite</h2><p>Revisa el estado usando tu clave de seguimiento.</p></div><span>↗</span></a></section><section class="academic"><div class="sectionhead"><div><span class="eyebrow">Formación profesional</span><h2>Nuestros programas de estudio</h2></div><a class="link" href="#instituto">Explora el instituto →</a></div><div class="programs">' + programs.map(p => '<article class="panel"><h3>' + esc(p.area) + '</h3><p>' + esc(p.summary) + '</p><a class="link" href="#registro/' + p.slug + '">Enviar documento al programa →</a></article>').join('') + '</div></section>' + helpSection();
}

function setupConsult() {
  main.innerHTML = '<h1 class="page">Consultar mi trámite</h1><form class="panel narrow" id="lookup"><label>Clave de seguimiento<input name="key" required autocomplete="off" spellcheck="false"></label><small>La encontrarás en tu cargo de recepción.</small><div><button>Consultar expediente</button></div><output role="status"></output></form>';
  bindForm('lookup', async (form, data) => {
    const key = String(data.get('key') || '').trim();
    const match = key.match(/^(\d+)-([a-f0-9]{32})$/);
    if (!match) throw new Error('Copia la clave completa del cargo de recepción.');
    trackingKey = key;
    try {sessionStorage.setItem('mst-tracking',trackingKey)} catch {}
    await api('record/' + match[1]);
    location.hash = 'exp/' + match[1];
  });
}

async function render() {
  const current = ++version;
  main.setAttribute('tabindex','-1');
  const [page = 'inicio', id] = location.hash.slice(1).split('/');
  document.querySelectorAll('nav a').forEach(a => {
    a.removeAttribute('aria-current');
    if (a.hash === '#' + (page === 'exp' ? 'consulta' : page || 'inicio')) a.setAttribute('aria-current', 'page');
  });
  try {
    if ((page === 'admin' || page === 'bandeja') && !session.admin) {
      main.innerHTML = '<h1 class="page">Acceso de administrador</h1><form id="login" class="panel narrow"><p>Ingresa con tu usuario y contraseña para gestionar los expedientes.</p><label>Usuario<input name="username" autocomplete="username" required></label><label>Contraseña<input name="password" type="password" autocomplete="current-password" required></label><div><button>Ingresar</button></div><output role="status"></output><a href="#inicio">Volver al inicio →</a></form>';
      bindForm('login', async (form, data) => {
        await api('login', { method: 'POST', body: JSON.stringify({ username: data.get('username'), password: data.get('password') }) });
        await start();
        location.hash = 'bandeja';
      });
      return;
    }
    if (page === 'consulta') { setupConsult(); return; }
    if (page === 'instituto') { main.innerHTML = institutionPage(); return; }
    if (page === 'registro') { const program = programs.find(item => item.slug === id); main.innerHTML = formPage(program?.area); bindForm('new', register); return; }
    if (page === 'exp') {
      const record = await api('record/' + Number(id));
      if (current !== version) return;
      if (!record) { main.textContent = 'Expediente no encontrado.'; return; }
      main.innerHTML = detail(record);
      if (trackingKey.startsWith(record.id + '-')) {
        const line = document.createElement('p');
        line.className = 'tracking';
        line.textContent = 'Clave de seguimiento · ' + trackingKey + ' · Guárdala para futuras consultas.';
        const copy=document.createElement('button');copy.type='button';copy.className='light noprint';copy.textContent='Copiar clave';
        copy.onclick=async()=>{try{await navigator.clipboard.writeText(trackingKey);copy.textContent='Clave copiada'}catch{copy.textContent='Selecciona la clave y cópiala'}};line.append(copy);
        main.querySelector('.report').append(line);
      }
      if (!session.admin) {
        document.getElementById('move').remove();
        const back = main.querySelector('.link');
        back.href = '#consulta';
        back.textContent = '← Consultar otro trámite';
      }
      document.getElementById('print').onclick = () => window.print();
      if (record.filename) document.getElementById('download').onclick = async () => {
        try {
          const url = await api('record/' + record.id + '/file');
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.target = '_blank';
          anchor.rel = 'noopener';
          anchor.download = record.filename;
          anchor.click();
        } catch (error) { alert(friendlyError(error)); }
      };
      if (session.admin) bindForm('move', async (form, data) => {
        const state = data.get('state'), area = data.get('area'), note = String(data.get('note') || '').trim();
        if (state === record.state && area === record.area && !note) throw new Error('Cambia el estado, el área o agrega una observación.');
        await api('record/' + record.id + '/move', { method: 'POST', body: JSON.stringify({ state, area, note, revision: record.log.length }) });
        await render();
      });
      return;
    }
    if (!session.admin) { main.innerHTML = publicHome(); return; }
    const rows = await api('records');
    if (current !== version) return;
    if (page !== 'bandeja') { main.innerHTML = home(rows); return; }
    main.innerHTML = '<h1 class="page">Bandeja de expedientes</h1><div class="panel"><div class="filters"><label>Buscar expediente<input type="search" id="query" placeholder="N.º, referencia, asunto o remitente"></label><label>Estado<select id="filter">' + opts(['Todos', ...states], states[Number(id)]) + '</select></label><label>Área responsable<select id="area-filter"><option value="">Todas las áreas</option>' + destinationOptions() + '</select></label></div><p class="sub" id="count"></p><div id="list"></div></div>';
    const q = document.getElementById('query'), filter = document.getElementById('filter'), areaFilter = document.getElementById('area-filter');
    function apply() {
      const norm = s => s.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const subset = rows.filter(r => (filter.value === 'Todos' || r.state === filter.value) && (!areaFilter.value || r.area === areaFilter.value) && norm([code(r), internalNumber(r), r.number, r.subject, r.sender].join(' ')).includes(norm(q.value.trim())));
      document.getElementById('count').textContent = subset.length + (subset.length === 1 ? ' expediente' : ' expedientes');
      document.getElementById('list').innerHTML = subset.map(entry).join('') || '<p class="empty">Sin expedientes para esta consulta.</p>';
    }
    q.oninput = filter.onchange = areaFilter.onchange = apply;
    apply();
  } catch (error) {
    main.innerHTML = '<section class="panel narrow"><h2>No se pudo cargar la información</h2><p class="notice">' + esc(friendlyError(error)) + '</p><p>Comprueba que Firestore, Authentication y las reglas de seguridad estén configurados. Puedes volver al inicio sin perder esta página.</p><a class="link" href="#inicio">Volver al inicio →</a></section>';
  }
}

function showConnectionStatus() {
  const bar = document.getElementById('accessbar');
  if (!bar) return;
  bar.hidden = !session.admin;
  bar.innerHTML = session.admin ? '<strong>Administrador conectado</strong><span><button id="logout" class="light">Cerrar sesión</button></span>' : '';
  document.getElementById('logout')?.addEventListener('click', async () => {
    try { await api('logout', { method: 'POST' }); trackingKey = ''; try{sessionStorage.removeItem('mst-tracking')}catch{} await start(); location.hash = 'inicio'; }
    catch (error) { alert(friendlyError(error)); }
  });
  const inbox = document.getElementById('inbox');
  if (inbox) inbox.hidden = !session.admin;
}

async function navigate() {
  await render();
  showConnectionStatus();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', navigate);

async function start() {
  try {
    await waitForFirebase();
    ensureFirebase();
    await refreshSession();
    connected = true;
    firebaseInitError = '';
  } catch (error) {
    connected = false;
    session = { admin: false, signedIn: false };
    firebaseInitError = friendlyError(error);
  }
  showConnectionStatus();
  if(session.admin) await render();
}
render();
start();

function helpSection(){return `<section class="how"><div class="sectionhead"><div><span class="eyebrow">Un proceso sencillo</span><h2>Tu trámite, paso a paso</h2></div></div><ol class="steps"><li><b>01</b><h3>Prepara tu documento</h3><p>Indica el asunto, el remitente y el área de destino. Puedes adjuntar un PDF, JPG o PNG de hasta 10 MB.</p></li><li><b>02</b><h3>Guarda tu cargo</h3><p>Recibirás un número automático y una clave de seguimiento. Imprime el cargo o guárdalo como PDF.</p></li><li><b>03</b><h3>Consulta el avance</h3><p>Usa tu clave para conocer el estado y el área responsable de tu expediente.</p></li></ol></section><section class="faq"><h2>Antes de presentar tu documento</h2><details><summary>¿Necesito crear una cuenta?</summary><p>No. El registro y la consulta son públicos. Solo el personal autorizado inicia sesión.</p></details><details><summary>¿Qué significa que mi documento esté recibido?</summary><p>El sistema confirmó el registro. No significa que la solicitud haya sido aprobada o atendida.</p></details><details><summary>¿Cómo protejo mi clave de seguimiento?</summary><p>Guárdala con tu cargo. Quien tenga esa clave podrá consultar el expediente y su adjunto.</p></details></section>`}
