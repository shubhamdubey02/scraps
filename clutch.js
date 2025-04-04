const puppeteer = require('puppeteer');

async function scrapeClutchAgencies(url) {
  // Launch browser in headless mode
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Go to Clutch.co search URL
  console.log(`Navigating to Clutch URL: ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Scrape agency profiles
  console.log('Scraping agency profiles...');
  const agencies = await page.evaluate(() => {
    const profiles = [];
    const profileLinks = document.querySelectorAll('.provider__title-link directory_profile'); // Adjust selector to match Clutch agency profile links
    profileLinks.forEach(link => {
      profiles.push(link.href); // Get the link to the agency's profile
    });

    return profiles;
  });

  console.log(`Found ${agencies.length} agency profiles...`);

  // Loop through profiles and extract details
  for (let agency of agencies) {
    console.log(`Visiting agency profile: ${agency}`);
    await page.goto(agency, { waitUntil: 'domcontentloaded' });

    const agencyData = await page.evaluate(() => {
      const name = document.querySelector('.provider-header__name') ? document.querySelector('.provider-header__name').innerText : 'Not available';
      const email = document.querySelector('.email') ? document.querySelector('.email').innerText : 'Not available';
      const website = document.querySelector('a[href^="http"]') ? document.querySelector('a[href^="http"]').href : 'Not available';
      const linkedin = document.querySelector('a[href*="linkedin.com"]') ? document.querySelector('a[href*="linkedin.com"]').href : 'Not available';

      // Get services and other relevant details
      const services = document.querySelector('.provider-services__list') ? document.querySelector('.provider-services__list').innerText : 'Not specified';
      const clients = document.querySelector('.clients') ? document.querySelector('.clients').innerText : 'Not specified';

      return { name, email, linkedin, website, services, clients };
    });

    console.log('Found agency with details:');
    console.log(agencyData);
  }

  console.log('Scraping complete.');
  await browser.close();
}

// Example URL (search for agencies on Clutch.co)
scrapeClutchAgencies('https://clutch.co/agencies/design');
