
const fastify = require('fastify')({
    logger: {
        level: 'info',
        transport: {
            target: 'pino-pretty',
            options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
            },
        },
        file: 'log.txt'
    },
    requestTimeout: 60000
})
const puppeteer = require("puppeteer");
const { createRunner, parse, PuppeteerRunnerExtension } = require('@puppeteer/replay');
const fs = require('fs');


async function openPage(url) {

    const page = await browser.newPage();

    await page.goto(url, {
        waitUntil: "networkidle2"
    });
    return page;
}
//'div > .card-body'
async function closePage() {
    await browser.close();
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}


var browser;
var page;
var goolgepage;
 

async function setWindowSize(page, width, height) {

    const session = await page.target().createCDPSession();
    const { windowId } = await session.send('Browser.getWindowForTarget');
    await session.send('Browser.setWindowBounds', { windowId, bounds: { width: width, height: height } });
    await session.detach();

}
fastify.post('/google', async (request, reply) => {
    if (goolgepage) {
        goolgepage.close()
    }
    const url = `https://www.google.com/search?q=${request.body.item}&gl=us`
    goolgepage = await openPage(url)
    let books_results = [];

    await goolgepage.screenshot({ path: "./src/yahoo_jp.png" });
    books_results = await goolgepage.evaluate(() => {
        return Array.from(document.querySelectorAll(".MjjYud")).map((el) => {
            return {
                title: el.querySelector(".DKV0Md")?.textContent,
                link: el.querySelector(".yuRUbf a")?.getAttribute('href'),
                description: el.querySelector(".lEBKkf")?.textContent,
            }
        })
    });

    reply.send({ 'context': books_results })
})

async function ssr(url) {
    console.info('rendering the page in ssr mode', url);

    try {
        const page = await openPage(url)
        const html = await page.content();
        await page.close();
        return { html };
        // await page.goto(url, { waitUntil: 'networkidle2' });
    } catch (err) {
        console.error(err);
        throw new Error('page.goto/waitForSelector timed out.' + url);
    }
}

fastify.get('/ssr', async (request, reply) => {
    console.log('request.query', request.query)
    const { html } = await ssr(request.query.url);
    reply.header('Content-Type', 'text/html; charset=utf-8')
    reply.send(html)
});


async function screenshot(url) {
    console.info('rendering the page in ssr mode', url);

    try {
        savepath = url.replaceAll('/','').replaceAll(':','')
        const page = await openPage(url)
        await page.setViewport({ width: 1920, height: 1080 });
        await page.screenshot({path: `./src/${savepath}.png`})
        await page.close();
        //return { html };
        // await page.goto(url, { waitUntil: 'networkidle2' });
    } catch (err) {
        console.error(err);
        throw new Error('page.goto/waitForSelector timed out.' + url);
    }
}


fastify.get('/screenshot', async (request, reply) => {
    console.log('request.query', request.query)
    savepath = request.query.url.replaceAll('/','').replaceAll(':','')
    await screenshot(request.query.url);
    const buffer = fs.readFileSync(`./src/${savepath}.png`)
    reply.type('image/png') // if you don't set the content, the image would be downloaded by browser instead of viewed
    reply.send(buffer)
});
fastify.get('/', async (request, reply) => {
    reply.code(200).send('ok')
})

fastify.post('/page', async (request, reply) => {
    console.log('request.body.url', request.body.url)
    page = await openPage(request.body.url)
    const context = await testElement(page, request.body.selector)
    reply.send({ 'context': context })
})

const start = async () => {
    try {
        browser = await puppeteer.launch({
            bindAddress: "0.0.0.0",
            args: [
                "--headless",
                "--disable-gpu",
                "--disable-dev-shm-usage",
                "--remote-debugging-port=9222",
                "--remote-debugging-address=0.0.0.0",
                '--window-size=1920,1080',
            ]
        });
        await fastify.listen({ port: 4000, host: '0.0.0.0' })
    } catch (err) {
        fastify.log.error(err)
        closePage()
        process.exit(1)
    }
}
start()