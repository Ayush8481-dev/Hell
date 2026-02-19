const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

export default async function handler(req, res) {
  // 1. Get the URL from the query parameter
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Please provide a ?url= parameter' });
  }

  let browser = null;

  try {
    // 2. Launch the browser (Vercel compatible setup)
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    // 3. Open a new page
    const page = await browser.newPage();

    // 4. Go to the target website and wait for network to be idle (JS finished)
    await page.goto(url, { waitUntil: 'networkidle0' });

    // 5. Get the rendered HTML
    const html = await page.content();

    // 6. Return the HTML as text
    res.status(200).send(html);

  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
