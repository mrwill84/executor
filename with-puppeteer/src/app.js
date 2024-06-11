
import Fastify from 'fastify' 
import fs from 'fs'
import url from 'url'
const fastify = Fastify({
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

import { connect } from './index.js'
import { protectPage, protectedBrowser } from 'puppeteer-afp'
let  globalBrowser = null
let globalPage = null 
import { PuppeteerCrawler, Dataset } from 'crawlee';

// Define the crawler outside the request handler to reuse it if possible
const crawler = new PuppeteerCrawler({
    async requestHandler({ request, page }) {
        const { item, top, pages } = request.userData;
       // await page.goto(searchURL, { waitUntil: 'networkidle2' });
       // await scrollMoreRandomly(page, pages);

        const booksResults = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('.tF2Cxc')).map(el => ({
                title: el.querySelector('.DKV0Md')?.textContent,
                link: el.querySelector('.yuRUbf a')?.getAttribute('href'),
                description: el.querySelector('.lEBKkf')?.textContent,
            }));
        });
        // console.log('booksResults',booksResults )
        // Use Dataset to store the results temporarily
        await Dataset.pushData(booksResults.slice(0, top));
    },
    errorHandler({ error }) {
        console.log(`Error occurred during crawling: ${error.message}`);
    }
});

async function scrollMoreRandomly(page, pagesCount) {
    for (let i = 0; i < pagesCount; i++) {
        await page.evaluate(() => {
            const scrollHeight = document.body.scrollHeight;
            const randomScroll = Math.floor(Math.random() * scrollHeight);
            window.scrollTo(0, randomScroll);
        });
        await page.waitForTimeout(1000); // Adjust timeout as needed
    }
}

fastify.post('/google', async (request, reply) => {
    const { item, top, pages } = request.body;
    const encodedSearchTerm = encodeURIComponent(item);
    const searchURL = `https://www.google.com/search?q=${encodedSearchTerm}&gl=us`;
    await crawler.addRequests([ searchURL ]);

    // Start the crawler
    await crawler.run();

    // Retrieve the results from the Dataset
    let results = await Dataset.getData();
    let items = results.items
    // Clear the Dataset for the next request
    
    if (items && items.length > 0){
        items = items.slice(0,top)
    }
    reply.send( items );
});



async function ssr(url) {
    url = decodeURIComponent( url )
    try {
        const html = await test(url )
        return { html };
    } catch (err) {
        console.error(err);
        throw new Error('page.goto/waitForSelector timed out.' + url);
    }
}


function getFileNameFromUrl(fullUrl) {
    // Parse the full URL
    const parsedUrl = url.parse(fullUrl);

    // Extract domain and path
    const domain = parsedUrl.hostname;

    // Concatenate domain and file name
    const fullFileName = domain+'.html';

    return fullFileName;
}


