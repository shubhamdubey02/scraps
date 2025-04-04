const puppeteer = require('puppeteer');
const fs = require('fs');
const { promisify } = require('util');
const writeFileAsync = promisify(fs.writeFile);

// Configuration
const config = {
    credentials: {
        email: "shubham.dubey@oodles.io",
        password: "AbNbSDPL5ZAW6aV&1"
    },
    search: {
        keyword: "Accenture",
        filters: {
            currentCompany: true,
            connectionLevel: "1st", // "1st", "2nd", or "3rd+"
            location: "India" // Optional location filter
        },
        scrollCount: 8, // Increased for more results
        scrollDelay: 4000,
        maxResults: 200
    },
    viewport: {
        width: 1366,
        height: 768
    },
    outputFile: "accenture_profiles.json",
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

// Helper function for delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Enhanced logging with colors
const log = {
    info: (msg) => console.log('\x1b[36m%s\x1b[0m', `🔹 ${msg}`), // Cyan
    success: (msg) => console.log('\x1b[32m%s\x1b[0m', `✅ ${msg}`), // Green
    error: (msg) => console.log('\x1b[31m%s\x1b[0m', `❌ ${msg}`), // Red
    debug: (msg) => console.log('\x1b[35m%s\x1b[0m', `🐛 ${msg}`) // Magenta
};

(async () => {
    let browser;
    try {
        log.info("Step 1: Launching Browser...");
        browser = await puppeteer.launch({ 
            headless: false, // Set to true after testing
            args: [
                "--start-maximized",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage"
            ],
            defaultViewport: null
        });
        
        const page = await browser.newPage();
        await page.setUserAgent(config.userAgent);
        await page.setDefaultNavigationTimeout(60000);

        log.info("Step 2: Opening LinkedIn Login Page...");
        await page.goto("https://www.linkedin.com/login", { 
            waitUntil: "networkidle2"
        });

        log.info("Step 3: Entering Email & Password...");
        try {
            await page.waitForSelector('input[id="username"]', { 
                visible: true, 
                timeout: 20000 
            });
            
            await page.type('input[id="username"]', config.credentials.email, { 
                delay: 30 + Math.random() * 70 
            });
            await delay(800 + Math.random() * 1000);
            await page.type('input[id="password"]', config.credentials.password, { 
                delay: 30 + Math.random() * 70 
            });

            log.info("Step 4: Clicking Sign In...");
            await Promise.all([
                page.waitForNavigation({ waitUntil: "networkidle2" }),
                page.click('button[type="submit"]')
            ]);

            log.success("Successfully Logged In!");
        } catch (error) {
            log.error(`Login failed! ${error.message}`);
            throw error;
        }

        // Check for CAPTCHA or verification
        if (await page.$('div[role="dialog"], #captcha-challenge') !== null) {
            log.error("CAPTCHA detected! Manual intervention required.");
            await page.screenshot({ path: 'captcha_screenshot.png', fullPage: true });
            log.info("Full page screenshot saved as 'captcha_screenshot.png'");
            throw new Error("CAPTCHA encountered");
        }

        log.info("Step 5: Building Search URL with Filters...");
        let searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(config.search.keyword)}`;
        
        // Add filters to URL
        if (config.search.filters.currentCompany) {
            searchUrl += `&currentCompany=${encodeURIComponent(config.search.keyword)}`;
        }
        if (config.search.filters.connectionLevel) {
            searchUrl += `&network=${encodeURIComponent(config.search.filters.connectionLevel)}`;
        }
        if (config.search.filters.location) {
            searchUrl += `&geoUrn=${encodeURIComponent(`[${getLocationId(config.search.filters.location)}]`)}`;
        }
        
        searchUrl += "&origin=FACETED_SEARCH";
        log.debug(`Search URL: ${searchUrl}`);

        log.info("Step 6: Searching for Accenture Profiles...");
        await page.goto(searchUrl, { 
            waitUntil: "networkidle2",
            timeout: 90000 
        });

        log.info("Step 7: Applying Additional Filters...");
        await applyAdditionalFilters(page);

        log.info("Step 8: Scrolling to Load More Profiles...");
        await autoScroll(page, config.search.scrollCount, config.search.scrollDelay);

        log.info("Step 9: Extracting Profile Data...");
        const profiles = await extractProfiles(page);

        if (profiles.length === 0) {
            log.error("No profiles found! Trying alternative selectors...");
            const alternativeProfiles = await tryAlternativeSelectors(page);
            
            if (alternativeProfiles.length === 0) {
                log.error("Still no profiles found with alternative selectors.");
                await saveDebugInfo(page);
            } else {
                log.success(`Found ${alternativeProfiles.length} profiles using alternative selectors!`);
                await saveResults(alternativeProfiles);
            }
        } else {
            log.success(`Successfully collected ${profiles.length} profiles!`);
            await saveResults(profiles);
        }

    } catch (error) {
        log.error(`Script failed: ${error.message}`);
    } finally {
        if (browser) {
            await browser.close();
            log.info("Browser Closed.");
        }
    }
})();

// Helper functions

async function autoScroll(page, scrollCount, scrollDelay) {
    let previousHeight = 0;
    for (let i = 0; i < scrollCount; i++) {
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
        });
        await delay(scrollDelay);
        
        // Random human-like delay
        await delay(1500 + Math.random() * 2500);
        
        const newHeight = await page.evaluate(() => document.body.scrollHeight);
        if (newHeight === previousHeight) {
            log.debug("Reached end of page, stopping scrolling");
            break;
        }
        previousHeight = newHeight;
    }
}

async function applyAdditionalFilters(page) {
    try {
        // Wait for filters to load
        await delay(3000);
        
        // Example: Select "People" tab if not already selected
        const peopleTab = await page.$('button[aria-label="People"]');
        if (peopleTab) {
            await peopleTab.click();
            await delay(2000);
        }
        
        // Add more filter logic here as needed
    } catch (error) {
        log.debug(`Couldn't apply additional filters: ${error.message}`);
    }
}

async function extractProfiles(page) {
    return await page.evaluate(() => {
        // Multiple selector patterns to find profile cards
        const selectors = [
            ".entity-result", 
            ".reusable-search__result-container",
            ".search-result",
            "li.search-results__result-item"
        ];
        
        let profileElements = [];
        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                profileElements = Array.from(elements);
                break;
            }
        }
        
        return profileElements.map(el => {
            // Try multiple selector patterns for each field
            const nameElement = el.querySelector(
                ".entity-result__title-text a, " +
                ".app-aware-link span[aria-hidden=true], " +
                ".actor-name"
            );
            
            const titleElement = el.querySelector(
                ".entity-result__primary-subtitle, " +
                ".subline-level-1, " +
                ".search-result__snippets"
            );
            
            const locationElement = el.querySelector(
                ".entity-result__secondary-subtitle, " +
                ".subline-level-2, " +
                ".search-result__location"
            );
            
            const connectionElement = el.querySelector(
                ".entity-result__badge, " +
                ".search-result__connection-badge"
            );
            
            return {
                name: nameElement?.innerText.trim() || "N/A",
                profile_url: nameElement?.closest('a')?.href.split('?')[0] || "N/A",
                position: titleElement?.innerText.trim().replace(/\n/g, ' ') || "N/A",
                location: locationElement?.innerText.trim().replace(/\n/g, ' ') || "N/A",
                connection: connectionElement?.innerText.trim() || "N/A",
                scrapedAt: new Date().toISOString()
            };
        });
    });
}

