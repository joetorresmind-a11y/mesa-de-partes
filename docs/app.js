import { cloud } from "./data.js";
import {
  AREAS,
  STATES,
  TYPES,
  esc,
  date,
  code,
  trackingKey,
  randomKey,
  validateApplicant,
  validateRequest,
  validateFile,
  parseKey,
  friendly,
  csv,
} from "./domain.js";
const main = document.getElementById("main");
let identity = { role: "public" },
  routeId = 0,
  lastKey = "",
  cachedRecords = [],
  pageNumber = 1;
document.querySelector(".skip").addEventListener("click", (event) => {
  event.preventDefault();
  main.focus();
  main.scrollIntoView({ block: "start" });
});
try {
  lastKey = sessionStorage.getItem("mst-tracking") || "";
} catch {}
const paths = {
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h5",
  search: "M21 21l-4.4-4.4 M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0",
  check: "M20 6L9 17l-5-5",
  shield: "M12 3l8 4v6c0 5-8 9-8 9s-8-4-8-9V7z M8 12l3 3 5-6",
  clock: "M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  send: "M22 2L9 15 M22 2l-7 20-4-9-9-4z",
  download: "M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  inbox: "M4 4h16v16H4z M4 13h5l2 3h2l2-3h5",
  lock: "M5 10h14v11H5z M8 10V6a4 4 0 0 1 8 0v4",
  help: "M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3 M12 17h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  print: "M6 8V3h12v5 M6 17H3V9h18v8h-3 M6 14h12v7H6z",
  copy: "M9 9h12v12H9z M15 9V3H3v12h6",
  edit: "M12 20H4V12 M15 5l4 4 M9 15l3-1L21 5l-4-4-9 9z",
  logout: "M9 3H3v18h6 M9 12h12 M17 8l4 4-4 4",
};
const icon = (name) =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.file}"/></svg>`;
const options = (items, selected) =>
  items
    .map(
      (x) =>
        `<option value="${esc(x)}" ${x === selected ? "selected" : ""}>${esc(x)}</option>`,
    )
    .join("");
const badge = (s) =>
  `<span class="badge ${String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ /g, "-")}">${esc(s)}</span>`;
const field = (label, name, attrs = "", full = false) =>
  `<label class="${full ? "full" : ""}">${label} <span class="required">*</span><input name="${name}" ${attrs} required></label>`;
const heading = (title, subtitle, extra = "") =>
  `<div class="pagehead"><div><div class="breadcrumb"><a href="#inicio">Inicio</a> / ${esc(title)}</div><h1>${esc(title)}</h1><p>${subtitle}</p></div>${extra}</div>`;
function toast(text) {
  const box = document.getElementById("toast");
  box.textContent = text;
  box.hidden = false;
  setTimeout(() => (box.hidden = true), 5000);
}
function modal(content) {
  document.getElementById("modal-content").innerHTML = content;
  document.getElementById("modal").showModal();
}
document.getElementById("close-modal").onclick = () =>
  document.getElementById("modal").close();
