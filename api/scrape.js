import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) return res.status(400).json({ error: 'Please provide a ?url= parameter' });

  let browser = null;

  try {
    // 1. Setup Browser
    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--disable-blink-features=AutomationControlled', // Hides "Chrome is being controlled by automation software"
        '--hide-scrollbars',
        '--no-sandbox'
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();

    // 2. SPEED HACK: Block images, fonts, and css to load fast
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // 3. STEALTH HACK: Delete the 'webdriver' property
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    // 4. Set User Agent (Real Chrome on Windows)
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');

    // 5. Go to page (Wait until network is almost idle)
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 9000 });

    // 6. "Jina-Style" Extraction (Run inside the page)
    const markdown = await page.evaluate(() => {
      // A. Remove junk elements
      const junk = document.querySelectorAll('script, style, noscript, iframe, svg, header, footer, nav, aside, .ad, .ads, .popup');
      junk.forEach(el => el.remove());

      // B. Helper function to process nodes
      function convertToMarkdown(node) {
        let text = "";
        
        node.childNodes.forEach(child => {
          if (child.nodeType === 3) { // Text node
            text += child.textContent;
          } else if (child.nodeType === 1) { // Element node
            const tag = child.tagName.toLowerCase();
            const childText = convertToMarkdown(child); // Recursion
            
            if (!childText.trim()) return;

            switch (tag) {
              case 'h1': text += `\n\n# ${childText}\n\n`; break;
              case 'h2': text += `\n\n## ${childText}\n\n`; break;
              case 'h3': text += `\n\n### ${childText}\n\n`; break;
              case 'p':  text += `\n${childText}\n`; break;
              case 'br': text += `\n`; break;
              case 'a':  
                const href = child.getAttribute('href');
                if(href && href.startsWith('http')) text += ` [${childText}](${href}) `;
                else text += ` ${childText} `;
                break;
              case 'li': text += `\n - ${childText}`; break;
              case 'b': 
              case 'strong': text += ` **${childText}** `; break;
              default: text += childText;
            }
          }
        });
        return text;
      }

      // Start conversion from body
      let rawMarkdown = convertToMarkdown(document.body);
      
      // Clean up extra whitespace
      return rawMarkdown.replace(/\n\s+\n/g, '\n\n').trim();
    });

    // 7. Return the Markdown text
    res.status(200).send(markdown);

  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (browser) await browser.close();
  }
}
