const puppeteer = require("puppeteer");
const useProxy = require('puppeteer-page-proxy');




(async () => {
  const browser = await puppeteer.launch({
    bindAddress: "0.0.0.0",
    args: [
      "--headless",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--remote-debugging-port=9222",
      "--remote-debugging-address=0.0.0.0"
    ]
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3419.0 Safari/537.36');
  page.on('request', async request => {
    //await useProxy(request, 'http://127.0.0.1:1235');
  });
  try {
    await page.goto("https://www.amz123.com/thread-992819.html", {
      waitUntil: "load"
    });
  } catch (error) {
    // ignore
  }
  await page.pdf({
    path: "src/devfest.pdf",
    printBackground: true,
    format: "A4"
  });

  await browser.close();
})();
