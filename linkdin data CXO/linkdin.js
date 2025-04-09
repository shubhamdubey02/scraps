const puppeteer = require("puppeteer-extra");
const fs = require("fs");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

const config = {
  credentials: {
    email: "r40099827@gmail.com",
    password: "J9!vLm@2qZ",
  },
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  search: {
    company: "fireart-ltd-",
    keyword: "CEO, Managing Partner, Founders,CXO",
    scrollCount: 50,
    scrollDelay: 500,
  },
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function autoScroll(page, count = 10, delayTime = 1000) {
  for (let i = 0; i < count; i++) {
    log("info", `🌀 Scrolling iteration ${i + 1}/${count}`);
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await delay(delayTime);

    try {
      const button = await page.$(
        'button.artdeco-button--secondary.scaffold-finite-scroll__load-button'
      );

      if (button) {
        const isDisabled = await page.evaluate((btn) => btn.disabled, button);
        const isVisible = await page.evaluate(
          (btn) => !!(btn.offsetParent !== null),
          button
        );

        if (!isDisabled && isVisible) {
          log("info", "🟢 Clicking 'Show more results' button.");
          await button.click();
          await delay(1000);
        } else {
          log("info", "⛔ Button is disabled or not visible.");
        }
      } else {
        log("info", "⚠️ 'Show more results' button not found.");
      }
    } catch (err) {
      log("error", `❌ Error during button click: ${err.message}`);
    }
  }
}

(async () => {
  const cookiesPath = "linkedin_cookies.json";
  let browser;

  try {
    log("info", "🚀 Launching browser...");
    browser = await puppeteer.launch({
      headless: false,
      args: ["--start-maximized"],
      defaultViewport: null,
    });

    const page = await browser.newPage();
    await page.setUserAgent(config.userAgent);
    await page.setDefaultNavigationTimeout(120000);

    let isLoggedIn = await tryLoginWithCookies(page, cookiesPath);
    if (!isLoggedIn) isLoggedIn = await loginWithCredentials(page);
    if (!isLoggedIn) isLoggedIn = await loginManually(page);
    if (!isLoggedIn) {
      log("error", "❌ Could not log in. Exiting script.");
      return;
    }

    const searchUrl = `https://www.linkedin.com/company/${config.search.company}/people/?keywords=${encodeURIComponent(config.search.keyword)}`;
    log("info", `🔗 Navigating to ${searchUrl}`);
    await safeGoto(page, searchUrl);

    log("info", "📜 Scrolling for profiles...");
    await autoScroll(page, config.search.scrollCount, config.search.scrollDelay);

    log("info", "🔎 Extracting profiles...");
    const profiles = await extractSimplifiedProfiles(page);

    const uniqueProfiles = Array.from(
      new Map(profiles.map((p) => [p.profile_url, p])).values()
    );

    if (!uniqueProfiles || uniqueProfiles.length === 0) {
      log("error", "No unique profiles found.");
    } else {
      log("success", `📦 Scraped ${uniqueProfiles.length} unique profiles:`);
      console.table(uniqueProfiles);
      fs.writeFileSync(
        config.search.company + "_results.json",
        JSON.stringify(uniqueProfiles, null, 2)
      );
      log("success", `💾 Saved to ${config.search.company}_results.json`);
    }
  } catch (error) {
    log("error", `💥 Script crashed: ${error.message}`);
  } finally {
    if (browser) await browser.close();
  }
})();

async function safeGoto(page, url) {
  try {
    log("info", `🌍 Going to ${url}`);
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
  } catch (err) {
    log("error", "⚠️ Page failed to load. Retrying...");
    await delay(3000);
    await page.goto(url, { waitUntil: "load", timeout: 60000 }).catch(() => {});
  }
}

async function tryLoginWithCookies(page, cookiesPath) {
  if (!fs.existsSync(cookiesPath)) return false;
  log("info", "🍪 Trying login with cookies...");
  const cookies = JSON.parse(fs.readFileSync(cookiesPath, "utf8"));
  await page.setCookie(...cookies);
  await safeGoto(page, "https://www.linkedin.com/feed");

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
    await safeGoto(page, "https://www.linkedin.com/login");

    await page.type("#username", config.credentials.email, { delay: 50 });
    await delay(300);
    await page.type("#password", config.credentials.password, { delay: 50 });

    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 60000 }),
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
  await safeGoto(page, "https://www.linkedin.com/login");

  const maxWait = 180;
  for (let i = 0; i < maxWait; i++) {
    const meLink = await page.$('a[href*="/me/"]');
    const profileIcon = await page.$('img.global-nav__me-photo');
    const isFeed = page.url().includes("/feed");

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
  fs.writeFileSync("linkedin_cookies2.json", JSON.stringify(cookies, null, 2));
  log("info", "💾 Cookies saved for future use.");
}

async function extractSimplifiedProfiles(page) {
  log("info", "🔍 Running profile extraction script in page context...");
  const { profiles, privateCount } = await page.evaluate(() => {
    const cards = document.querySelectorAll('[class*="org-people-profile-card__card-spacing"]');
    const seen = new Set();
    const results = [];
    let privateCount = 0;

    cards.forEach((card) => {
      const anchor = card.querySelector("a[href*='/in/']");
      const profile_url = anchor ? anchor.href.split("?")[0] : "N/A";

      if (profile_url !== "N/A" && seen.has(profile_url)) return;
      seen.add(profile_url);

      const img = card.querySelector("img");
      const nameFromAlt = img?.alt?.trim();
      const spanName = card.querySelector("span[aria-hidden='true'], span")?.innerText?.trim();
      let user_profilename = nameFromAlt || spanName || "LinkedIn Member";
      user_profilename = user_profilename.replace(/LinkedIn Member/i, "").trim() || "LinkedIn Member";

      const subtitleEl = card.querySelector(
        ".org-people-profile-card__profile-title, .artdeco-entity-lockup__subtitle, .entity-result__primary-subtitle, .t-black--light"
      );
      let designation = subtitleEl?.innerText?.trim() || "N/A";

      const isPrivate = user_profilename === "LinkedIn Member" || designation === "N/A" || profile_url === "N/A";
      if (isPrivate) {
        privateCount++;
        return;
      }

      const lower = `${user_profilename} ${designation}`.toLowerCase();
      if (
        /(ceo|cxo|coo|cto|cfo|founder|partner|vp|vice president|president|managing|chair|executive|chief)/.test(lower)
      ) {
        results.push({
          user_profilename,
          profile_url,
          designation,
        });
      }
    });

    return { profiles: results, privateCount };
  });

  log("info", `🔢 Total private or incomplete profiles skipped: ${privateCount}`);
  return profiles;
}