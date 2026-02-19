import chromium from '@sparticuz/chromium-min';
import puppeteer from 'puppeteer-core';

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) return res.status(400).send('URL required');

  let browser = null;

  try {
    // 1. Configure the browser path (Remote Download)
    // We use v119 which is stable on Node 18
    chromium.setGraphicsMode = false;
    const executablePath = await chromium.executablePath(
      "https://github.com/Sparticuz/chromium/releases/download/v119.0.2/chromium-v119.0.2-pack.tar"
    );

    // 2. Launch
    browser = await puppeteer.launch({
      args: [...chromium.args, "--hide-scrollbars", "--disable-web-security"],
      defaultViewport: chromium.defaultViewport,
      executablePath: executablePath,
      headless: "new", // Required for new puppeteer versions
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();

    // 3. Navigate
    // We block images/fonts to make it faster and use less memory
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
            req.abort();
        } else {
            req.continue();
        }
    });

    await page.goto(url, { 
        waitUntil: 'domcontentloaded', 
        timeout: 7000 
    });

    const html = await page.content();

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);

  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error: ' + error.message);
  } finally {
    if (browser) await browser.close();
  }
}
