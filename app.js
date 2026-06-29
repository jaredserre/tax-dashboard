let allBills = [];

function fmtDate(value) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

function isNew(dateValue) {
  if (!dateValue) return false;
  const then = new Date(dateValue);
  const now = new Date();
  const days = (now - then) / (1000 * 60 * 60 * 24);
  return days <= 7;
}

function chamberBadge(chamber) {
  const text = chamber || "Congress";
  const color = text.toLowerCase().includes("house")
    ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
    : "bg-purple-500/15 text-purple-300 border-purple-500/30";

  return `<span class="inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${color}">${text}</span>`;
}

function setCard(id, item) {
  const el = document.querySelector(id);
  el.href = item.url;
  el.querySelector("h2").textContent = item.status;
  el.querySelector("p:last-child").textContent = item.source;
}

function renderBills(bills) {
  const root = document.querySelector("#bills");

  if (!bills.length) {
    root.innerHTML = `<div class="p-6 text-slate-400">No matching bills found.</div>`;
    return;
  }

  root.innerHTML = bills.map(b => `
    <article class="p-5 hover:bg-slate-800/60 transition">
      <div class="flex flex-wrap gap-2 mb-3">
        ${chamberBadge(b.chamber)}
        ${isNew(b.latestActionDate) ? `<span class="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-300">New in last 7 days</span>` : ""}
        <span class="inline-flex rounded-full border border-slate-700 px-2.5 py-1 text-xs font-bold text-slate-300">${b.type} ${b.number}</span>
      </div>

      <a href="${b.url}" target="_blank" rel="noopener" class="text-xl font-black text-blue-300 hover:text-blue-200">
        ${b.title}
      </a>

      <p class="text-slate-400 text-sm mt-2">
        Latest action: ${fmtDate(b.latestActionDate)}
      </p>

      <p class="text-slate-300 mt-2 leading-relaxed">
        ${b.latestActionText || "No latest action text available."}
      </p>

      <a href="${b.url}" target="_blank" rel="noopener" class="inline-block mt-3 text-sm font-bold text-blue-400 hover:text-blue-300">
        Open on Congress.gov →
      </a>
    </article>
  `).join("");
}

async function init() {
  const res = await fetch("data/dashboard.json");
  const data = await res.json();

  document.querySelector("#updated").textContent =
    `Updated ${fmtDate(data.updatedAt)} · Data refreshed by GitHub Actions`;

  setCard("#house-card", data.chamberStatus.house);
  setCard("#senate-card", data.chamberStatus.senate);

  allBills = data.taxBills || [];
  renderBills(allBills);
}

document.querySelector("#search").addEventListener("input", e => {
  const q = e.target.value.toLowerCase();

  renderBills(allBills.filter(b =>
    `${b.type} ${b.number} ${b.title} ${b.chamber} ${b.latestActionText}`
      .toLowerCase()
      .includes(q)
  ));
});

init();
