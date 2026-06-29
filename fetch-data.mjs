import fs from "fs/promises";

const API_KEY = process.env.CONGRESS_API_KEY;
const CONGRESS = 119;
const LIMIT = 80;

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function congressUrl(bill) {
  const type = bill.type.toLowerCase().replace("jres", "jres").replace("conres", "conres");
  return `https://www.congress.gov/bill/${bill.congress}th-congress/${billTypePath(type)}/${bill.number}`;
}

function billTypePath(type) {
  return {
    hr: "house-bill",
    s: "senate-bill",
    hjres: "house-joint-resolution",
    sjres: "senate-joint-resolution",
    hconres: "house-concurrent-resolution",
    sconres: "senate-concurrent-resolution",
    hres: "house-resolution",
    sres: "senate-resolution"
  }[type] || type;
}

async function fetchTaxBills() {
  const url = `https://api.congress.gov/v3/bill/${CONGRESS}?format=json&limit=${LIMIT}&api_key=${API_KEY}`;
  const data = await getJson(url);

  const bills = data.bills || [];

  const checked = await Promise.all(
    bills.map(async bill => {
      try {
        const subjectUrl = `https://api.congress.gov/v3/bill/${bill.congress}/${bill.type.toLowerCase()}/${bill.number}/subjects?format=json&api_key=${API_KEY}`;
        const subjects = await getJson(subjectUrl);
        const policy = subjects.subjects?.policyArea?.name || "";
        const legislative = subjects.subjects?.legislativeSubjects?.map(s => s.name).join(" ") || "";
        const haystack = `${policy} ${legislative} ${bill.title}`.toLowerCase();

        if (!haystack.includes("tax")) return null;

        return {
          title: bill.title,
          congress: bill.congress,
          type: bill.type,
          number: bill.number,
          chamber: bill.originChamber || "",
          latestActionDate: bill.latestAction?.actionDate || "",
          latestActionText: bill.latestAction?.text || "",
          url: congressUrl(bill)
        };
      } catch {
        return null;
      }
    })
  );

  return checked
    .filter(Boolean)
    .sort((a, b) => new Date(b.latestActionDate) - new Date(a.latestActionDate))
    .slice(0, 40);
}

async function fetchChamberStatus() {
  return {
    house: {
      label: "House",
      status: "Check live status",
      url: "https://clerk.house.gov/",
      source: "Office of the Clerk"
    },
    senate: {
      label: "Senate",
      status: "Check live status",
      url: "https://www.senate.gov/legislative/floor_activity_pail.htm",
      source: "U.S. Senate"
    }
  };
}

const dashboard = {
  updatedAt: new Date().toISOString(),
  chamberStatus: await fetchChamberStatus(),
  taxBills: await fetchTaxBills()
};

await fs.mkdir("data", { recursive: true });
await fs.writeFile("data/dashboard.json", JSON.stringify(dashboard, null, 2));
