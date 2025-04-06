const puppeteer = require("puppeteer");
const fs = require("fs");

// Inline config
const config = {
    credentials: {
        email: "shubham.dubey@oodles.io",      // <-- Replace with your LinkedIn email
        password: "J9!vLm@2qZ"             // <-- Replace with your LinkedIn password
    },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    search: {
        keyword: "CEO fintech",
        scrollCount: 10,
        scrollDelay: 1000
    }
};

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function autoScroll(page, count = 10, delayTime = 1000) {
    for (let i = 0; i < count; i++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await delay(delayTime);
    }
}

function log(type, msg) {
    const colors = {
        info: "\x1b[34m",
        success: "\x1b[32m",
        error: "\x1b[31m"
    };
    const reset = "\x1b[0m";
    console.log(`${colors[type] || ""}${msg}${reset}`);
}

(async () => {
    let browser;
    const cookiesPath = 'linkedin_cookies.json';
    try {
        log("info", "Launching browser...");
        browser = await puppeteer.launch({
            headless: false,
            args: ["--start-maximized"],
            // defaultViewport: null
        });

        const page = await browser.newPage();
        await page.setUserAgent(config.userAgent);
        await page.setDefaultNavigationTimeout(60000);

        let loggedIn = false;

        if (fs.existsSync(cookiesPath)) {
            const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
            await page.setCookie(...cookies);
            await page.goto("https://www.linkedin.com/feed", { waitUntil: 'networkidle2' });

            if (!(await page.$('a[data-control-name="identity_profile_photo"]'))) {
                log("error", "Session expired. Logging in again...");
            } else {
                log("success", "Logged in using saved cookies!");
                loggedIn = true;
            }
        }

        if (!loggedIn) {
            log("info", "Opening login page...");
            await page.goto("https://www.linkedin.com/login", { waitUntil: "networkidle2" });

            await page.type('#username', config.credentials.email, { delay: 50 });
            await delay(500);
            await page.type('#password', config.credentials.password, { delay: 50 });

            await Promise.all([
                page.waitForNavigation({ waitUntil: "networkidle2" }),
                page.click('button[type="submit"]')
            ]);

            const captcha = await page.$('div[role="dialog"], #captcha-challenge');
            if (captcha) {
                log("error", "CAPTCHA encountered. Manual action required.");
                return;
            }

            log("success", "Logged in successfully!");
            const cookies = await page.cookies();
            fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
        }

        const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(config.search.keyword)}&network=F&origin=FACETED_SEARCH`;
        await page.goto(searchUrl, { waitUntil: "networkidle2" });

        log("info", "Scrolling...");
        await autoScroll(page, config.search.scrollCount, config.search.scrollDelay);

        log("info", "Extracting profiles...");
        const profiles = await extractSimplifiedProfiles(page);

        if (profiles.length === 0) {
            log("error", "No profiles found.");
        } else {
            log("success", `Scraped ${profiles.length} profiles:`);
            console.table(profiles);
            const outputPath = "results.json";
            fs.writeFileSync(outputPath, JSON.stringify(profiles, null, 2));
            log("success", `Saved to ${outputPath}`);
        }

    } catch (error) {
        log("error", `Script failed: ${error.message}`);
    } finally {
        if (browser) await browser.close();
    }
})();

async function extractSimplifiedProfiles(page) {
    return await page.evaluate(() => {
        const elements = document.querySelectorAll(".reusable-search__result-container, .entity-result");
        return Array.from(elements).map(el => {
            const nameEl = el.querySelector("span[aria-hidden='true']");
            const linkEl = el.querySelector("a[href*='/in/']");
            const titleEl = el.querySelector(".entity-result__primary-subtitle");
            const companyEl = el.querySelector(".entity-result__secondary-subtitle");

            return {
                name: nameEl?.innerText?.trim() || "N/A",
                profile_url: linkEl?.href?.split('?')[0] || "N/A",
                designation: titleEl?.innerText?.trim() || "N/A",
                company: companyEl?.innerText?.trim() || "N/A"
            };
        });
    });
}
