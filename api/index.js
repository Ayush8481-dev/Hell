import chromium from '@sparticuz/chromium-min';
import puppeteer from 'puppeteer-core';

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) return res.status(400).send('URL required');

  let browser = null;

  try {
    // THIS URL IS THE KEY FIX:
    // We download the browser executable at runtime to bypass Vercel file limits
    const executablePath = await chromium.executablePath(
      "https://github.com/Sparticuz/chromium/releases/download/v123.0.1/chromium-v123.0.1-pack.tar"
    );

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: executablePath,
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();

    // Fake User Agent to look like a real Windows PC
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');

    // Wait 6 seconds max for the page to load
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 6000 });

    const html = await page.content();

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);

  } catch (error) {
    res.status(500).send('Error: ' + error.message);
  } finally {
    if (browser) await browser.close();
  }
}
