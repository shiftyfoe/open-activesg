const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

async function scrape() {
  const browser = await chromium.launch({ channel: "chrome", headless: false });
  const page = await browser.newPage();

  const dataPromise = page.waitForResponse(
    (r) => r.url().includes("/api/trpc/pass.getFacilityCapacities"),
    { timeout: 60000 }
  );

  await page.goto("https://activesg.gov.sg/gym-pool-crowd?tab=Pool", {
    waitUntil: "commit",
    timeout: 60000,
  });

  const response = await dataPromise;
  const json = await response.json();
  await browser.close();

  const data = json?.result?.data?.json;
  if (!data) throw new Error("Unexpected API response shape");
  return data;
}

async function collect() {
  console.log(`[${new Date().toISOString()}] collecting...`);

  const data = await scrape();

  const record = {
    timestamp: data.timestamp,
    pools: data.swimFacilities.map((f) => ({
      id: f.id,
      name: f.name,
      capacity_pct: f.capacityPercentage,
      is_closed: f.isClosed,
    })),
  };

  const month = new Date(data.timestamp).toISOString().slice(0, 7); // "YYYY-MM"
  const dataDir = path.join(__dirname, "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const outPath = path.join(dataDir, `${month}.jsonl`);
  fs.appendFileSync(outPath, JSON.stringify(record) + "\n");

  console.log(
    `[${new Date().toISOString()}] appended to ${path.basename(outPath)} ` +
    `(${data.swimFacilities.length} pools, snapshot: ${new Date(data.timestamp).toISOString()})`
  );
}

collect().catch((err) => {
  console.error(err);
  process.exit(1);
});
