const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeBehanceDesigners(url) {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
  );
  console.log(`Navigating to Behance URL: ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.Users-bannerWrapper-ERm', { visible: true });

  console.log('Scraping designer profiles...');
  const designers = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.UserSummaryInfo-ownerName-ZKs a'))
      .map(link => link.href);
  });

  console.log(`Found ${designers.length} designer profiles.`);
  let results = [];

  for (let profile of designers) {
    try {
      console.log(`Visiting profile: ${profile}`);
      await page.goto(profile, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('.ProfileCard-userFullName-ule', { visible: true });

      const designerData = await page.evaluate(() => {
        const getText = (selector) => document.querySelector(selector)?.innerText.trim() || 'Not available';
        const getHref = (selector) => document.querySelector(selector)?.href || 'Not available';
        const getList = (selector) => Array.from(document.querySelectorAll(selector)).map(el => el.innerText.trim());

        // Extract email from inner text using regex
        const emailMatch = document.body.innerText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        const extractedEmail = emailMatch ? emailMatch[0] : 'Not Available';

        return {
          name: getText('.ProfileCard-userFullName-ule'),
          location: getText('.ProfileDetails-userLocation-ocs '),
          profileUrl: window.location.href,
          badge:getText('.CreatorProBadge-pill-lJL'),
          bio: getText('.UserInfo-bio-OZA'),
          email: extractedEmail,
          website: getHref('.ProfileDetails-ownerWebsite-NXm a'),
          socialLinks: Array.from(document.querySelectorAll('.VerifiedSocial-verifiedSocialContainer-nLV a')).map(link => ({
            label: link.innerText.trim(),
            url: link.href
          })),
          linksL: Array.from(document.querySelectorAll('.WebReference-webReferenceWrapper-kbN')).map(link => ({
            label: link.innerText.trim(),
            url: link.href
          }))
          ,

          stats: {
            followers: getText('.UserInfo-statColumn-NsR UserInfo-statValue-d3q'),
            appreciations: getText('.UserInfo-statValue-d3q UserInfo-disabledLink-gtI'),
            views: getText('.UserInfo-statColumn-NsR UserInfo-statValue-d3q')
          },
          fetured:getText('.Badge-text-kub.FeaturedBadge-featuredBadgeText-_ZX'),
          projectsCompleted: getText('.ReviewsCountLabel-truncateBadgeText-ARa'),
          skills: getList('.UserInfo-statColumn-NsR UserInfo-statValue-d3q'),          
          projects: getList('.UserInfo-statColumn-NsR')
        };
      });

      console.log('Extracted:', designerData);
      results.push(designerData);
    } catch (error) {
      console.error(`Error scraping profile ${profile}:`, error);
    }
  }

  // Save data to a JSON file
  const filePath = 'behance_designers.json';
  fs.writeFileSync(filePath, JSON.stringify(results, null, 2));
  console.log(`Scraping complete. Data saved to ${filePath}`);

  await browser.close();
}

// Example URL (search for designers on Behance)
scrapeBehanceDesigners('https://www.behance.net/search/users/designer?search=designer');
