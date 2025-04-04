const { chromium } = require('playwright');
const fs = require('fs');

async function scrapeClutch() {
  const browser = await chromium.launch({ headless: true }); // or use headless: false for visual mode
  const page = await browser.newPage();

  let agencies = [];
  let pageNumber = 1;

  await page.goto('https://clutch.co/agencies', { waitUntil: 'domcontentloaded' });
  console.log('Navigated to Clutch.co agencies page.');

  while (true) {
    await page.waitForSelector('.directory-only-related-block', { visible: true });

    const pageAgencies = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.provider-list-item')).map((el) => ({
        name: el.querySelector('.provider__title-link')?.textContent.trim() || 'N/A',
        website: el.querySelector('a.provider__cta-link')?.href || 'N/A',
        services: Array.from(el.querySelectorAll('.provider__services-list div')).map((s) => s.textContent.trim()),
        clients: Array.from(el.querySelectorAll('.provider-clients span')).map((c) => c.textContent.trim()),
        languages: el.querySelector('.provider-languages')?.textContent.trim() || 'N/A',
        rating: el.querySelector('.sg-rating__number')?.textContent.trim() || 'N/A',
        reviews: el.querySelector('.sg-rating__reviews')?.textContent.trim() || 'N/A',
        price: el.querySelector('.min-project-size')?.textContent.trim() || 'N/A',
        companySize: el.querySelector('.employees-count')?.textContent.trim() || 'N/A',
        hrsRate: el.querySelector('meta[itemprop="priceRange"]')?.content || 'N/A',
        email: 'N/A',
        linkedin: 'N/A',
        location: {
          street: el.querySelector('meta[itemprop="streetAddress"]')?.content || 'N/A',
          city: el.querySelector('meta[itemprop="addressLocality"]')?.content || 'N/A',
          state: el.querySelector('meta[itemprop="addressRegion"]')?.content || 'N/A',
          country: el.querySelector('meta[itemprop="addressCountry"]')?.content || 'N/A',
          postalCode: el.querySelector('meta[itemprop="postalCode"]')?.content || 'N/A',
          phone: el.querySelector('meta[itemprop="telephone"]')?.content || 'N/A',
        },
      }));
    });

    agencies = agencies.concat(pageAgencies);
    console.log(`Page ${pageNumber}: Found ${pageAgencies.length} agencies.`);

    // Pagination handling - Click "Next" button if available
    const nextBtn = await page.$('.pager-next a'); // Get the "Next" button
    if (nextBtn) {
      console.log(`Navigating to page ${pageNumber + 1}...`);
      await nextBtn.scrollIntoViewIfNeeded(); // Scroll to make it visible
      await page.waitForTimeout(2000); // Small delay before clicking
      await nextBtn.click(); // Click the next button
      await page.waitForNavigation({ waitUntil: 'domcontentloaded' }); // Ensure page loads
      pageNumber++;
    } else {
      break; // No more pages
    }
  }

  // Fetch email and LinkedIn from each agency's website
  for (let agency of agencies) {
    if (agency.website !== 'N/A') {
      console.log(`Fetching contact info for ${agency.name}`);
      const contactInfo = await scrapeContactInfo(browser, agency.website);
      agency.email = contactInfo.email;
      agency.linkedin = contactInfo.linkedin;
    }
  }

  fs.writeFileSync('clutch_agencies.json', JSON.stringify(agencies, null, 2));
  console.log('Saved data to clutch_agencies.json');

  await browser.close();
}

async function scrapeContactInfo(browser, url) {
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    const contactInfo = await page.evaluate(() => {
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
      const pageText = document.body.innerText;
      const email = pageText.match(emailRegex)?.[0] || 'Not Found';

      const linkedin = Array.from(document.querySelectorAll('a'))
        .find((a) => a.href.includes('linkedin.com'))?.href || 'Not Found';

      return { email, linkedin };
    });

    return contactInfo;
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return { email: 'Not Found', linkedin: 'Not Found' };
  } finally {
    await page.close();
  }
}

// Start scraping
scrapeClutch()
  .then(() => console.log('Scraping completed!'))
  .catch((err) => console.error('Error:', err));
