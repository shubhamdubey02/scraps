const puppeteer = require("puppeteer");
const fs = require("fs");

const PROXIES = ["http://proxy1:port", "http://proxy2:port"]; // Replace with actual proxies
const LINKEDIN_ACCOUNTS = [
  { username: "email1@example.com", password: "password1" },
  { username: "email2@example.com", password: "password2" }
];

async function launchBrowser(proxy) {
  return puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      proxy ? `--proxy-server=${proxy}` : "",
    ].filter(Boolean),
  });
}

async function scrapeClutch() {
  const proxy = PROXIES[Math.floor(Math.random() * PROXIES.length)];
  const browser = await launchBrowser(proxy);
  const page = await browser.newPage();

  await page.goto("https://clutch.co/agencies", { waitUntil: "networkidle2" });
  console.log("Navigated to Clutch.co agencies page.");

  await page.waitForSelector(".directory-list .provider-row");

  const agencies = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".directory-list .provider-row")).map((el) => ({
      name: el.querySelector(".provider-info h3")?.textContent.trim() || "N/A",
      website: el.querySelector(".website-link__item a")?.href || "N/A",
      linkedin: "N/A",
      email: "N/A",
      founder: "N/A",
      type: "N/A", // Will be set later
    }));
  });

  console.log(`Found ${agencies.length} agencies.`);

  for (let agency of agencies) {
    if (agency.website !== "N/A") {
      console.log(`Fetching contact info for ${agency.name}`);
      const contactInfo = await scrapeContactInfo(agency.website);
      agency.email = contactInfo.email;
      agency.linkedin = contactInfo.linkedin;
      
      if (agency.linkedin !== "Not Found") {
        const linkedInInfo = await scrapeLinkedIn(agency.linkedin);
        agency.founder = linkedInInfo.founder;
        agency.type = linkedInInfo.type;
      }
    }
  }

  fs.writeFileSync("clutch_agencies.json", JSON.stringify(agencies, null, 2));
  console.log("Saved data to clutch_agencies.json");

  await browser.close();
}

async function scrapeContactInfo(url) {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

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
    await browser.close();
  }
}

async function scrapeLinkedIn(linkedinUrl) {
  const proxy = PROXIES[Math.floor(Math.random() * PROXIES.length)];
  const { username, password } = LINKEDIN_ACCOUNTS[Math.floor(Math.random() * LINKEDIN_ACCOUNTS.length)];

  const browser = await launchBrowser(proxy);
  const page = await browser.newPage();

  try {
    await page.goto("https://www.linkedin.com/login", { waitUntil: "networkidle2" });
    await page.type("#username", username);
    await page.type("#password", password);
    await page.click("button[type='submit']");
    await page.waitForNavigation();

    await page.goto(linkedinUrl, { waitUntil: "networkidle2" });

    const linkedInData = await page.evaluate(() => {
      const name = document.querySelector(".text-heading-xlarge")?.textContent.trim() || "N/A";
      const isCompany = !!document.querySelector(".org-top-card");
      const founder = Array.from(document.querySelectorAll(".pv-top-card .text-body-medium"))
        .find(el => el.textContent.toLowerCase().includes("founder") || el.textContent.toLowerCase().includes("ceo"))?.textContent.trim() || "Not Found";

      return {
        type: isCompany ? "Company" : "Individual",
        founder: founder !== "Not Found" ? founder : "Not Found",
      };
    });

    return linkedInData;
  } catch (error) {
    console.error(`Error scraping LinkedIn ${linkedinUrl}:`, error);
    return { type: "Not Found", founder: "Not Found" };
  } finally {
    await browser.close();
  }
}

// Start scraping
scrapeClutch()
  .then(() => console.log("Scraping completed!"))
  .catch((err) => console.error("Error:", err));
