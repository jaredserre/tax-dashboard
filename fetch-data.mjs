import fs from "fs/promises";

const API_KEY = process.env.CONGRESS_API_KEY;
const CONGRESS = 119;
const LIMIT = 100;

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

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status}: ${url}`);
  return res.json();
}

function congressBillUrl(bill) {
  const type = bill.type.toLowerCase();
  return `https://www.congress.gov/bill/${bill.congress}th-congress/${BILL_TYPE_PATHS[type]}/${bill.number}`;
}

async function getBillSubjects(bill) {
  const type = bill.type.toLowerCase();
  const url = `https://api.congress.gov/v3/bill/${bill.congress}/${type}/${bill.number}/subjects?format=json&api_key=${API_KEY}`;
  return getJson(url);
}

function isTaxBill(bill, subjects) {
  const policyArea = subjects.subjects?.policyArea?.name || "";
  const legislativeSubjects = subjects.subjects?.legislativeSubjects?.map(s => s.name).join(" ") || "";

  const text = `${bill.title} ${policyArea} ${legislativeSubjects}`.toLowerCase();

  return (
    policyArea.toLowerCase() === "taxation" ||
    text.includes("tax") ||
    text.includes("internal revenue") ||
    text.includes("irs") ||
    text.includes("tariff")
  );
}

async function fetchTaxBills() {
  const url = `https://api.congress.gov/v3/bill/${CONGRESS}?format=json&limit=${LIMIT}&api_key=${API_KEY}`;
  const data = await getJson(url);

  const results = [];

  for (const bill of data.bills || []) {
    try {
      const subjects = await getBillSubjects(bill);

      if (!isTaxBill(bill, subjects)) continue;

      results.push({
        id: `${bill.type} ${bill.number}`,
        title: bill.title,
        congress: bill.congress,
        type: bill.type,
        number: bill.number,
        chamber: bill.originChamber || "",
        latestActionDate: bill.latestAction?.actionDate || "",
        latestActionText: bill.latestAction?.text || "",
        url: congressBillUrl(bill)
      });
    } catch {
      // Skip individual bills that fail.
    }
  }

  return results
    .sort((a, b) => new Date(b.latestActionDate || 0) - new Date(a.latestActionDate || 0))
    .slice(0, 50);
}

const dashboard = {
  updatedAt: new Date().toISOString(),
  chamberStatus: {
    house: {
      label: "House",
      status: "Official status",
      url: "https://clerk.house.gov/",
      source: "Office of the Clerk"
    },
    senate: {
      label: "Senate",
      status: "Official status",
      url: "https://www.senate.gov/legislative/floor_activity_pail.htm",
      source: "U.S. Senate floor activity"
    }
  },
  taxBills: await fetchTaxBills()
};

await fs.mkdir("data", { recursive: true });
await fs.writeFile("data/dashboard.json", JSON.stringify(dashboard, null, 2));
