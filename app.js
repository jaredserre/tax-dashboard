let allBills = [];

function fmtDate(value) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

function setCard(id, item) {
  const el = document.querySelector(id);
  el.href = item.url;
  el.querySelector("strong").textContent = item.status;
  el.querySelector("small").textContent = item.source;
}

function renderBills(bills) {
  const root = document.querySelector("#bills");

  if (!bills.length) {
    root.innerHTML = `<div class="bill">No matching bills found.</div>`;
    return;
  }

  root.innerHTML = bills.map(b => `
    <article class="bill">
      <a href="${b.url}" target="_blank" rel="noopener">
        ${b.type} ${b.number}: ${b.title}
      </a>
      <div class="meta">${b.chamber} · Latest action: ${fmtDate(b.latestActionDate)}</div>
      <div class="action">${b.latestActionText || "No latest action text available."}</div>
    </article>
  `).join("");
}

async function init() {
  const res = await fetch("data/dashboard.json");
  const data = await res.json();

  document.querySelector("#updated").textContent =
    `Updated ${fmtDate(data.updatedAt)} · Links open Congress.gov or official chamber pages`;

  setCard("#house-card", data.chamberStatus.house);
  setCard("#senate-card", data.chamberStatus.senate);

  allBills = data.taxBills;
  renderBills(allBills);
}

document.querySelector("#search").addEventListener("input", e => {
  const q = e.target.value.toLowerCase();
  renderBills(allBills.filter(b =>
    `${b.type} ${b.number} ${b.title} ${b.latestActionText}`.toLowerCase().includes(q)
  ));
});

init();