function remember(key) {
  lastKey = key;
  try {
    sessionStorage.setItem("mst-tracking", key);
  } catch {}
}
function bind(id, handler) {
  const form = document.getElementById(id);
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form),
      buttons = [...form.querySelectorAll("button")],
      out = form.querySelector("output");
    buttons.forEach((b) => (b.disabled = true));
    form.setAttribute("aria-busy", "true");
    if (out) out.textContent = "Procesando…";
    try {
      await handler(data, form);
      if (out?.isConnected) out.textContent = "";
    } catch (error) {
      if (out) out.textContent = friendly(error);
      else toast(friendly(error));
    } finally {
      buttons.forEach((b) => (b.disabled = false));
      form.removeAttribute("aria-busy");
    }
  };
}
function header() {
  const staff = ["area", "admin"].includes(identity.role);
  const link = document.getElementById("access-link");
  link.href = staff ? "#bandeja" : "#acceso";
  link.textContent = staff
    ? identity.role === "admin"
      ? "Administración"
      : "Mi área"
    : "Acceso institucional";
  document.getElementById("desk-link").hidden = !staff;
  document.querySelectorAll(".nav a").forEach((a) => {
    if (a.hash === (location.hash || "#inicio"))
      a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}
function home() {
  return `<section class="hero"><div class="hero-copy"><span class="eyebrow">Atención al ciudadano</span><h1>Tu trámite,<br><span>más cerca.</span></h1><p>Presenta tus documentos al Instituto Manuel Scorza Torre y consulta las respuestas de tu área de atención, desde un solo lugar.</p><div class="actions"><a class="button" href="#registro">${icon("send")} Presentar documento</a><a class="button outline" href="#consulta">Consultar trámite</a></div><p class="hero-note">${icon("shield")} Presentación sin crear una cuenta</p></div><figure class="hero-photo"><img src="sede.webp" alt="Sede del Instituto Manuel Scorza Torre en Acobamba"><figcaption class="photo-label"><span>EDUCACIÓN SUPERIOR TECNOLÓGICA PÚBLICA</span><strong>Manuel Scorza Torre</strong></figcaption></figure></section><section class="service-grid" aria-label="Servicios de mesa de partes">${[
    [
      "file",
      "Presenta tu solicitud",
      "Completa tus datos y adjunta tu documento.",
      "#registro",
    ],
    [
      "search",
      "Sigue tu expediente",
      "Revisa el estado y descarga las respuestas.",
      "#consulta",
    ],
    [
      "help",
      "Te orientamos",
      "Conoce los requisitos y nuestros contactos.",
      "#ayuda",
    ],
  ]
    .map(
      ([i, t, p, u]) =>
        `<a href="${u}" class="service-card"><span class="icon-box">${icon(i)}</span><div><h2>${t}</h2><p>${p}</p></div></a>`,
    )
    .join(
      "",
    )}</section><div class="section-title"><div><span class="eyebrow">Un proceso claro</span><h2>De tu solicitud a la respuesta</h2><p>Conserva tu clave para consultar el trámite cuando lo necesites.</p></div></div><section class="steps-overview">${[
    [
      "file",
      "Prepara tus datos",
      "Ten a mano tu DNI, celular, correo electrónico y el documento que presentarás.",
    ],
    [
      "send",
      "Recibe tu cargo",
      "Al confirmar el registro obtendrás un número de expediente y una clave personal.",
    ],
    [
      "download",
      "Consulta y descarga",
      "El área encargada podrá responderte y publicar documentos en tu seguimiento.",
    ],
  ]
    .map(([i, t, p]) => `<article>${icon(i)}<h3>${t}</h3><p>${p}</p></article>`)
    .join(
      "",
    )}</section><section class="support-banner">${icon("help")}<div><h2>¿Necesitas orientación para tu trámite?</h2><p>Comunícate con el instituto o consulta los requisitos antes de presentar tu documento.</p></div><a class="button white" href="#ayuda">Ver orientación</a></section>`;
}
function requestForm() {
  return (
    heading(
      "Presentar documento",
      "Completa los datos solicitados. Los campos con asterisco son obligatorios.",
    ) +
    `<div class="form-layout"><form class="panel" id="request-form" novalidate><ol class="wizard-tabs" aria-label="Pasos del formulario"><li class="active"><b>1</b>Datos personales</li><li><b>2</b>Documento</li><li><b>3</b>Confirmación</li></ol><fieldset data-step="0"><legend>Datos del solicitante</legend><p class="hint">Usaremos estos datos para gestionar tu solicitud y contactarte.</p><div class="fields">${field("Nombres", "names", 'autocomplete="given-name" minlength="2" maxlength="80"', true)}${field("Apellido paterno", "lastName1", 'autocomplete="family-name" minlength="2" maxlength="60"')}${field("Apellido materno", "lastName2", 'minlength="2" maxlength="60"')}${field("DNI", "dni", 'inputmode="numeric" pattern="[0-9]{8}" minlength="8" maxlength="8" placeholder="8 dígitos"')}${field("Celular", "mobile", 'type="tel" autocomplete="tel-national" inputmode="tel" pattern="9[0-9]{8}" minlength="9" maxlength="9" placeholder="9 dígitos"')}${field("Correo electrónico", "email", 'type="email" autocomplete="email" maxlength="180" placeholder="nombre@correo.com"', true)}${field("Domicilio", "address", 'autocomplete="street-address" minlength="8" maxlength="240" placeholder="Dirección, distrito y provincia"', true)}</div></fieldset><fieldset data-step="1" hidden><legend>Documento y destino</legend><p class="hint">Selecciona el área responsable. El número de expediente se genera al registrar.</p><div class="fields"><label>Tipo de documento <span class="required">*</span><select name="type" required>${options(TYPES, "Solicitud")}</select></label><label>Número de folios <span class="required">*</span><input name="folios" type="number" min="1" max="99999" value="1" required></label><label class="full">Área de destino <span class="required">*</span><select name="area" required>${options(AREAS, "Mesa de partes")}</select></label><label class="full">Referencia del documento <small>Opcional</small><input name="number" maxlength="70" placeholder="Por ejemplo, Oficio 025-2026"></label>${field("Asunto", "subject", 'minlength="5" maxlength="220" placeholder="Describe brevemente tu solicitud"', true)}<label class="full">Detalle de la solicitud <small>Opcional</small><textarea name="description" maxlength="3000" placeholder="Información adicional para el área responsable"></textarea></label><label class="file-box full">Documento principal <span class="required">*</span><input type="file" name="file" accept=".pdf,.jpg,.jpeg,.png" required><small>PDF, JPG o PNG · máximo 10 MB. Incluye el documento completo y legible.</small><span class="file-info" id="file-info"></span></label></div></fieldset><fieldset data-step="2" hidden><legend>Revisa antes de enviar</legend><p class="hint">Comprueba que tus datos y el área de destino sean correctos.</p><dl class="review-grid" id="review"></dl><label class="checkbox"><input type="checkbox" name="consent" required><span>Declaro que los datos y documentos presentados son correctos y autorizo su uso para gestionar este trámite, conforme al <a href="#privacidad" target="_blank" rel="noopener">aviso de privacidad</a>.</span></label><div class="notice">Al registrar, se generará tu cargo de recepción. La recepción no implica aprobación de la solicitud.</div></fieldset><div class="form-actions"><button class="button outline" id="back-step" type="button" hidden>Anterior</button><button class="button" id="next-step" type="button">Continuar</button><button class="button" id="submit-request" type="submit" hidden>Registrar expediente</button></div><output role="alert"></output></form><aside class="form-sidebar"><h2>Antes de comenzar</h2><ul class="checklist"><li>${icon("check")}Datos personales completos y DNI.</li><li>${icon("check")}Celular y correo de contacto activos.</li><li>${icon("check")}Documento legible de hasta 10 MB.</li><li>${icon("check")}Área de destino y asunto de tu solicitud.</li></ul><p class="subtle">Al finalizar, guarda tu clave. La necesitarás para consultar y descargar las respuestas.</p><a class="text-button" href="#ayuda">Consultar orientación</a></aside></div>`
  );
}
function readRequest(form) {
  const d = new FormData(form);
  return {
    applicant: Object.fromEntries(
      [
        "names",
        "lastName1",
        "lastName2",
        "dni",
        "mobile",
        "email",
        "address",
      ].map((k) => [k, d.get(k)]),
    ),
    subject: d.get("subject"),
    description: d.get("description"),
    type: d.get("type"),
    number: d.get("number"),
    area: d.get("area"),
    folios: d.get("folios"),
    consent: d.get("consent") === "on",
  };
}
function setupRequest() {
  let step = 0;
  const form = document.getElementById("request-form");
  const sections = [...form.querySelectorAll("[data-step]")];
  const out = form.querySelector("output");
  const move = (next) => {
    step = next;
    sections.forEach((s, i) => (s.hidden = i !== step));
    form
      .querySelectorAll(".wizard-tabs li")
      .forEach((li, i) => li.classList.toggle("active", i === step));
    document.getElementById("back-step").hidden = step === 0;
    document.getElementById("next-step").hidden = step === 2;
    document.getElementById("submit-request").hidden = step !== 2;
    out.textContent = "";
    sections[step].querySelector("input,select")?.focus();
  };
  document.getElementById("back-step").onclick = () => move(step - 1);
  document.getElementById("next-step").onclick = () => {
    try {
      for (const input of sections[step].querySelectorAll(
        "input,select,textarea",
      ))
        if (!input.reportValidity()) return;
      const v = readRequest(form);
      if (step === 0) validateApplicant(v.applicant);
      else {
        const file = new FormData(form).get("file");
        validateRequest({ ...v, consent: true }, file);
        document.getElementById("review").innerHTML = [
          [
            "Solicitante",
            `${v.applicant.names} ${v.applicant.lastName1} ${v.applicant.lastName2}`,
          ],
          ["DNI", v.applicant.dni],
          ["Celular", v.applicant.mobile],
          ["Correo", v.applicant.email],
          ["Domicilio", v.applicant.address],
          ["Área de destino", v.area],
          ["Tipo / folios", `${v.type} · ${v.folios} folio(s)`],
          ["Archivo", file.name],
          ["Asunto", v.subject],
        ]
          .map(([k, val]) => `<div><dt>${k}</dt><dd>${esc(val)}</dd></div>`)
          .join("");
      }
      move(step + 1);
    } catch (e) {
      out.textContent = friendly(e);
    }
  };
  form.elements.file.onchange = () => {
    const f = form.elements.file.files[0];
    try {
      validateFile(f, true);
      document.getElementById("file-info").textContent =
        f.name + " · " + (f.size / 1024 / 1024).toFixed(2) + " MB";
    } catch (e) {
      document.getElementById("file-info").textContent = friendly(e);
    }
  };
  form.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && step < 2 && e.target.tagName === "INPUT") {
      e.preventDefault();
      document.getElementById("next-step").click();
    }
  });
  bind("request-form", async (d, f) => {
    f.dataset.key ||= randomKey();
    const r = await (
      await cloud()
    ).register(readRequest(f), d.get("file"), f.dataset.key);
    remember(trackingKey(r));
    location.hash = "seguimiento";
  });
}
function lookup() {
  return `<section class="lookup-intro narrow"><span class="icon-box">${icon("search")}</span><span class="eyebrow">Seguimiento de expedientes</span><h1>Consulta tu trámite</h1><p class="subtle">Ingresa la clave de tu cargo para ver el estado, las respuestas y los documentos disponibles.</p></section><form class="panel narrow" id="lookup-form"><div class="lookup-form"><label>Clave de seguimiento<input name="key" required spellcheck="false" autocomplete="off" placeholder="Copia la clave completa de tu cargo" value="${esc(lastKey)}"></label><button class="button" type="submit">Consultar</button></div><output role="alert"></output><p class="subtle section-gap">Tu clave es personal. Quien la conozca podrá consultar este trámite y descargar sus archivos.</p></form>`;
}
function responseList(r) {
  return (r.responses || []).length
    ? r.responses
        .slice()
        .reverse()
        .map(
          (x) =>
            `<article class="reply"><div class="reply-meta"><strong>${esc(x.area)}</strong><span>${date(x.time)}</span></div><p>${esc(x.text || "Se adjunta el documento de respuesta.")}</p>${x.filename ? `<button type="button" class="button outline small" data-download="${x.id}">${icon("download")} ${esc(x.filename)}</button>` : ""}<small class="section-gap">Respuesta de ${esc(x.authorName)}</small></article>`,
        )
        .join("")
    : `<div class="empty">${icon("inbox")}<p>Todavía no hay respuestas publicadas.<br>Consulta nuevamente con tu clave.</p></div>`;
}
function publicDetail(r) {
  return `<div class="print-only"><strong>IESTP MANUEL SCORZA TORRE</strong><p>Av. Universitaria N.° 258 · Acobamba, Huancavelica</p></div><div class="record-top"><div><span class="eyebrow">Cargo de recepción y seguimiento</span><h1>${code(r)}</h1><span class="subtle">Registrado el ${date(r.time)}</span></div>${badge(r.state)}</div><div class="record-layout"><section><div class="panel"><h2>${esc(r.subject)}</h2><dl class="record-meta">${[
    ["Solicitante", r.sender],
    ["Tipo de documento", r.type],
    ["Área responsable", r.area],
    ["Número interno", r.internalNumber],
  ]
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`)
    .join(
      "",
    )}</dl><div class="key-box"><strong>Tu clave de seguimiento</strong><code>${esc(trackingKey(r))}</code><p>Guárdala junto con tu cargo. No la compartas públicamente.</p><button id="copy-key" class="button white small" type="button">${icon("copy")} Copiar clave</button></div><div class="actions no-print"><button type="button" class="button" id="print-receipt">${icon("print")} Imprimir cargo / PDF</button>${r.filename ? `<button class="button outline" type="button" data-download="original">${icon("download")} Documento presentado</button>` : ""}</div><p class="subtle section-gap">La recepción del documento no implica conformidad ni aprobación de lo solicitado.</p></div><section class="panel section-gap"><div class="section-title" style="margin-top:0"><div><span class="eyebrow">Comunicación del área</span><h2>Respuestas y documentos</h2></div><span class="badge">${(r.responses || []).length} respuesta(s)</span></div>${responseList(r)}</section></section><aside class="panel"><h2>Estado del trámite</h2><ol class="timeline"><li><strong>Documento recibido</strong><small>${date(r.time)}</small></li><li><strong>${esc(r.state)}</strong><small>${esc(r.area)}</small><small>Actualizado: ${date(r.updatedAt || r.time)}</small></li></ol><div class="notice">Las respuestas se publican en esta consulta. Conserva la clave y revisa el avance de tu solicitud.</div><a href="#consulta">Consultar otro expediente</a></aside></div>`;
}
function bindDownloads(r) {
  main.querySelectorAll("[data-download]").forEach(
    (button) =>
      (button.onclick = async () => {
        button.disabled = true;
        try {
          const response =
            button.dataset.download === "original"
              ? null
              : r.responses.find((x) => x.id === button.dataset.download);
          const blob = await (await cloud()).download(r, response);
          save(blob, response?.filename || r.filename || "documento");
        } catch (e) {
          toast(friendly(e));
        } finally {
          button.disabled = false;
        }
      }),
  );
}
function save(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function desk(content, active = "bandeja") {
  return `<div class="desk-grid"><aside class="sidebar"><span class="role">${identity.role === "admin" ? "Administración" : "Atención por área"}</span><h2>${esc(identity.name)}</h2><p>${esc(identity.role === "admin" ? "Gestión documental institucional" : identity.area)}</p><nav aria-label="Herramientas del personal"><a href="#bandeja" class="${active === "bandeja" ? "active" : ""}">${icon("inbox")}Expedientes</a>${identity.role === "admin" ? `<a href="#personal" class="${active === "personal" ? "active" : ""}">${icon("users")}Cuentas por área</a><a href="#herramientas" class="${active === "herramientas" ? "active" : ""}">${icon("shield")}Administración</a>` : ""}<a href="#cuenta" class="${active === "cuenta" ? "active" : ""}">${icon("lock")}Mi cuenta</a></nav><hr><button type="button" id="logout" class="button white small">${icon("logout")} Cerrar sesión</button></aside><div class="desk-content">${content}</div></div>`;
}
function bindDesk() {
  document.getElementById("logout")?.addEventListener("click", async () => {
    try {
      await (await cloud()).logout();
      identity = { role: "public" };
      header();
      location.hash = "inicio";
    } catch (e) {
      toast(friendly(e));
    }
  });
}
function inbox(records) {
  const count = (s) => records.filter((r) => r.state === s).length;
  return desk(
    heading(
      "Bandeja de expedientes",
      identity.role === "admin"
        ? "Supervisa los trámites, asigna áreas y publica respuestas."
        : "Documentos asignados a tu área de atención.",
    ) +
      `<div class="metrics"><div class="metric"><span>Expedientes</span><strong>${records.length}</strong></div><div class="metric active"><span>Recibidos</span><strong>${count("Recibido")}</strong></div><div class="metric"><span>En trámite</span><strong>${count("En trámite")}</strong></div><div class="metric complete"><span>Atendidos</span><strong>${count("Atendido")}</strong></div></div><section class="panel"><div class="filters"><label class="search">Buscar expediente<input id="search" type="search" placeholder="Número, asunto, nombre o DNI"></label><label>Estado<select id="filter-state"><option value="">Todos los estados</option>${options(STATES)}</select></label>${identity.role === "admin" ? `<label>Área<select id="filter-area"><option value="">Todas las áreas</option>${options(AREAS)}</select></label>` : ""}<button class="button outline small" id="export">${icon("download")} Exportar</button></div><div id="records-table"></div></section>`,
  );
}
function setupInbox() {
  const search = document.getElementById("search"),
    state = document.getElementById("filter-state"),
    area = document.getElementById("filter-area");
  const filtered = () =>
    cachedRecords.filter(
      (r) =>
        (!state.value || r.state === state.value) &&
        (!area?.value || r.area === area.value) &&
        [r.id, code(r), r.sender, r.subject, r.applicant?.dni]
          .join(" ")
          .toLocaleLowerCase("es")
          .includes(search.value.trim().toLocaleLowerCase("es")),
    );
  const draw = () => {
    const rows = filtered(),
      pages = Math.max(1, Math.ceil(rows.length / 12));
    pageNumber = Math.min(pageNumber, pages);
    const slice = rows.slice((pageNumber - 1) * 12, pageNumber * 12);
    document.getElementById("records-table").innerHTML = rows.length
      ? `<div class="table-scroll"><table><thead><tr><th>Expediente</th><th>Solicitante / asunto</th><th>Área</th><th>Estado</th><th><span class="subtle">Detalle</span></th></tr></thead><tbody>${slice.map((r) => `<tr><td><strong>${code(r)}</strong><small>${date(r.time)}</small></td><td class="subject"><strong>${esc(r.sender)}</strong><small>${esc(r.subject)}</small></td><td><small>${esc(r.area)}</small></td><td>${badge(r.state)}</td><td><a class="button outline small" href="#exp/${r._key}">Abrir</a></td></tr>`).join("")}</tbody></table></div><div class="pager"><span>${rows.length} expediente(s) · Página ${pageNumber} de ${pages}</span><div><button class="button outline small" id="prev-page" ${pageNumber === 1 ? "disabled" : ""}>Anterior</button><button class="button outline small" id="next-page" ${pageNumber === pages ? "disabled" : ""}>Siguiente</button></div></div>`
      : `<div class="empty">${icon("inbox")}<p>No se encontraron expedientes para estos filtros.</p></div>`;
    document.getElementById("prev-page")?.addEventListener("click", () => {
      pageNumber--;
      draw();
    });
    document.getElementById("next-page")?.addEventListener("click", () => {
      pageNumber++;
      draw();
    });
  };
  for (const e of [search, state, area].filter(Boolean))
    e.addEventListener(e === search ? "input" : "change", () => {
      pageNumber = 1;
      draw();
    });
  document.getElementById("export").onclick = () =>
    save(
      new Blob([csv(filtered())], { type: "text/csv;charset=utf-8" }),
      "expedientes.csv",
    );
  draw();
}
function staffDetail(r) {
  const a = r.applicant;
  return desk(
    `<div class="breadcrumb"><a href="#bandeja">Bandeja</a> / ${code(r)}</div><div class="record-top"><div><h1>${code(r)}</h1><span class="subtle">${date(r.time)}</span></div>${badge(r.state)}</div><section class="panel"><h2>${esc(r.subject)}</h2><p class="subtle">${esc(r.type)} · ${r.folios} folio(s) · ${esc(r.area)}</p>${r.description ? `<p style="white-space:pre-wrap">${esc(r.description)}</p>` : ""}<dl class="record-meta"><div><dt>Solicitante</dt><dd>${esc(r.sender)}</dd></div><div><dt>DNI</dt><dd>${esc(a?.dni || "Sin dato en el expediente anterior")}</dd></div><div><dt>Celular</dt><dd>${a ? `<a href="tel:+51${esc(a.mobile)}">${esc(a.mobile)}</a>` : "Sin dato"}</dd></div><div><dt>Correo electrónico</dt><dd>${a ? `<a href="mailto:${esc(a.email)}">${esc(a.email)}</a>` : "Sin dato"}</dd></div><div class="full"><dt>Domicilio</dt><dd>${esc(a?.address || "Sin dato")}</dd></div></dl>${r.filename ? `<button class="button outline" type="button" data-download="original">${icon("download")} ${esc(r.filename)}</button>` : ""}</section><section class="panel section-gap"><div class="tabs" role="tablist"><button class="selected" data-tab="reply" role="tab" aria-selected="true">Responder</button><button data-tab="move" role="tab" aria-selected="false">${identity.role === "admin" ? "Derivar / estado" : "Estado / nota"}</button><button data-tab="history" role="tab" aria-selected="false">Historial</button></div><div data-tabpanel="reply"><h2>Publicar respuesta al solicitante</h2><p class="hint">El mensaje y el documento serán visibles en su consulta de seguimiento.</p><form id="reply-form"><label>Respuesta<textarea name="text" maxlength="6000" rows="5" placeholder="Escribe la respuesta del área responsable"></textarea></label><label class="file-box section-gap">Documento de respuesta <small>Opcional</small><input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png"><small>PDF, JPG o PNG · hasta 10 MB.</small></label><label class="section-gap">Estado después de responder<select name="state">${options(["En trámite", "Observado", "Atendido"], "Atendido")}</select></label><div class="actions"><button class="button" type="submit">${icon("send")} Publicar respuesta</button></div><output role="alert"></output></form></div><div data-tabpanel="move" hidden><h2>${identity.role === "admin" ? "Derivación y seguimiento" : "Actualizar el estado"}</h2><form id="move-form"><div class="fields"><label>Estado<select name="state">${options(STATES, r.state)}</select></label><label>Área de destino<select name="area" ${identity.role !== "admin" ? "disabled" : ""}>${options(AREAS, r.area)}</select></label><label class="full">Nota interna <small>No se publica al solicitante</small><textarea name="note" maxlength="1000"></textarea></label></div><div class="actions"><button type="submit" class="button">Guardar actualización</button></div><output role="alert"></output></form></div><div data-tabpanel="history" hidden><h2>Movimientos del expediente</h2><ol class="timeline">${r.log
      .slice()
      .reverse()
      .map(
        (x) =>
          `<li><strong>${esc(x.state)} · ${esc(x.area)}</strong><small>${date(x.time)}</small></li>`,
      )
      .join("")}</ol><h3 class="section-gap">Notas internas</h3>${
      Object.values(r.notes || {}).length
        ? Object.entries(r.notes)
            .reverse()
            .map(
              ([t, x]) =>
                `<div class="notice"><p>${esc(typeof x === "string" ? x : x.text)}</p>${typeof x === "object" ? `<small>${esc(x.authorName)} · ${date(Number(t))}</small>` : ""}</div>`,
            )
            .join("")
        : '<p class="subtle">Sin notas internas.</p>'
    }</div></section><section class="panel section-gap"><h2>Respuestas publicadas</h2>${responseList(r)}</section>`,
  );
}
function setupDetail(r) {
  bindDesk();
  bindDownloads(r);
  main.querySelectorAll("[data-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        main.querySelectorAll("[data-tab]").forEach((x) => {
          x.classList.toggle("selected", x === b);
          x.setAttribute("aria-selected", String(x === b));
        });
        main
          .querySelectorAll("[data-tabpanel]")
          .forEach((x) => (x.hidden = x.dataset.tabpanel !== b.dataset.tab));
      }),
  );
  bind("reply-form", async (d, f) => {
    f.dataset.response ||= randomKey();
    await (
      await cloud()
    ).act(r._key, {
      state: d.get("state"),
      area: r.area,
      text: d.get("text"),
      file: d.get("file"),
      responseId: f.dataset.response,
      revision: r.log.length,
      respond: true,
    });
    toast("Respuesta publicada. El solicitante puede verla con su clave.");
    await render();
  });
  bind("move-form", async (d) => {
    await (
      await cloud()
    ).act(r._key, {
      state: d.get("state"),
      area: d.get("area") || r.area,
      note: d.get("note"),
      revision: r.log.length,
    });
    toast("Expediente actualizado.");
    await render();
  });
}
function login() {
  return `<div class="login-grid"><aside class="login-visual"><span class="eyebrow" style="color:#adc8f4">Personal autorizado</span><h2>Un espacio para atender mejor.</h2><p>Gestiona los documentos asignados a tu área y comunica las respuestas a los solicitantes.</p><img src="sede.webp" alt="Instituto Manuel Scorza Torre"></aside><section class="panel"><span class="icon-box">${icon("lock")}</span><h1 style="font-size:1.8rem;margin-top:22px">Acceso institucional</h1><p class="subtle">Ingresa con la cuenta asignada por administración.</p><form id="login-form"><label>Correo o usuario<input name="user" required autocomplete="username" placeholder="Correo del personal o usuario administrador"></label><label>Contraseña<input name="password" type="password" required autocomplete="current-password"></label><button type="submit" class="button">Ingresar</button><output role="alert"></output><button class="text-button" id="reset-password" type="button">Recuperar contraseña</button></form><p class="subtle section-gap">Para presentar documentos no necesitas una cuenta. <a href="#registro">Ir al formulario público</a>.</p></section></div>`;
}
function staffPage(list) {
  return desk(
    heading(
      "Cuentas por área",
      "Crea accesos individuales y asigna a cada persona su área de atención.",
    ) +
      `<section class="panel"><h2>Crear o vincular una cuenta</h2><form id="staff-form"><div class="fields">${field("Nombre del personal", "name", 'minlength="3" maxlength="120"')}${field("Correo de acceso", "email", 'type="email" maxlength="180"')}<label class="full">Área asignada <span class="required">*</span><select name="area">${options(AREAS)}</select></label><label class="full">Contraseña inicial<input name="password" type="password" minlength="12" autocomplete="new-password" placeholder="Al menos 12 caracteres"><small>Compártela directamente con la persona. Podrá cambiarla desde Mi cuenta.</small></label></div><details class="section-gap"><summary>Vincular una cuenta que ya existe en Firebase</summary><label class="section-gap">UID de Firebase Authentication<input name="uid" maxlength="128" autocomplete="off"><small>Solo si la cuenta ya existe. En este caso deja vacía la contraseña.</small></label></details><div class="actions"><button type="submit" class="button">Crear / vincular cuenta</button></div><output role="alert"></output></form></section><section class="panel section-gap"><h2>Personal autorizado <span class="badge">${list.length}</span></h2>${list.length ? list.map((u) => `<div class="staff-row ${u.active ? "" : "inactive"}" data-user="${esc(u.uid)}"><span class="avatar">${esc(u.name.slice(0, 1).toUpperCase())}</span><div class="staff-info"><strong>${esc(u.name)}</strong><small>${esc(u.email)}</small><small>${u.active ? "Acceso activo" : "Acceso desactivado"}</small></div><select aria-label="Área de ${esc(u.name)}" data-area>${options(AREAS, u.area)}</select><button class="button outline small" type="button" data-save-user>Guardar área</button><button class="button ${u.active ? "danger" : "soft"} small" data-active="${!u.active}" type="button">${u.active ? "Desactivar" : "Activar"}</button></div>`).join("") : '<div class="empty">Todavía no hay cuentas por área.</div>'}</section>`,
    "personal",
  );
}
function setupStaff(list) {
  bindDesk();
  bind("staff-form", async (d, f) => {
    const result = await (
      await cloud()
    ).createStaff({
      name: d.get("name"),
      email: d.get("email"),
      area: d.get("area"),
      password: d.get("password"),
      uid: d.get("uid").trim(),
    });
    f.reset();
    toast("Cuenta asignada correctamente: " + result.email);
    await render();
  });
  main.querySelectorAll("[data-user]").forEach((row) => {
    const user = list.find((x) => x.uid === row.dataset.user);
    const update = async (active, button) => {
      button.disabled = true;
      try {
        await (
          await cloud()
        ).updateStaff(user.uid, {
          area: row.querySelector("[data-area]").value,
          active,
        });
        toast("Permisos actualizados.");
        await render();
      } catch (e) {
        toast(friendly(e));
        button.disabled = false;
      }
    };
    row.querySelector("[data-save-user]").onclick = (e) =>
      update(user.active, e.currentTarget);
    row.querySelector("[data-active]").onclick = (e) =>
      update(e.currentTarget.dataset.active === "true", e.currentTarget);
  });
}
function toolsPage() {
  return desk(
    heading(
      "Administración",
      "Herramientas para comprobar los servicios y conservar el seguimiento de expedientes anteriores.",
    ) +
      `<section class="panel"><h2>Comprobar conexiones</h2><p class="subtle">Verifica que respondan la base de datos y el depósito privado de archivos.</p><button class="button outline" id="diagnostics">Comprobar servicios</button><output id="diagnostic-output" role="status"></output></section><section class="panel section-gap"><h2>Habilitar seguimiento anterior</h2><p>Publica las vistas de seguimiento de los expedientes que ya existían antes de esta actualización. Conserva sus números y claves y excluye los datos de contacto y las notas internas.</p><p class="subtle">No modifica los documentos originales. Los adjuntos de servicios anteriores requieren su propia migración.</p><button class="button" id="migrate">Preparar seguimiento de expedientes</button><output id="migration-output" role="status"></output></section>`,
    "herramientas",
  );
}
function help() {
  return (
    heading(
      "Orientación para tu trámite",
      "Información para presentar tu solicitud y consultar la respuesta del instituto.",
    ) +
    `<div class="form-layout"><section class="faq">${[
      [
        "¿Qué datos necesito?",
        "Nombres y apellidos, DNI de 8 dígitos, celular de 9 dígitos, correo electrónico y domicilio. También el área de destino, el asunto y el documento principal.",
      ],
      [
        "¿Qué archivos puedo presentar?",
        "Un documento principal en PDF, JPG o PNG de hasta 10 MB. Para un documento de varias páginas, reúne todas las páginas en un solo PDF legible.",
      ],
      [
        "¿Dónde encuentro la respuesta?",
        "En Consultar trámite, ingresa la clave de tu cargo. Allí aparecerán el estado actualizado, las respuestas del área y los archivos para descargar.",
      ],
      [
        "¿Se envía una notificación por correo?",
        "Esta versión publica las respuestas en la consulta del trámite. El correo y celular registrados permiten al personal contactarte; no se envían avisos automáticos.",
      ],
      [
        "¿Necesito registrarme?",
        "No. Los solicitantes presentan documentos sin crear una cuenta. Las cuentas institucionales son para el personal autorizado.",
      ],
      [
        "¿Qué sucede si pierdo mi clave?",
        "Comunícate con el instituto y solicita orientación, indicando el número de expediente. La clave no se recupera mediante una búsqueda pública por DNI.",
      ],
      [
        "¿Registrar un documento significa que fue aprobado?",
        "No. El cargo confirma la recepción. El área responsable evaluará la solicitud y publicará la respuesta correspondiente.",
      ],
    ]
      .map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`)
      .join(
        "",
      )}</section><aside class="form-sidebar"><h2>Contacto institucional</h2><p>Av. Universitaria N.° 258<br>Barrio Cocharcas, Acobamba</p><p><a href="tel:+51964159700">964 159 700</a></p><p class="subtle">Horario publicado: 8:00 a. m. – 4:00 p. m.</p><a href="https://iestmst.edu.pe/contacts/" target="_blank" rel="noopener noreferrer">Consultar contactos oficiales</a></aside></div>`
  );
}
function privacy() {
  return (
    heading(
      "Privacidad de los datos",
      "Información sobre el uso de los datos en la mesa de partes.",
    ) +
    `<article class="panel privacy"><h2>Datos para atender tu solicitud</h2><p>El sistema solicita nombres, apellidos, DNI, celular, correo, domicilio y documentos para registrar, derivar y responder tu trámite. El personal autorizado de tu área de atención y la administración pueden acceder a esos datos.</p><h2>Consulta con una clave personal</h2><p>La consulta pública muestra el número, el nombre del solicitante, el asunto, el estado, el área responsable y las respuestas. No muestra el DNI, el celular, el correo, el domicilio ni las notas internas. Quien tenga la clave podrá consultar esta información y descargar los documentos.</p><h2>Conservación y contacto</h2><p>Conserva tu cargo y protege tu clave. Para solicitar información sobre tus datos o una corrección, comunícate con el instituto al <a href="tel:+51964159700">964 159 700</a> o acércate a Av. Universitaria N.° 258, Acobamba. La gestión y conservación de los expedientes corresponde a la institución.</p><a class="button outline" href="#registro">Volver a presentar documento</a></article>`
  );
}
async function render() {
  const current = ++routeId;
  const [route = "inicio", key] = location.hash.replace(/^#/, "").split("/");
  header();
  try {
    if (!route || route === "inicio") {
      main.innerHTML = home();
      return;
    }
    if (route === "registro") {
      main.innerHTML = requestForm();
      setupRequest();
      return;
    }
    if (route === "consulta") {
      main.innerHTML = lookup();
      bind("lookup-form", async (d) => {
        parseKey(d.get("key"));
        const r = await (await cloud()).lookup(d.get("key"));
        remember(trackingKey(r));
        location.hash = "seguimiento";
      });
      return;
    }
    if (route === "ayuda") {
      main.innerHTML = help();
      return;
    }
    if (route === "privacidad") {
      main.innerHTML = privacy();
      return;
    }
    if (route === "acceso" || route === "admin") {
      main.innerHTML = login();
      bind("login-form", async (d) => {
        identity = await (
          await cloud()
        ).login(d.get("user"), d.get("password"));
        header();
        location.hash = "bandeja";
      });
      document.getElementById("reset-password").onclick = async () => {
        const f = document.getElementById("login-form"),
          user = f.elements.user.value;
        if (!user.trim()) {
          f.querySelector("output").textContent =
            "Escribe tu correo de acceso o usuario antes de recuperar la contraseña.";
          return;
        }
        try {
          await (await cloud()).reset(user);
          toast("Si la cuenta existe, recibirás instrucciones en su correo.");
        } catch (e) {
          f.querySelector("output").textContent = friendly(e);
        }
      };
      return;
    }
    main.innerHTML =
      '<div class="loading" role="status">Consultando información…</div>';
    const api = await cloud();
    if (route === "seguimiento") {
      if (!lastKey) {
        location.hash = "consulta";
        return;
      }
      const r = await api.lookup(lastKey);
      if (current !== routeId) return;
      main.innerHTML = publicDetail(r);
      bindDownloads(r);
      document.getElementById("print-receipt").onclick = () => window.print();
      document.getElementById("copy-key").onclick = async () => {
        try {
          await navigator.clipboard.writeText(trackingKey(r));
          toast("Clave copiada.");
        } catch {
          toast("Selecciona la clave del recuadro y cópiala.");
        }
      };
      return;
    }
    identity = await api.session();
    header();
    if (!["admin", "area"].includes(identity.role)) {
      location.hash = "acceso";
      return;
    }
    if (current !== routeId) return;
    if (route === "bandeja") {
      const records = await api.records();
      if (current !== routeId) return;
      cachedRecords = records;
      main.innerHTML = inbox(records);
      bindDesk();
      setupInbox();
      return;
    }
    if (route === "exp") {
      const r = await api.record(key);
      if (current !== routeId) return;
      main.innerHTML = staffDetail(r);
      setupDetail(r);
      return;
    }
    if (route === "personal" && identity.role === "admin") {
      const users = await api.staff();
      if (current !== routeId) return;
      main.innerHTML = staffPage(users);
      setupStaff(users);
      return;
    }
    if (route === "herramientas" && identity.role === "admin") {
      main.innerHTML = toolsPage();
      bindDesk();
      for (const [id, out, fn] of [
        ["diagnostics", "diagnostic-output", () => api.diagnostics()],
        [
          "migrate",
          "migration-output",
          async () =>
            `${await api.migrate()} expediente(s) con seguimiento preparado.`,
        ],
      ])
        document.getElementById(id).onclick = async (e) => {
          e.currentTarget.disabled = true;
          const output = document.getElementById(out);
          output.textContent = "Procesando…";
          try {
            output.textContent = await fn();
          } catch (err) {
            output.textContent = friendly(err);
          } finally {
            document.getElementById(id).disabled = false;
          }
        };
      return;
    }
    if (route === "cuenta") {
      main.innerHTML = desk(
        heading(
          "Mi cuenta",
          "Actualiza tu contraseña de acceso institucional.",
        ) +
          `<section class="panel"><p><strong>${esc(identity.name)}</strong><br>${esc(identity.email)}</p><form id="password-form"><div class="fields">${field("Contraseña actual", "current", 'type="password" autocomplete="current-password"', true)}${field("Nueva contraseña", "next", 'type="password" autocomplete="new-password" minlength="12"', true)}${field("Confirmar nueva contraseña", "confirm", 'type="password" autocomplete="new-password" minlength="12"', true)}</div><p class="subtle section-gap">Usa al menos 12 caracteres y una contraseña que no compartas con otros servicios.</p><button class="button" type="submit">Actualizar contraseña</button><output role="alert"></output></form></section>`,
        "cuenta",
      );
      bindDesk();
      bind("password-form", async (d, f) => {
        if (d.get("next") !== d.get("confirm"))
          throw Error("Las contraseñas nuevas no coinciden.");
        await api.password(d.get("current"), d.get("next"));
        f.reset();
        toast("Contraseña actualizada.");
      });
      return;
    }
    location.hash = "inicio";
  } catch (error) {
    if (current !== routeId) return;
    main.innerHTML = `<section class="panel narrow"><span class="icon-box">${icon("help")}</span><h1 style="font-size:1.6rem;margin-top:20px">No se pudo completar la consulta</h1><p>${esc(friendly(error))}</p><div class="actions"><button id="retry" class="button">Volver a intentar</button><a href="#inicio" class="button outline">Ir al inicio</a></div></section>`;
    document.getElementById("retry").onclick = render;
  }
}
window.addEventListener("hashchange", () => {
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
});
render();
cloud()
  .then((api) => api.session())
  .then((me) => {
    identity = me;
    header();
  })
  .catch(() => {});
