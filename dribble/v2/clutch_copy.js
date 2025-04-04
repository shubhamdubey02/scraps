const { chromium } = require('playwright');
const fs = require('fs');

async function scrapeClutch() {
  const browser = await chromium.launch({
    headless: true, // Set to false if you need to see the browser for debugging
    args: ['--disable-blink-features=AutomationControlled'], // Disable automation detection
  });

  // Create a new browser context with the user agent
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  });

  const page = await context.newPage();
  let agencies = [];
  let pageNumber = 1;

  // Navigate to the page and handle Cloudflare JS challenge
  try {
    await page.goto('https://clutch.co/agencies', { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log('Navigated to Clutch.co agencies page.');
  } catch (err) {
    console.error('Error navigating to Clutch.co:', err);
    await browser.close();
    return;
  }

  // Get page content for debugging
  const pageContent = await page.content();
  // console.log(pageContent); // Print the content to console for debugging

  // Scroll down the page to load dynamic content
  await autoScroll(page);

  // Wait for relevant content to load
  await page.waitForSelector('.provider-list-item', { visible: true, timeout: 60000 });
  console.log('Content loaded, starting to scrape.');

  // Scrape agencies on the current page
  while (true) {
    const pageAgencies = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.provider-list-item')).map((el) => ({
        name: el.querySelector('.provider__title-link')?.textContent.trim() || 'N/A',
        website: el.querySelector('a.website-link__item')?.href || 'N/A',
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
      console.log('No more pages, scraping completed.');
      break; // No more pages
    }
  }

  // Fetch email and LinkedIn from each agency's website
  // for (let agency of agencies) {
  //   if (agency.website !== 'N/A') {
  //     console.log(`Fetching contact info for ${agency.name}`);
  //     const contactInfo = await  scrapeContactInfo(browser, agency.website);
  //     agency.email = contactInfo.email;
  //     agency.linkedin = contactInfo.linkedin;
  //   }
  // }

  // Save data to a file
  fs.writeFileSync('clutch_agencies.json', JSON.stringify(agencies, null, 2));
  console.log('Saved data to clutch_agencies.json');

  await browser.close();
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 200); // Small delay for better loading of dynamic content
    });
  });
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
