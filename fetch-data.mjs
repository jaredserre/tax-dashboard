import fs from "fs/promises";

const API_KEY = process.env.CONGRESS_API_KEY;
const CONGRESS = 119;

const BILL_TYPE_PATHS = {
  hr: "house-bill",
  s: "senate-bill",
  hjres: "house-joint-resolution",
  sjres: "senate-joint-resolution",
  hconres: "house-concurrent-resolution",
  sconres: "senate-concurrent-resolution",
  hres: "house-resolution",
  sres: "senate-resolution"
};

async function getText(url) {
  const res = await fetch(url, { headers: { "user-agent": "tax-dashboard" } });
  if (!res.ok) throw new Error(`${res.status}: ${url}`);
  return res.text();
}

async function getJson(url) {
  const res = await fetch(url, { headers: { "user-agent": "tax-dashboard" } });
  if (!res.ok) throw new Error(`${res.status}: ${url}`);
  return res.json();
}

async function safe(label, fn, fallback = []) {
  try {
    return await fn();
  } catch (err) {
    console.log(`${label} failed:`, err.message);
    return fallback;
  }
}

function clean(value = "") {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/\s+/g, " ")
    .trim();
}

function congressBillUrl(bill) {
  const type = bill.type.toLowerCase();
  return `https://www.congress.gov/bill/${bill.congress}th-congress/${BILL_TYPE_PATHS[type]}/${bill.number}`;
}

function isToday(dateValue) {
  if (!dateValue) return false;
  const d = new Date(dateValue);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

async function fetchTaxBills() {
  const url = `https://api.congress.gov/v3/bill/${CONGRESS}?format=json&limit=100&api_key=${API_KEY}`;
  const data = await getJson(url);
  const bills = data.bills || [];
  const results = [];

  for (const bill of bills) {
    try {
      const type = bill.type.toLowerCase();
      const subjectsUrl = `https://api.congress.gov/v3/bill/${bill.congress}/${type}/${bill.number}/subjects?format=json&api_key=${API_KEY}`;
      const subjects = await getJson(subjectsUrl);

      const policyArea = subjects.subjects?.policyArea?.name || "";
      const legislativeSubjects = subjects.subjects?.legislativeSubjects?.map(s => s.name).join(" ") || "";
      const text = `${bill.title} ${policyArea} ${legislativeSubjects}`.toLowerCase();

      const isTax =
        policyArea.toLowerCase() === "taxation" ||
        text.includes("tax") ||
        text.includes("internal revenue") ||
        text.includes("irs") ||
        text.includes("tariff");

      if (!isTax) continue;

      results.push({
        source: "Congress.gov",
        id: `${bill.type} ${bill.number}`,
        title: bill.title,
        congress: bill.congress,
        type: bill.type,
        number: bill.number,
        chamber: bill.originChamber || "",
        date: bill.latestAction?.actionDate || "",
        latestActionDate: bill.latestAction?.actionDate || "",
        latestActionText: bill.latestAction?.text || "",
        url: congressBillUrl(bill)
      });
    } catch {}
  }

  return results
    .sort((a, b) => new Date(b.latestActionDate || 0) - new Date(a.latestActionDate || 0))
    .slice(0, 50);
}

async function fetchHouseStatus() {
  const url = "https://clerk.house.gov/";
  const html = await getText(url);
  const text = html.toLowerCase();

  let status = "Check official status";
  if (text.includes("house is in session")) status = "In session";
  else if (text.includes("house is not in session")) status = "Not in session";
  else if (text.includes("adjourned")) status = "Adjourned";

  return { label: "House", status, url, source: "Office of the Clerk" };
}

async function fetchSenateStatus() {
  const url = "https://www.senate.gov/legislative/floor_activity_pail.htm";
  const html = await getText(url);
  const text = html.toLowerCase();

  let status = "Check official status";
  if (text.includes("called the senate to order") || text.includes("senate is in session")) status = "In session";
  else if (text.includes("stands adjourned") || text.includes("adjourned")) status = "Adjourned";

  return { label: "Senate", status, url, source: "U.S. Senate floor activity" };
}

async function fetchFederalRegisterTaxDocs() {
  const url =
    "https://www.federalregister.gov/api/v1/documents.json" +
    "?conditions%5Bterm%5D=tax" +
    "&conditions%5Bagencies%5D%5B%5D=treasury-department" +
    "&order=newest" +
    "&per_page=12";

  const data = await getJson(url);

  return (data.results || []).map(item => ({
    source: "Federal Register",
    title: item.title,
    date: item.publication_date,
    type: item.type,
    agency: item.agencies?.map(a => a.name).join(", ") || "Federal Register",
    url: item.html_url
  }));
}

async function fetchIrsNews() {
  const url = "https://www.irs.gov/newsroom/news-releases-for-current-month";
  const html = await getText(url);

  return [...html.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)]
    .map(match => {
      const href = match[1];
      const title = clean(match[2]);
      if (!href.includes("/newsroom/")) return null;
      if (!title.startsWith("IR-")) return null;

      return {
        source: "IRS",
        title,
        date: "",
        url: href.startsWith("http") ? href : `https://www.irs.gov${href}`
      };
    })
    .filter(Boolean)
    .slice(0, 10);
}

