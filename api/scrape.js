import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Please provide a ?url= parameter' });
  }

  let browser = null;

  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();

    // 1. Go to URL and wait for content to load
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // 2. Extract ONLY text and links using page.evaluate
    const data = await page.evaluate(() => {
      // Get all visible text (innerText ignores <script> and hidden styles)
      const textContent = document.body.innerText;

      // Get all links from <a> tags
      const linkArray = Array.from(document.querySelectorAll('a'))
        .map(a => a.href) // Get the href attribute
        .filter(href => href && href.startsWith('http')); // Filter out empty or dead links

      // Return clean object
      return {
        text: textContent,
        links: linkArray
      };
    });

    // 3. Return the data as JSON
    res.status(200).json(data);

  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
