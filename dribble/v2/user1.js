const { chromium } = require('playwright');

async function scrapeDribbble(browser,page) {
//   const browser = await chromium.launch({ headless: true });
//   const page = await browser.newPage();

  // Navigate to Dribbble search page
  await page.goto('https://dribbble.com/search/designer');
  console.log('Navigated to Dribbble search page.');

  // Wait for profile links to load
  await page.waitForSelector('a.hoverable.url');
  console.log('Profile links loaded.');

  // Extract profile links from the search page
  const profileLinks = await page.evaluate(() => {
    const links = [];
    const elements = document.querySelectorAll('a.hoverable.url'); // Profile links have the "hoverable url" class
    elements.forEach(el => {
      const href = el.getAttribute('href');
      if (href && !links.includes('https://dribbble.com'+href)) {
        links.push('https://dribbble.com' + href); // Construct the full profile URL
      }
    });
    return links;
  });

  // Loop through each profile link and scrape the data
  const allProfileData = [];
  for (let link of profileLinks) {
    const profileData = await scrapeProfileData(page, link);
    allProfileData.push(profileData);
    console.log('Scraped data for:', profileData.profileUrl);
  }

  // Optionally, save data to a file or database (e.g., using CSV, MongoDB, etc.)
  console.log('All Scraped Profile Data:', allProfileData);

  await browser.close();
}

// Function to scrape data from each profile page
async function scrapeProfileData(page, profileUrl) {
  await page.goto(profileUrl);

  // Wait for profile details to load
  await page.waitForSelector('.masthead-stats');
  console.log('Profile page loaded:', profileUrl);

  const profileData = await page.evaluate(() => {
    const data = {};

    // Extracting profile URL
    data.profileUrl = window.location.href;

    // Extracting number of followers, following, and likes from the masthead-stats section
    const stats = document.querySelectorAll('.masthead-stats .stat');
    if (stats.length >= 3) {
      data.followers = stats[0].textContent.trim().replace(/\D/g, ''); // Remove non-numeric characters
      data.following = stats[1].textContent.trim().replace(/\D/g, ''); // Remove non-numeric characters
      data.likes = stats[2].textContent.trim().replace(/\D/g, ''); // Remove non-numeric characters
    } else {
      data.followers = 'N/A';
      data.following = 'N/A';
      data.likes = 'N/A';
    }

    // Checking if the designer is available for work
    const availableForWork = document.querySelector('.profile-header__status')?.textContent.trim().toLowerCase();
    data.availableForWork = availableForWork ? availableForWork.includes('available') : false;

    // Checking for Pro Badge
    const proBadge = document.querySelector('.icon.masthead-pro-badge');
    data.isPro = proBadge ? true : false;

    return data;
  });

  return profileData;
}

async function loginToDribbble() {
  const browser = await chromium.launch({ headless: false }); // Run in headless mode for scraping
  const page = await browser.newPage();
  
  // Step 1: Navigate to Dribbble login page
  await page.goto('https://dribbble.com/session/new');
  console.log('Navigated to Dribbble login page.');
  
  // Step 2: Wait for the login form to load
  await page.waitForSelector('input[name="login"]'); // This waits for the "Username or Email" field to appear
  console.log('Login form loaded.');
  
  // Step 3: Fill in login credentials
  await page.fill('input[name="login"]', 'ix.ankit9012@gmail.com'); // Replace with your email
  await page.fill('input[name="password"]', 'Test@123'); // Replace with your password
  console.log('Credentials filled.');
  
  // Step 4: Submit the login form
  await page.click('input[type="submit"]'); // Modify if necessary, this assumes the submit button
  console.log('Login form submitted.');
  
  // Step 5: Wait for successful login (We assume profile link or logged-in user element)
  await page.waitForSelector('a[href="/ankit9012"]'); // This waits for a logged-in user link
  console.log('Logged in successfully.');
  
  // Step 6: Scrape data (After login)
  await scrapeDribbble(browser,page);
  
  // Step 7: Close the browser after scraping
  await browser.close();
}

// Start login and scraping
loginToDribbble()
  .then(() => console.log('Scraping completed!'))
  .catch(err => console.error('Error during scraping:', err));
