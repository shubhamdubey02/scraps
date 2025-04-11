const puppeteer = require('puppeteer');

async function scrapeBehanceDesignerProfile(url,browser) {
  // const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // await page.setUserAgent(
  //   "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
  // );

  console.log(`Navigating to ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

  await page.waitForSelector('.ProfileCard-userFullName-ule', { visible: true });

  const profileData = await page.evaluate(() => {
    const getText = (selector) => document.querySelector(selector)?.innerText.trim() || 'Not available';
    const getHref = (selector) => document.querySelector(selector)?.href || 'Not available';
    const getList = (selector) => Array.from(document.querySelectorAll(selector)).map(el => el.innerText.trim());
    const getLinks = (selector) => Array.from(document.querySelectorAll(selector)).map(link => ({
      label: link.innerText.trim(),
      url: link.href
    }));

    const emailMatch = document.body.innerText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const extractedEmail = emailMatch ? emailMatch[0] : 'Not available';

    const statsElements = Array.from(document.querySelectorAll('.UserInfo-statColumn-NsR'));
    const statsText = statsElements.map(el => el.innerText.trim());

    let followers = 'Not available', following = 'Not available', views = 'Not available', appreciations = 'Not available';
    statsText.forEach(text => {
      if (text.toLowerCase().includes('followers')) followers = text;
      if (text.toLowerCase().includes('following')) following = text;
      if (text.toLowerCase().includes('views')) views = text;
      if (text.toLowerCase().includes('appreciations')) appreciations = text;
    });

    return {
      profileBanner: getHref('.ProfileBanner-bannerImage-IGC a'),
      profile: window.location.href,
      name: getText('.ProfileCard-userFullName-ule a'),
      location: getText('.ProfileDetails-userLocation-ocs a'),
      email: extractedEmail,
      infoBlock: getText('.UserInfo-infoBlockRow-jf1'),
      profileData: getText('.ProfileDetails a'),
      follow: getText('.ProfileCard-userInteractions-cN2 a'),
      message: getText('.ProfileCard-messageButton-pA1 a'),
      hirePelin: getHref('.AvailabilityInfoCard-container-NXT a'),
      socialLinks: getLinks('.UserInfo-infoBlockRow a'),
      links: getLinks('.UserInfo-infoBlockRow a'),
      stats: {
        followers: followers,
        following: following,
        projectsViews: views,
        appreciations: appreciations
      },
      additionalInfo: {}
    };
  });


  console.log(`✅ Profile data saved to ${profileData}`);
  return profileData;
}

// Example: Run the scraper for one profile
module.exports =
  { scrapeBehanceDesignerProfile }
