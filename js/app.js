let catalogo = [];
let vendedores=[];
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

// PWA install prompt
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  btnInstall.hidden = false;
});

btnInstall.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  btnInstall.hidden = true;
});

// Service worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("js/sw.js");
}

function normalize(s){ return (s||"").toString().trim().toLowerCase(); }

function buildColorOptions(items){
  const set = new Set();
  items.forEach(it => (it.colores||[]).forEach(c => set.add(c)));
  const sorted = Array.from(set).sort((a,b)=>a.localeCompare(b,"es"));
  color.innerHTML = `<option value="">Color (todos)</option>` + sorted.map(c=>`<option value="${c}">${c}</option>`).join("");
}

function filterItems(){
  const term = normalize(q.value);
  const f = fibra.value;
  const c = color.value;

  return catalogo.filter(it => {
    const modOk = !term || normalize(it.mod).includes(term);
    const fibraOk = !f || it.fibra === f;
    const colorOk = !c || (it.colores || []).includes(c);
    return modOk && fibraOk && colorOk;
  });
}

function cardTemplate(it){
  const img = (it.fotos && it.fotos[0]) ? it.fotos[0] : "";
  const chips = (it.colores||[]).slice(0,4).map(x=>`<span class="badge">${x}</span>`).join("");
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

function render(){
  const items = filterItems();
  grid.innerHTML = items.map(cardTemplate).join("") || `<div style="opacity:.8">Sin resultados…</div>`;
}

function openDetail(it){
  const photos = it.fotos || [];
  const mainPhoto = photos[0] || "";
  const chips = (it.colores||[]).map(c=>`<span class="chip">${c}</span>`).join("");

  // WhatsApp message (simple)
  const msg = encodeURIComponent(`Hola, me interesa el modelo MOD ${it.mod}.\nFibra: ${it.fibra}\nColor(es): ${(it.colores||[]).join(", ")}`);
  const waLink = `https://wa.me/?text=${msg}`;

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

        <div class="actions">
          <a class="btn" href="${waLink}" target="_blank" rel="noopener">Enviar por WhatsApp</a>
          ${photos.length > 1 ? `<button class="btn ghost" id="nextPhoto">Siguiente foto</button>` : ""}
        </div>
      </div>
    </div>
  `;

  // mini carrusel
  if (photos.length > 1) {
    let idx = 0;
    modalContent.querySelector("#nextPhoto").addEventListener("click", () => {
      idx = (idx + 1) % photos.length;
      const imgEl = modalContent.querySelector("img");
      imgEl.src = photos[idx];
    });
  }

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden","false");
}

grid.addEventListener("click", (e) => {
  const card = e.target.closest(".card");
  if (!card) return;
  const mod = card.dataset.mod;
  const it = catalogo.find(x => x.mod === mod);
  if (it) openDetail(it);
});

closeModal.addEventListener("click", () => {
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden","true");
});
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal.click();
});

[q, fibra, color].forEach(el => el.addEventListener("input", render));
[fibra, color].forEach(el => el.addEventListener("change", render));

async function init(){
  const res = await fetch("data/catalogo.json", { cache: "no-store" });
  catalogo = await res.json();
  buildColorOptions(catalogo);
  render();
}
init();
