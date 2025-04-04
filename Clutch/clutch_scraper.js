const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");

puppeteer.use(StealthPlugin());

async function scrapeClutch() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--disable-blink-features=AutomationControlled", "--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();

    await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({
        "Accept-Language": "en-US,en;q=0.9"
    });

    await page.goto("https://clutch.co/agencies", {
        waitUntil: "domcontentloaded"
    });

    console.log("Navigated to Clutch.co agencies page.");
    await page.waitForSelector(".directory-only-related-block", { visible: true });

    let agencies = [];
    let pageNumber = 1;

    while (true) {
        const pageAgencies = await page.evaluate(() => {
            return Array.from(document.querySelectorAll(".provider-list-item")).map((el) => ({
                name: el.querySelector(".provider__title-link")?.textContent.trim() || "N/A",
                website: el.querySelector("a.provider__cta-link")?.href || "N/A",
                services: Array.from(el.querySelectorAll(".provider__services-list div")).map((s) => s.textContent.trim()),
                clients: Array.from(el.querySelectorAll(".provider-clients span")).map((c) => c.textContent.trim()),
                languages: el.querySelector(".provider-languages")?.textContent.trim() || "N/A",
                rating: el.querySelector(".sg-rating__number")?.textContent.trim() || "N/A",
                reviews: el.querySelector(".sg-rating__reviews")?.textContent.trim() || "N/A",
                price: el.querySelector(".min-project-size")?.textContent.trim() || "N/A",
                companySize: el.querySelector(".employees-count")?.textContent.trim() || "N/A",
                hrsRate: el.querySelector('meta[itemprop="priceRange"]')?.content || "N/A",
                email: "N/A",
                linkedin: "N/A",
                location: {
                    street: el.querySelector('meta[itemprop="streetAddress"]')?.content || "N/A",
                    city: el.querySelector('meta[itemprop="addressLocality"]')?.content || "N/A",
                    state: el.querySelector('meta[itemprop="addressRegion"]')?.content || "N/A",
                    country: el.querySelector('meta[itemprop="addressCountry"]')?.content || "N/A",
                    postalCode: el.querySelector('meta[itemprop="postalCode"]')?.content || "N/A",
                    phone: el.querySelector('meta[itemprop="telephone"]')?.content || "N/A",
                    description: el.querySelector(".provider__description-text-more")?.textContent.trim() || "N/A",
                },
            }));
        });

        agencies = agencies.concat(pageAgencies);
        console.log(`Page ${pageNumber}: Found ${pageAgencies.length} agencies.`);

        const nextBtn = await page.$(".pager-next a");
        if (nextBtn) {
            console.log(`Navigating to page ${pageNumber + 1}...`);
            await nextBtn.evaluate((b) => b.scrollIntoView());
            await new Promise(r => setTimeout(r, 2000));
            await nextBtn.click();
            await page.waitForNavigation({ waitUntil: "domcontentloaded" });
            pageNumber++;
        } else {
            break;
        }
    }

    for (let agency of agencies) {
        if (agency.website !== "N/A") {
            console.log(`Fetching contact info for ${agency.name}`);
            const contactInfo = await scrapeContactInfo(browser, agency.website);
            agency.email = contactInfo.email;
            agency.linkedin = contactInfo.linkedin;
        }
    }

    fs.writeFileSync("clutch_agencies.json", JSON.stringify(agencies, null, 2));
    console.log("Saved data to clutch_agencies.json");

    await browser.close();
}

async function scrapeContactInfo(browser, url) {
    const page = await browser.newPage();

    try {
        await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
        await new Promise(r => setTimeout(r, 3000));

        const contactInfo = await page.evaluate(() => {
            const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
            const pageText = document.body.innerText;
            const email = pageText.match(emailRegex)?.[0] || "Not Found";

            const linkedin = Array.from(document.querySelectorAll("a"))
                .find((a) => a.href.includes("linkedin.com"))?.href || "Not Found";

            return { email, linkedin };
        });

        return contactInfo;
    } catch (error) {
        console.error(`Error fetching ${url}:`, error);
        return { email: "Not Found", linkedin: "Not Found" };
    } finally {
        await page.close();
    }
}

scrapeClutch()
    .then(() => console.log("Scraping completed!"))
    .catch((err) => console.error("Error:", err));
