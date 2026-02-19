import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) return res.status(400).send('URL required');

  let browser = null;

  try {
    // REQUIRED: Tell chromium where fonts/graphics are
    await chromium.font('https://raw.githack.com/googlei18n/noto-emoji/master/fonts/NotoColorEmoji.ttf');

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    
    // Set a fake user agent so websites don't block us immediately
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 6000 });

    const html = await page.content();

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);

  } catch (error) {
    res.status(500).send('Error: ' + error.message);
  } finally {
    if (browser) await browser.close();
  }
}