async function tryAlternativeSelectors(page) {
    return await page.evaluate(() => {
        // Alternative approach - look for profile links directly
        const profileLinks = document.querySelectorAll(
            'a.app-aware-link[href^="/in/"], ' +
            'a.search-result__result-link[href^="/in/"]'
        );
        
        return Array.from(profileLinks).map(link => {
            const card = link.closest('.entity-result, .search-result, .reusable-search__result-container') || 
                        link.closest('li');
            
            return {
                name: link.querySelector('span')?.innerText.trim() || "N/A",
                profile_url: link.href.split('?')[0] || "N/A",
                position: card?.querySelector('.subline-level-1, .entity-result__primary-subtitle')?.innerText.trim() || "N/A",
                location: card?.querySelector('.subline-level-2, .entity-result__secondary-subtitle')?.innerText.trim() || "N/A",
                connection: card?.querySelector('.entity-result__badge')?.innerText.trim() || "N/A",
                scrapedAt: new Date().toISOString()
            };
        });
    });
}

async function saveDebugInfo(page) {
    await page.screenshot({ 
        path: 'debug_screenshot.png', 
        fullPage: true 
    });
    log.info("Full page screenshot saved as 'debug_screenshot.png'");
    
    const html = await page.content();
    fs.writeFileSync('page_content.html', html);
    log.info("Page HTML saved as 'page_content.html'");
    
    const cookies = await page.cookies();
    fs.writeFileSync('cookies.json', JSON.stringify(cookies, null, 2));
    log.info("Cookies saved as 'cookies.json'");
}

async function saveResults(profiles) {
    const jsonData = {
        metadata: {
            dateScraped: new Date().toISOString(),
            searchTerm: config.search.keyword,
            filters: config.search.filters,
            totalResults: profiles.length,
            source: "LinkedIn",
            version: "1.1"
        },
        profiles: profiles.slice(0, config.search.maxResults)
    };
    
    await writeFileAsync(config.outputFile, JSON.stringify(jsonData, null, 2));
    log.success(`Data saved to ${config.outputFile} successfully!`);
    
    // Print sample to console
    console.log("\n\x1b[33mSample Results:\x1b[0m"); // Yellow header
    jsonData.profiles.slice(0, 5).forEach((profile, i) => {
        console.log(`\x1b[1m${i+1}. ${profile.name}\x1b[0m`); // Bold name
        console.log(`   \x1b[34m${profile.position}\x1b[0m`); // Blue position
        console.log(`   \x1b[90m${profile.location}\x1b[0m`); // Gray location
        console.log(`   \x1b[36m${profile.profile_url}\x1b[0m\n`); // Cyan URL
    });
    
    if (profiles.length > 5) {
        console.log(`\x1b[90m...and ${profiles.length - 5} more profiles\x1b[0m\n`);
    }
}

function getLocationId(location) {
    // Simplified location mapping - you may need to expand this
    const locations = {
        "India": "102713980",
        "United States": "103644278",
        "United Kingdom": "101165590",
        "Canada": "101174742",
        "Australia": "101452733"
    };
    return locations[location] || "";
}