async function fetchTreasuryNews() {
  const url = "https://home.treasury.gov/news/press-releases";
  const html = await getText(url);

  return [...html.matchAll(/<a href="([^"]*\/news\/press-releases\/[^"]+)">([\s\S]*?)<\/a>/g)]
    .map(match => ({
      source: "Treasury",
      title: clean(match[2]),
      date: "",
      url: match[1].startsWith("http") ? match[1] : `https://home.treasury.gov${match[1]}`
    }))
    .filter(item => item.title.length > 10)
    .slice(0, 10);
}

async function fetchCommitteeHearings() {
  return [
    {
      committee: "House Ways & Means",
      title: "House Ways & Means hearings",
      date: "",
      url: "https://waysandmeans.house.gov/hearings/"
    },
    {
      committee: "Senate Finance",
      title: "Senate Finance hearings",
      date: "",
      url: "https://www.finance.senate.gov/hearings"
    }
  ];
}

function buildWatchlist(items) {
  const terms = [
    "TCJA",
    "SALT",
    "reconciliation",
    "digital asset",
    "crypto",
    "IRS funding",
    "GILTI",
    "BEAT",
    "Pillar Two",
    "clean energy",
    "tariff",
    "partnership",
    "corporate tax"
  ];

  const matches = [];

  for (const item of items) {
    const text = `${item.title || ""} ${item.latestActionText || ""}`.toLowerCase();

    for (const term of terms) {
      if (text.includes(term.toLowerCase())) {
        matches.push({ ...item, matchedTerm: term });
        break;
      }
    }
  }

  return matches.slice(0, 20);
}

const chamberStatus = {
  house: await safe("House status", fetchHouseStatus, {
    label: "House",
    status: "Check official status",
    url: "https://clerk.house.gov/",
    source: "Office of the Clerk"
  }),
  senate: await safe("Senate status", fetchSenateStatus, {
    label: "Senate",
    status: "Check official status",
    url: "https://www.senate.gov/legislative/floor_activity_pail.htm",
    source: "U.S. Senate floor activity"
  })
};

const taxBills = await safe("Congress.gov tax bills", fetchTaxBills);
const federalRegister = await safe("Federal Register", fetchFederalRegisterTaxDocs);
const irsNews = await safe("IRS news", fetchIrsNews);
const treasuryNews = await safe("Treasury news", fetchTreasuryNews);
const hearings = await safe("Committee hearings", fetchCommitteeHearings);

const allItems = [...taxBills, ...federalRegister, ...irsNews, ...treasuryNews, ...hearings];

const dashboard = {
  updatedAt: new Date().toISOString(),
  chamberStatus,
  today: {
    taxBillsUpdatedToday: taxBills.filter(b => isToday(b.latestActionDate)).length,
    federalRegisterToday: federalRegister.filter(i => isToday(i.date)).length,
    irsItems: irsNews.length,
    treasuryItems: treasuryNews.length
  },
  taxBills,
  federalRegister,
  irsNews,
  treasuryNews,
  hearings,
  watchlist: buildWatchlist(allItems)
};

await fs.mkdir("data", { recursive: true });
await fs.writeFile("data/dashboard.json", JSON.stringify(dashboard, null, 2));
