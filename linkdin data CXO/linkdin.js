const puppeteer = require("puppeteer");
const fs = require("fs");

const config = {
  credentials: {
    email: "s32064968@gmail.com",
    password: "J9!vLm@2qZ",
  },
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  search: {
    keyword: "CEO, Managing Partner, Founders",
    scrollCount: 5,
    scrollDelay: 500,
  },
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    error: "\x1b[31m",
  };
  const reset = "\x1b[0m";
  console.log(`${colors[type] || ""}${msg}${reset}`);
}

(async () => {
  const cookiesPath = "linkedin_cookies.json";
  let browser;

  try {
    log("info", "🚀 Launching browser...");
    browser = await puppeteer.launch({
      headless: false,
      args: ["--start-maximized"],
    });

    const page = await browser.newPage();
    await page.setUserAgent(config.userAgent);
    await page.setViewport({ width: 1366, height: 768 });

    await page.setDefaultNavigationTimeout(120000);

    let isLoggedIn = await tryLoginWithCookies(page, cookiesPath);

    if (!isLoggedIn) {
      isLoggedIn = await loginWithCredentials(page);
    }

    if (!isLoggedIn) {
      isLoggedIn = await loginManually(page);
    }

    if (!isLoggedIn) {
      log("error", "❌ Could not log in. Exiting script.");
      return;
    }

    const searchUrl = `https://www.linkedin.com/company/Algofy/people/?keywords=${encodeURIComponent(
      config.search.keyword
    )}`;
    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });

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

async function tryLoginWithCookies(page, cookiesPath) {
  if (!fs.existsSync(cookiesPath)) return false;

  const cookies = JSON.parse(fs.readFileSync(cookiesPath, "utf8"));
  await page.setCookie(...cookies);
  await page.goto("https://www.linkedin.com/feed", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });

  if (await isLoggedIn(page)) {
    log("success", "✅ Logged in using saved cookies!");
    return true;
  }

  log("error", "⛔ Cookie session expired. Need new login.");
  return false;
}

async function loginWithCredentials(page) {
  try {
    log("info", "🔐 Attempting login with credentials...");
    await page.goto("https://www.linkedin.com/login", {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });

    await page.type("#username", config.credentials.email, { delay: 50 });
    await delay(300);
    await page.type("#password", config.credentials.password, { delay: 50 });

    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 120000 }),
    ]);

    if (await page.$("div[role='dialog'], #captcha-challenge")) {
      log("error", "🚫 CAPTCHA encountered. Skipping automated login.");
      return false;
    }

    if (await isLoggedIn(page)) {
      log("success", "✅ Logged in with credentials!");
      await saveCookies(page);
      return true;
    }
  } catch (err) {
    log("error", `❌ Login with credentials failed: ${err.message}`);
  }
  return false;
}

async function loginManually(page) {
  log("info", "🔐 Manual login required. Please complete login in browser...");
  await page.goto("https://www.linkedin.com/login", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });

  const maxWait = 180;
  for (let i = 0; i < maxWait; i++) {
    const url = page.url();
    const meLink = await page.$('a[href*="/me/"]');
    const profileIcon = await page.$('img.global-nav__me-photo');
    const isFeed = url.includes("/feed");

    if (isFeed || meLink || profileIcon) {
      log("success", "\n✅ Manual login successful!");
      await saveCookies(page);
      return true;
    }

    process.stdout.write(`⏳ Waiting for login... ${i + 1}s\r`);
    await delay(1000);
  }

  log("error", "\n❌ Manual login failed. Timeout reached.");
  return false;
}

async function isLoggedIn(page) {
  const url = page.url();
  return (
    url.includes("/feed") ||
    (await page.$('a[href*="/me/"]')) !== null ||
    (await page.$('img.global-nav__me-photo')) !== null
  );
}

async function saveCookies(page) {
  const cookies = await page.cookies();
  fs.writeFileSync("linkedin_cookies.json", JSON.stringify(cookies, null, 2));
  log("info", "💾 Cookies saved for future use.");
}

async function extractSimplifiedProfiles(page) {
  return await page.evaluate(() => {
    const profileCards = document.querySelectorAll('[class*="org-people-profile-card"]');

    return Array.from(profileCards)
      .map((el) => {
        const anchorEl = el.querySelector("a[href*='/in/']");
        const nameSpan = anchorEl?.querySelector("span") || anchorEl;
        const titleEl = el.querySelector("div.t-black--light, div.entity-result__primary-subtitle");

        const name = nameSpan?.innerText?.trim() || "N/A";
        const profile_url = anchorEl?.href?.split("?")[0] || "N/A";
        const designation = titleEl?.innerText?.trim() || "N/A";

        return { name, profile_url, designation };
      })
      .filter((profile) => {
        const combinedText = `${profile.name} ${profile.designation} ${profile.profile_url}`.toLowerCase();
        return /(ceo|cxo|coo|cto|cfo|founder|partner|vp|vice president|president|managing director|executive director)/.test(combinedText);
      });
  });
}


