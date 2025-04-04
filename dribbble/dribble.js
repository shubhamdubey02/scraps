const puppeteer = require("puppeteer");
const fs = require("fs");

(async () => {
  const browser = await puppeteer.launch({ headless: true }); // Set to true for production
  const page = await browser.newPage();

  // Navigate to Dribbble's Available for Work section
  await page.goto("https://dribbble.com/designers?search[keywords]=designers&search[available_for_work]=true", {
    waitUntil: "networkidle2",
  });

  // Extract designer details
  const designers = await page.evaluate(() => {
    const profiles = [];
    const profileElements = document.querySelectorAll(".resume-user-card");

    profileElements.forEach((profile) => {
      const name = profile.getAttribute("data-display-name") || "N/A";
      const username = profile.getAttribute("data-username") || "N/A";
      const profileUrl = `https://dribbble.com${profile.getAttribute("data-profile-path")}`;
      const avatar = profile.querySelector("drb-avatar img")?.src || "N/A";

      // Extract skills
      const skillsEl = profile.querySelector(".user-skills");
      const skills = skillsEl 
        ? Array.from(skillsEl.querySelectorAll("button[data-skills-item]")).map(skill => skill.innerText.trim()) 
        : [];

      // Extract subheading details (price, location, response time)
      const subheadingItems = profile.querySelectorAll(".user-card-profile__subheading-item");
      let price = "N/A",
        location = "N/A",
        responseTime = "N/A";

      subheadingItems.forEach((item) => {
        if (item.innerText.includes("From")) price = item.innerText.trim();
        if (item.innerText.includes("City")) location = item.innerText.trim();
        if (item.innerText.includes("Responds")) responseTime = item.innerText.trim();
      });

      // Extract services available
      const servicesEl = profile.querySelector(".user-card-profile__subheading-link");
      const servicesAvailable = servicesEl ? servicesEl.innerText.trim().split(" ")[0] : "0";

      // Extract Followers, Following, and Likes
      const stats = profile.querySelectorAll(".user-card-profile__stats-item");
      const followers = stats.length > 0 ? stats[0].innerText.replace(" Followers", "") : "0";
      const following = stats.length > 1 ? stats[1].innerText.replace(" Following", "") : "0";
      const likes = stats.length > 2 ? stats[2].innerText.replace(" Likes", "") : "0";

      // Check if user is available for work
      const availableForWork = profile.querySelector(".resume-user-card__work-availability") !== null;

      // Check if user has Pro status
      const isPro = profile.querySelector(".dribbble-pro-badge") !== null;

      profiles.push({
        name,
        username,
        profileUrl,
        avatar,
        skills,
        price,
        location,
        responseTime,
        servicesAvailable,
        followers,
        following,
        likes,
        availableForWork,
        isPro,
      });
    });

    return profiles;
  });

  // Save data to a JSON file
  fs.writeFileSync("designers.json", JSON.stringify(designers, null, 2));

  console.log("Data saved to designers.json");

  await browser.close();
})();
