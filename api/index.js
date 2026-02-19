import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).send('Please provide a ?url= parameter');
  }

  let browser = null;

  try {
    // 1. Launch the browser
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    // 2. Open a new page
    const page = await browser.newPage();

    // 3. Go to the URL and wait for the network to be idle (scripts loaded)
    // We set a timeout of 8 seconds to prevent Vercel crashing
    await page.goto(url, { 
      waitUntil: 'networkidle0', 
      timeout: 8000 
    });

    // 4. Get the real rendered HTML
    const html = await page.content();

    // 5. Send it back
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);

  } catch (error) {
    // If it fails, send the error message
    res.status(500).send('Error rendering page: ' + error.message);
  } finally {
    // Always close the browser to save memory
    if (browser) {
      await browser.close();
    }
  }
}
