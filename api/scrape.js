import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) return res.status(400).json({ error: 'Please provide a ?url= parameter' });

  let browser = null;

  try {
    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--disable-blink-features=AutomationControlled',
        '--hide-scrollbars',
        '--no-sandbox'
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();

    // 1. Set User Agent to appear as a standard Desktop User
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');

    // 2. Load page and wait slightly longer for the "Real" content behind the popup
    // We wait for 'networkidle2' which means the site has finished loading mostly everything
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });

    // 3. THE MAGIC: Run this script INSIDE the page to kill popups and get clean text
    const cleanData = await page.evaluate(() => {
      
      // A. HELPER: Function to remove junk elements
      const removeSelectors = (selectors) => {
        document.querySelectorAll(selectors).forEach(el => el.remove());
      };

      // B. REMOVE KNOWN JUNK (Cookie banners, Ads, Navbars)
      // This list targets the specific classes used by Spotify, Google, etc.
      removeSelectors([
        'script', 'style', 'noscript', 'iframe', 'svg', 
        'nav', 'footer', 'header', 
        '#onetrust-banner-sdk', // Common Cookie Banner
        '.onetrust-pc-dark-filter',
        '#cookie-banner',
        '[class*="cookie"]',    // Deletes anything with "cookie" in the class name
        '[class*="consent"]',   // Deletes anything with "consent" in the class name
        '[class*="popup"]',
        '[class*="modal"]',
        '[aria-modal="true"]',  // Accessibility modals
        '.ad', '.ads'
      ]);

      // C. Try to find the "Main" content container
      // If <main> exists, we prefer that. If not, we use body.
      let contentNode = document.querySelector('main') || document.querySelector('article') || document.body;

      // D. Convert to Markdown-style Text
      function getText(node) {
        let text = "";
        node.childNodes.forEach(child => {
          // Get Text Nodes
          if (child.nodeType === 3) {
            text += child.textContent;
          } 
          // Get Elements (and recurse)
          else if (child.nodeType === 1) {
            // Ignore hidden elements
            const style = window.getComputedStyle(child);
            if (style.display === 'none' || style.visibility === 'hidden') return;

            const tag = child.tagName.toLowerCase();
            const childText = getText(child);
            
            if (!childText.trim()) return;

            // Simple Formatting
            if (['h1', 'h2', 'h3'].includes(tag)) text += `\n\n# ${childText}\n\n`;
            else if (tag === 'p') text += `\n${childText}\n`;
            else if (tag === 'br') text += `\n`;
            else if (tag === 'li') text += `\n - ${childText}`;
            else if (tag === 'a') {
               const href = child.getAttribute('href');
               if (href && href.startsWith('http')) text += ` [${childText}](${href}) `;
               else text += ` ${childText} `;
            }
            else text += childText;
          }
        });
        return text;
      }

      // Clean up multiple newlines
      return getText(contentNode).replace(/\n\s+\n/g, '\n\n').trim();
    });

    // 4. Return the Clean Data
    res.setHeader('Content-Type', 'text/plain'); // Return as plain text like Jina
    res.status(200).send(cleanData);

  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (browser) await browser.close();
  }
}
