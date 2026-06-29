let allBills = [];

function fmtDate(value) {
  if (!value) return "No date listed";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

function setCard(id, item) {
  const el = document.querySelector(id);
  el.href = item.url;
  el.querySelector("h2").textContent = item.status;
  el.querySelector("p:last-child").textContent = item.source;
}

function pill(text, color = "slate") {
  const colors = {
    blue: "border-blue-500/30 bg-blue-500/15 text-blue-300",
    purple: "border-purple-500/30 bg-purple-500/15 text-purple-300",
    green: "border-green-500/30 bg-green-500/15 text-green-300",
    amber: "border-amber-500/30 bg-amber-500/15 text-amber-300",
    red: "border-red-500/30 bg-red-500/15 text-red-300",
    slate: "border-slate-700 bg-slate-800 text-slate-300"
  };

  return `<span class="inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${colors[color]}">${text}</span>`;
}

function renderToday(today) {
  const root = document.querySelector("#today");
  root.innerHTML = `
    <div class="rounded-xl bg-slate-950/60 border border-slate-800 p-4">
      <p class="text-slate-400 text-sm">Tax bills updated today</p>
      <p class="text-3xl font-black">${today.taxBillsUpdatedToday}</p>
    </div>
    <div class="rounded-xl bg-slate-950/60 border border-slate-800 p-4">
      <p class="text-slate-400 text-sm">Federal Register today</p>
      <p class="text-3xl font-black">${today.federalRegisterToday}</p>
    </div>
    <div class="rounded-xl bg-slate-950/60 border border-slate-800 p-4">
      <p class="text-slate-400 text-sm">IRS items loaded</p>
      <p class="text-3xl font-black">${today.irsItems}</p>
    </div>
    <div class="rounded-xl bg-slate-950/60 border border-slate-800 p-4">
      <p class="text-slate-400 text-sm">Treasury items loaded</p>
      <p class="text-3xl font-black">${today.treasuryItems}</p>
    </div>
  `;
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
        ${pill(b.chamber || "Congress", b.chamber?.toLowerCase().includes("house") ? "blue" : "purple")}
        ${pill(`${b.type} ${b.number}`)}
      </div>

      <a href="${b.url}" target="_blank" rel="noopener" class="text-xl font-black text-blue-300 hover:text-blue-200">
        ${b.title}
      </a>

      <p class="text-slate-400 text-sm mt-2">Latest action: ${fmtDate(b.latestActionDate)}</p>
      <p class="text-slate-300 mt-2 leading-relaxed">${b.latestActionText || "No latest action text available."}</p>

      <a href="${b.url}" target="_blank" rel="noopener" class="inline-block mt-3 text-sm font-bold text-blue-400 hover:text-blue-300">
        Open on Congress.gov →
      </a>
    </article>
  `).join("");
}

function renderSimpleList(id, items, emptyText, label, color) {
  const root = document.querySelector(id);

  if (!items || !items.length) {
    root.innerHTML = `<div class="p-6 text-slate-400">${emptyText}</div>`;
    return;
  }

  root.innerHTML = items.map(item => `
    <article class="p-5 hover:bg-slate-800/60 transition">
      <div class="flex flex-wrap gap-2 mb-3">
        ${pill(item.type || item.source || label, color)}
        ${item.date ? pill(fmtDate(item.date)) : ""}
        ${item.committee ? pill(item.committee, "red") : ""}
        ${item.matchedTerm ? pill(item.matchedTerm, "amber") : ""}
      </div>

      <a href="${item.url}" target="_blank" rel="noopener" class="block text-lg font-black text-blue-300 hover:text-blue-200">
        ${item.title}
      </a>

      ${item.agency ? `<p class="text-slate-400 text-sm mt-2">${item.agency}</p>` : ""}

      <a href="${item.url}" target="_blank" rel="noopener" class="inline-block mt-3 text-sm font-bold text-blue-400 hover:text-blue-300">
        Open source →
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

  renderToday(data.today || {});

  allBills = data.taxBills || [];
  renderBills(allBills);

  renderSimpleList("#watchlist", data.watchlist, "No watchlist matches found.", "Watchlist", "amber");
  renderSimpleList("#federal-register", data.federalRegister, "No Federal Register tax items found.", "Federal Register", "amber");
  renderSimpleList("#irs-news", data.irsNews, "No IRS news releases found.", "IRS", "green");
  renderSimpleList("#treasury-news", data.treasuryNews, "No Treasury releases found.", "Treasury", "blue");
  renderSimpleList("#hearings", data.hearings, "No committee hearing links found.", "Hearing", "red");
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
