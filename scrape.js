const { chromium } = require("playwright");

async function scrapePoolCapacity() {
  // Use installed Chrome — passes Cloudflare's managed challenge
  const browser = await chromium.launch({
    channel: "chrome",
    headless: false,
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  let poolData = null;

  const dataPromise = page.waitForResponse(
    (r) => r.url().includes("/api/trpc/pass.getFacilityCapacities"),
    { timeout: 60000 }
  );

  await page.goto("https://activesg.gov.sg/gym-pool-crowd?tab=Pool", {
    waitUntil: "commit",
    timeout: 60000,
  });

  let response;
  try {
    response = await dataPromise;
    const json = await response.json();
    poolData = json?.result?.data?.json;
  } catch (e) {
    console.error("No pool data captured — Cloudflare may have blocked us:", e.message);
    await browser.close();
    return;
  }

  const { timestamp, swimFacilities } = poolData;
  console.log(`Captured at: ${new Date(timestamp).toISOString()}\n`);

  const open = swimFacilities.filter((f) => !f.isClosed);
  const closed = swimFacilities.filter((f) => f.isClosed);

  console.log("=== OPEN POOLS ===");
  open
    .sort((a, b) => a.capacityPercentage - b.capacityPercentage)
    .forEach((f) => {
      const bar = "█".repeat(Math.round(f.capacityPercentage / 5));
      console.log(`${f.capacityPercentage.toString().padStart(3)}% ${bar.padEnd(20)} ${f.name}`);
    });

  if (closed.length) {
    console.log(`\n=== CLOSED (${closed.length}) ===`);
    closed.forEach((f) => console.log(`  - ${f.name}`));
  }

  await browser.close();
}

scrapePoolCapacity().catch(console.error);