fastify.post('/ssr', async (request, reply) => {
    //console.log( 'urlToRender',request.body.url)
    let urlToRender = decodeURIComponent(request.body.url);
    //console.log( 'urlToRender', urlToRender)
    const fileName = getFileNameFromUrl(urlToRender);
    urlToRender = urlToRender.replaceAll('"','')
    console.log( 'urlToRender',urlToRender)
    // Check if we already have this page saved
    const cachePath = `/usr/cache/${fileName}`;
    //if (fs.existsSync(cachePath)) {
    //    const cachedHtml = fs.readFileSync(cachePath, { encoding: 'utf8' });
    //    reply.header('Content-Type', 'text/html; charset=utf-8');
    //    return reply.send(cachedHtml);
    //}

    let pageContent = '';
    try {
        // Initialize crawler specific for SSR
        const ssrCrawler = new PuppeteerCrawler({
            async requestHandler({ page }) {
                // Here, unlike in the Google search example, there's no need for Dataset storage
                // as we are handling a single page content extraction.
                pageContent = await page.content();
                
            },
            errorHandler({ request, error }) {
                console.log(`Error crawling ${request.url}: ${error.message}`);
                throw error; // Re-throw the error for outer try..catch to handle
            },
        });

        // Add the URL to the crawler queue
        await ssrCrawler.addRequests([urlToRender]);

        // Start the SSR crawler. This will update pageContent with the rendered HTML.
        await ssrCrawler.run();

        // Save the rendered content to cache for future requests
        // fs.writeFileSync(cachePath, pageContent);
        // console.log('pageContent',pageContent )
        // Send the rendered page content back
        reply.header('Content-Type', 'text/html; charset=utf-8');
        reply.send(pageContent);
    } catch (err) {
        console.error(err);
        reply.status(500).send('Failed to render the page.');
    }
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


fastify.get('/linkedin', async (request, reply) => {
    
})

const start = async () => {
    try {
        const { page , browser } = await connect({
            headless: 'auto',
            args: [],
            customConfig: {
                dumpio: true, 
                ignoreHTTPSErrors: true, 
            },
            skipTarget: [],
            fingerprint: true,
            turnstile: true,
            connectOption: {},
            fpconfig:  {
                    canvasRgba: [0, 0, 0, 0], //all these numbers can be from -5 to 5
                    webglData: {
                        3379: 32768, //16384, 32768
                        3386: {
                            0: 32768, // 8192, 16384, 32768
                            1: 32768, // 8192, 16384, 32768
                        },
                        3410: 2, // 2, 4, 8, 16
                        3411: 2, // 2, 4, 8, 16
                        3412: 16, // 2, 4, 8, 16
                        3413: 2, // 2, 4, 8, 16
                        7938: "WebGL 1.0 (OpenGL Chromium)", // "WebGL 1.0", "WebGL 1.0 (OpenGL)", "WebGL 1.0 (OpenGL Chromium)"
                        33901: {
                            0: 1,
                            1: 1, // 1, 1024, 2048, 4096, 8192
                        },
                        33902: {
                            0: 1,
                            1: 8192, // 1, 1024, 2048, 4096, 8192
                        },
                        34024: 32768, //16384, 32768
                        34047: 8, // 2, 4, 8, 16
                        34076: 16384, //16384, 32768
                        34921: 16, // 2, 4, 8, 16
                        34930: 16, // 2, 4, 8, 16
                        35660: 2, // 2, 4, 8, 16
                        35661: 32, // 16, 32, 64, 128, 256
                        35724: "WebGL GLSL ES (OpenGL Chromium)", // "WebGL", "WebGL GLSL", "WebGL GLSL ES", "WebGL GLSL ES (OpenGL Chromium)"
                        36347: 4096, // 4096, 8192
                        36349: 8192, // 1024, 2048, 4096, 8192
                        37446: "HD Graphics", // "Graphics", "HD Graphics", "Intel(R) HD Graphics"
                    },
                    fontFingerprint: {
                        noise: 2, // -1, 0, 1, 2
                        sign: +1, // -1, +1
                    },
                    audioFingerprint: {
                        getChannelDataIndexRandom: Math.random(), // all values of Math.random() can be used
                        getChannelDataResultRandom: Math.random(), // all values of Math.random() can be used
                        createAnalyserIndexRandom: Math.random(), // all values of Math.random() can be used
                        createAnalyserResultRandom: Math.random(), // all values of Math.random() can be used
                    },
                    webRTCProtect: true //this option is used to disable or enable WebRTC disabling by destroying get user media
                }
        })
        globalBrowser = browser
        globalPage = page
        globalPage.on("request", (request) => {
            if (request.resourceType === "image") {
                return request.abort();
            } else {
                request.continue();
            }
        });
        await globalPage.setRequestInterception(true);
        globalPage.on('console', (msg)=>{
            console.log('console', msg)
        })
        await fastify.listen({ port: 4000, host: '0.0.0.0' })
    } catch (err) {
        fastify.log.error(err)
        await globalPage.close()
        await globalBrowser.close()
        process.exit(1)
    }
}


start()