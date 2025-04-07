const puppeteer = require("puppeteer");
const fs = require("fs");

const config = {
  credentials: {
    email: "shubham.dubey@oodles.io",
    password: "J9!vLm@2qZ"
  },
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  search: {
    keyword: "CEO OR CXO OR COO OR CTO OR CFO",
    scrollCount: 5,
    scrollDelay: 500
  }
};

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function autoScroll(page, count = 5, delayTime = 500) {
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
  const cookiesPath = "linkedin_cookies.json";

  try {
    log("info", "🚀 Launching browser...");
    browser = await puppeteer.launch({
      headless: false,
      args: ["--start-maximized"]
    });

    const page = await browser.newPage();
    await page.setUserAgent(config.userAgent);
    await page.setDefaultNavigationTimeout(120000); // ⏱ Increased timeout

    let loggedIn = false;

    // Load saved cookies
    if (fs.existsSync(cookiesPath)) {
      const cookies = JSON.parse(fs.readFileSync(cookiesPath, "utf8"));
      await page.setCookie(...cookies);
      await page.goto("https://www.linkedin.com/feed", {
        waitUntil: "domcontentloaded",
        timeout: 120000
      });

      if (!(await page.$('a[href*="/me/"]'))) {
        log("error", "Session expired. Logging in again...");
      } else {
        log("success", "Logged in using saved cookies!");
        loggedIn = true;
      }
    }

    // Manual login
    if (!loggedIn) {
      log("info", "🔐 Logging in manually...");
      await page.goto("https://www.linkedin.com/login", {
        waitUntil: "domcontentloaded",
        timeout: 120000
      });

      await page.type("#username", config.credentials.email, { delay: 50 });
      await delay(500);
      await page.type("#password", config.credentials.password, { delay: 50 });

      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 120000 }),
        page.click('button[type="submit"]')
      ]);

      const captcha = await page.$("div[role='dialog'], #captcha-challenge");
      if (captcha) {
        log("error", "CAPTCHA encountered. Manual action required.");
        return;
      }

      log("success", "✅ Logged in successfully!");
      const cookies = await page.cookies();
      fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
    }

    const searchUrl = `https://www.linkedin.com/company/accenture/people/?keywords=${encodeURIComponent(
      config.search.keyword
    )}`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 120000 });

    log("info", "📜 Scrolling for profiles...");
    await autoScroll(page, config.search.scrollCount, config.search.scrollDelay);

    log("info", "🔎 Extracting profiles...");
    const profiles = await extractSimplifiedProfiles(page);

    if (!profiles || profiles.length === 0) {
      log("error", "No profiles found. Possibly selector issue.");
    } else {
      log("success", `📦 Scraped ${profiles.length} profiles:`);
      console.table(profiles);
      const outputPath = "results.json";
      fs.writeFileSync(outputPath, JSON.stringify(profiles, null, 2));
      log("success", `💾 Saved to ${outputPath}`);
    }
  } catch (error) {
    log("error", `💥 Script crashed: ${error.message}`);
  } finally {
    if (browser) await browser.close();
  }
})();

async function extractSimplifiedProfiles(page) {
  return await page.evaluate(() => {
    const elements = document.querySelectorAll(".org-people-profile-card__profile-info");
    return Array.from(elements).map(el => {
      const nameEl = el.querySelector("a");
      const titleEl = el.querySelector("div.t-black--light");
      const name = nameEl?.innerText?.trim() || "N/A";
      const profile_url = nameEl?.href?.split("?")[0] || "N/A";
      const designation = titleEl?.innerText?.trim() || "N/A";

      return {
        name,
        profile_url,
        designation
      };
    }).filter(profile =>
      /(ceo|cxo|coo|cto|cfo)/i.test(profile.designation)
    );
  });
}
