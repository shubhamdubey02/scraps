const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
puppeteer.use(StealthPlugin());

async function scrapeBehance() {
    const browser = await puppeteer.launch({
        headless: false,
        args: ["--disable-blink-features=AutomationControlled", "--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();

    await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({
        "Accept-Language": "en-US,en;q=0.9"
    });

    // Navigate to Behance Hire page and wait for it to load
    await page.goto("https://www.behance.net/hire/browse?tracking_source=nav20", {
        waitUntil: "load",
    });

    console.log("Navigated to Behance.co agencies page.");

    // Wait for the first agency listing to appear
    try {
        await page.waitForSelector(".UserRow-root-O95", { visible: true, timeout: 60000 });
    } catch (error) {
        console.error("Timeout while waiting for agency listings:", error);
        await browser.close();
        return;
    }

    let agencies = [];
    let pageNumber = 1;

    while (true) {
        // Scrape agency data from the page
        const pageAgencies = await page.evaluate(() => {
            return Array.from(document.querySelectorAll(".UserRow-root-O95, .UserRow-hoverState-Y1e")).map((el) => ({
                name: el.querySelector("[class*=UserRow-displayName]")?.textContent.trim() || "N/A",
                work: Array.from(el.querySelectorAll("[class*=ScrollableRow-container] a")).map((s) => s.href.trim()),
                avatar: Array.from(el.querySelectorAll("[class*=UserRow-badgesRow]")).map((s) => s.textContent.trim()),
                location: Array.from(el.querySelectorAll("[class*=UserRow-location]")).map((c) => c.textContent.trim()),
                isAvailable: el.querySelector("[class*=UserRow-availability]")?.textContent.trim() || "N/A",
                isPro: el.querySelector("[class*=CreatorProBadge]")?.textContent.trim() || "N/A",                
                projectComplete: el.querySelector(".UserRow-reviewsWrapper-daU")?.textContent.trim() || "N/A",               
                getQuote: el.querySelector("[class*=HireUsersGrid-sendBriefBtn-yZ8]")?.textContent.trim() || "N/A",              
                image: el.querySelector("[class*=AvatarImage-avatarImage]")?.src?.trim() || ""                                   
            }));
        });

        agencies = agencies.concat(pageAgencies);
        console.log(`Page ${pageNumber}: Found ${pageAgencies.length} agencies.`);

        // Check for the "Load More" button and click it if it exists
        const loadMoreButton = await page.$(".button--load-more");
        if (loadMoreButton) {
            console.log(`Clicking "Load More" button on page ${pageNumber}...`);
            await loadMoreButton.click();

            // Wait for new content to load after clicking
            await page.waitForTimeout(3000);
            pageNumber++;
        } else {
            console.log("No more agencies to load. Stopping...");
            break;
        }
    }

    // Save the scraped data to a JSON file
    fs.writeFileSync("Behance_agencies.json", JSON.stringify(agencies, null, 2));
    console.log("Saved data to Behance_agencies.json");

    await browser.close();
}

scrapeBehance()
    .then(() => console.log("Scraping completed!"))
    .catch((err) => console.error("Error:", err));
