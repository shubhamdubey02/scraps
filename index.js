const puppeteer = require('puppeteer');

async function scrapeDribbbleDesigners(url) {
  // Launch browser in headless mode
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Go to the Dribbble search URL
  console.log(`Navigating to Dribbble URL: ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Scrape the designer profiles
  console.log('Scraping designer profiles...');
  const designers = await page.evaluate(() => {
    const profiles = [];
    const profileLinks = document.querySelectorAll('a[class="dribbble-link"]'); // Adjust this to match the profile link selector
    profileLinks.forEach(link => {
      profiles.push(link.href); // Get the link to the designer's profile
    });

    return profiles;
  });

  console.log(`Found ${designers.length} designer profiles...`);

  // Loop through profiles and extract details (check for hourly rate)
  for (let profile of designers) {
    console.log(`Visiting profile: ${profile}`);
    await page.goto(profile, { waitUntil: 'domcontentloaded' });

    const designerData = await page.evaluate(() => {
      const description = document.querySelector('.bio') ? document.querySelector('.bio').innerText : '';
      const email = document.querySelector('.email') ? document.querySelector('.email').innerText : 'Not available';
      const linkedin = document.querySelector('a[href*="linkedin.com"]') ? document.querySelector('a[href*="linkedin.com"]').href : 'Not available';
      const website = document.querySelector('a[href^="http"]') ? document.querySelector('a[href^="http"]').href : 'Not available';

      const hourlyRate = description.includes('$20') ? '$20+' : 'Not specified'; // Look for $20 or similar in the description

      return { profile, description, email, linkedin, website, hourlyRate };
    });

    if (designerData.hourlyRate === '$20+') {
      console.log('Found designer with $20+ rate:');
      console.log(designerData);
    } else {
      console.log('Designer does not meet $20+ hourly rate criteria.');
    }
  }

  console.log('Scraping complete.');
  await browser.close();
}

// Example URL (search for designers on Dribbble)
scrapeDribbbleDesigners('https://dribbble.com/search/designer');
