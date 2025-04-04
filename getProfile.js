const puppeteer = require('puppeteer');

async function scrapeDribbble() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  // Navigate to the search page
  await page.goto('https://dribbble.com/search/designer', { waitUntil: 'networkidle2' });
  console.log('Navigated to Dribbble search page.');

  // Wait for the search results to load
  await page.waitForSelector('img[src^="/users/"]');  // Wait for profile links to appear
  console.log('Page content loaded, waiting for profile links.');

  // Function to extract designer profile links from the search page
  const extractProfileLinks = async () => {
    return await page.evaluate(() => {
      const links = [];
      // The profile links in Dribbble are stored in <a> tags with a specific class
      const elements = document.querySelectorAll('img[src^="/users/"]'); // Profile links start with "/users/"
      
      elements.forEach(el => {
        // Push the full URL of the profile
        links.push('https://dribbble.com' + el.href);
      });
      return links;
    });
  };

  // Function to scrape data from each profile page
  const scrapeProfileData = async (profileUrl) => {
    await page.goto(profileUrl, { waitUntil: 'networkidle2' });
    console.log('Scraping profile:', profileUrl);

    return await page.evaluate(() => {
      const profileData = {};

      // Extracting profile URL
      profileData.profileUrl = window.location.href;

      // Extracting number of followers
      const followers = document.querySelector('a[href$="/followers"]')?.textContent.trim();
      profileData.followers = followers || 'N/A';

      // Extracting number of following
      const following = document.querySelector('a[href$="/following"]')?.textContent.trim();
      profileData.following = following || 'N/A';

      // Extracting number of likes (on the profile page)
      const likes = document.querySelector('.profile-stats .likes')?.textContent.trim();
      profileData.likes = likes || 'N/A';

      // Checking if the designer is available for work
      const availableForWork = document.querySelector('.profile-header__status')?.textContent.trim().toLowerCase();
      profileData.availableForWork = availableForWork ? availableForWork.includes('available') : false;

      return profileData;
    });
  };

  // Extract profile links from the search page
  const profileLinks = await extractProfileLinks();
  console.log(`Found ${profileLinks.length} profiles.`);

  // Loop through each profile link and scrape the data
  const allProfileData = [];
  for (let link of profileLinks) {
    const profileData = await scrapeProfileData(link);
    allProfileData.push(profileData);
    console.log('Scraped data for:', profileData.profileUrl);
  }

  // Optionally, save data to a file or database (e.g., using CSV, MongoDB, etc.)
  console.log('All Scraped Profile Data:', allProfileData);

  await browser.close();
}

// Start scraping
scrapeDribbble()
  .then(() => console.log('Scraping completed!'))
  .catch(err => console.error('Error during scraping:', err));
