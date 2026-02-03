let catalogo = [];
let vendedores = [];
let deferredPrompt = null;

const $ = (id) => document.getElementById(id);
const grid = $("grid");
const q = $("q");
const fibra = $("fibra");
const color = $("color");

const modal = $("modal");
const modalContent = $("modalContent");
const closeModal = $("closeModal");
const btnInstall = $("btnInstall");

// ===============================
// Reparto justo de pedidos (local)
// ===============================
const LS_KEY = "carlup_vendor_counts_v1";

function loadCounts() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
  } catch {
    return {};
  }
}
function saveCounts(counts) {
  localStorage.setItem(LS_KEY, JSON.stringify(counts));
}
function ensureCountsForVendors(vs, counts) {
  vs.forEach(v => { if (counts[v.id] == null) counts[v.id] = 0; });

  // Limpia IDs que ya no existan
  Object.keys(counts).forEach(id => {
    if (!vs.some(v => v.id === id)) delete counts[id];
  });

  return counts;
}
function pickBalancedRandomVendor(vs) {
  const counts = ensureCountsForVendors(vs, loadCounts());
  const min = Math.min(...vs.map(v => counts[v.id] || 0));
  const pool = vs.filter(v => (counts[v.id] || 0) === min);
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  return { chosen, counts };
}
function incrementVendor(vendorId) {
  const counts = loadCounts();
  counts[vendorId] = (counts[vendorId] || 0) + 1;
  saveCounts(counts);
}

// ===============================
// PWA install prompt
// ===============================
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (btnInstall) btnInstall.hidden = false;
});

if (btnInstall) {
  btnInstall.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    btnInstall.hidden = true;
  });
}

// Service worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("js/sw.js");
}

function normalize(s) {
  return (s || "").toString().trim().toLowerCase();
}

function buildColorOptions(items) {
  const set = new Set();
  items.forEach(it => (it.colores || []).forEach(c => set.add(c)));
  const sorted = Array.from(set).sort((a, b) => a.localeCompare(b, "es"));

  if (!color) return;
  color.innerHTML =
    `<option value="">Color (todos)</option>` +
    sorted.map(c => `<option value="${c}">${c}</option>`).join("");
}

function filterItems() {
  const term = normalize(q?.value);
  const f = fibra?.value || "";
  const c = color?.value || "";

  return catalogo.filter(it => {
    const modOk = !term || normalize(it.mod).includes(term);
    const fibraOk = !f || it.fibra === f;
    const colorOk = !c || (it.colores || []).includes(c);
    return modOk && fibraOk && colorOk;
  });
}

function cardTemplate(it) {
  const img = (it.fotos && it.fotos[0]) ? it.fotos[0] : "";
  const chips = (it.colores || [])
    .slice(0, 3)
    .map(x => `<span class="badge">${x}</span>`)
    .join("");

  return `
    <article class="card" data-mod="${it.mod}">
      <img src="${img}" alt="MOD ${it.mod}" onerror="this.style.display='none'">
      <div class="meta">
        <div class="mod">MOD ${it.mod}</div>
        <div class="badges">
          <span class="badge">${it.fibra || "—"}</span>
          ${chips}
        </div>
      </div>
    </article>
  `;
}

function render() {
  if (!grid) return;
  const items = filterItems();
  grid.innerHTML =
    items.map(cardTemplate).join("") ||
    `<div style="opacity:.8">Sin resultados…</div>`;
}

function openDetail(it) {
  const photos = it.fotos || [];
  const mainPhoto = photos[0] || "";
  const chips = (it.colores || []).map(c => `<span class="chip">${c}</span>`).join("");

  // Si no hay vendedores cargados, cae al WhatsApp genérico
  let waLink = "";
  let vendorLabel = "";

  const msg = encodeURIComponent(
    `Hola, me interesa el modelo MOD ${it.mod}.\n` +
    `Fibra: ${it.fibra}\n` +
    `Color(es): ${(it.colores || []).join(", ")}\n\n` +
    `(Enviado desde Catálogo Carlup)`
  );

  let assignedVendor = null;

  if (Array.isArray(vendedores) && vendedores.length > 0) {
    const { chosen } = pickBalancedRandomVendor(vendedores);
    assignedVendor = chosen;
    vendorLabel = `<div class="kv">Vendedor asignado: <b>${chosen.nombre}</b></div>`;
    waLink = `https://wa.me/${chosen.telefono}?text=${msg}`;
  } else {
    waLink = `https://wa.me/?text=${msg}`;
  }

  modalContent.innerHTML = `
    <div class="detail">
      <div class="photo">
        <img src="${mainPhoto}" alt="MOD ${it.mod}" onerror="this.style.display='none'">
      </div>
      <div class="info">
        <h2>MOD ${it.mod}</h2>
        <div class="kv">Fibra: <b>${it.fibra || "—"}</b></div>

        <div class="kv">Colores disponibles:</div>
        <div class="colors">${chips || `<span style="opacity:.8">—</span>`}</div>

        ${vendorLabel}

        <div class="actions">
          <a class="btn" id="btnWA" href="${waLink}" target="_blank" rel="noopener">
            Enviar por WhatsApp
          </a>
          ${photos.length > 1 ? `<button class="btn ghost" id="nextPhoto">Siguiente foto</button>` : ""}
        </div>
      </div>
    </div>
  `;

  // Contabiliza el reparto cuando se hace click (intento de pedido)
  const btnWA = modalContent.querySelector("#btnWA");
  if (btnWA && assignedVendor) {
    btnWA.addEventListener("click", () => {
      incrementVendor(assignedVendor.id);
    });
  }

  // mini carrusel
  if (photos.length > 1) {
    let idx = 0;
    const nextBtn = modalContent.querySelector("#nextPhoto");
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        idx = (idx + 1) % photos.length;
        const imgEl = modalContent.querySelector("img");
        if (imgEl) imgEl.src = photos[idx];
      });
    }
  }

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

// Click en tarjetas
if (grid) {
  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (!card) return;
    const mod = card.dataset.mod;
    const it = catalogo.find(x => x.mod === mod);
    if (it) openDetail(it);
  });
}

// Cerrar modal
if (closeModal) {
  closeModal.addEventListener("click", () => {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  });
}
if (modal) {
  modal.addEventListener("click", (e) => {
    if (e.target === modal && closeModal) closeModal.click();
  });
}

// Filtros
if (q) q.addEventListener("input", render);
if (fibra) fibra.addEventListener("change", render);
if (color) color.addEventListener("change", render);

// Carga inicial
async function init() {
  try {
    const [resCat, resVen] = await Promise.all([
      fetch("data/catalogo.json", { cache: "no-store" }),
      fetch("data/vendedores.json", { cache: "no-store" })
    ]);

    catalogo = await resCat.json();
    vendedores = await resVen.json();

    buildColorOptions(catalogo);
    render();
  } catch (err) {
    console.error("Error cargando datos:", err);
    if (grid) grid.innerHTML = `<div style="opacity:.8">Error cargando catálogo…</div>`;
  }
}
init();
