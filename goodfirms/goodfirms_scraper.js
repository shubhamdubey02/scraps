const puppeteer = require("puppeteer");
const fs = require("fs");

async function scrapeGoodFirms() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  // Set User-Agent to avoid detection
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
  );

  await page.goto("https://www.goodfirms.co/directory/languages/top-software-development-companies", {
    waitUntil: "networkidle2",
    timeout: 60000,
  });

  console.log(await page.content())

  console.log("Navigated to GoodFirms directory page.");

  // Auto-scroll to load all listings
  await autoScroll(page);

  await page.waitForSelector(".directory-list", { visible: true, timeout: 60000 });

  const agencies = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".firm-wrapper")).map((el) => ({
      name: el.querySelector(".firm-name a")?.textContent.trim() || "N/A",
      profileUrl: el.querySelector(".visit-profile")?.href || "N/A",
      website: el.querySelector(".visit-website.web-url")?.href || "N/A",
      logo: el.querySelector(".firm-logo img")?.src || "N/A",
      tagline: el.querySelector(".tagline")?.textContent.trim() || "N/A",
      description: el.querySelector(".firm-short-description")?.textContent.trim() || "N/A",
      hourlyRate: el.querySelector(".firm-pricing span")?.textContent.trim() || "N/A",
      employees: el.querySelector(".firm-employees span")?.textContent.trim() || "N/A",
      founded: el.querySelector(".firm-founded span")?.textContent.trim() || "N/A",
      verified: el.querySelector(".verified-tag") ? "Verified" : "Not Verified",
      location: el.querySelector(".firm-location span")?.textContent.trim() || "N/A",
      focusAreas: Array.from(el.querySelectorAll(".firm-focus-area-wrapper")).map((area) => ({
        percentage: area.querySelector(".firm-focus-item-name span")?.textContent.trim() || "N/A",
        category: area.querySelector(".firm-focus-item-name")?.textContent.replace(/^\d+%/, "").trim() || "N/A",
      })),
      rating: el.querySelector(".rating-number")?.textContent.trim() || "N/A",
      reviewsCount: el.querySelector("[itemprop='reviewCount']")?.content || "N/A",
      reviewHighlight: el.querySelector(".review-highlight-text q")?.textContent.trim() || "N/A",
      reviewAuthor: el.querySelector(".review-provider")?.textContent.trim() || "N/A",
    }));
  });

  console.log(`Extracted ${agencies.length} companies.`);

  fs.writeFileSync("goodfirms_agencies.json", JSON.stringify(agencies, null, 2));
  console.log("Saved data to goodfirms_agencies.json");

  await browser.close();
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 200);
    });
  });
}

// Start scraping
scrapeGoodFirms()
  .then(() => console.log("Scraping completed!"))
  .catch((err) => console.error("Error:", err));