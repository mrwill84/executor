
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
function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

fastify.post('/google', async (request, reply) => {
    const item = request.body.item.replaceAll('"',"")
    const url = `https://www.google.com/search?q=${item}&gl=us`
    const top = request.body.top
    const googleContent = await test(url , async function (page) {

        async function scrollMoreRandomly( ) {
        for (let i = 0; i < request.body.pages; i++) {
          // Scrolling randomly within the viewport
            await page.evaluate(() => {
                const scrollHeight = document.body.scrollHeight;
                const randomScroll = Math.floor(Math.random() * scrollHeight);
                window.scrollTo(0, randomScroll);
            });
            await page.waitForTimeout(1000); // Adjust timeout as needed
            }
        }
        await scrollMoreRandomly()
        let books_results = [];
        books_results = await page.evaluate(() => {
            return Array.from(document.querySelectorAll(".tF2Cxc")).map((el) => {
                return {
                    title: el.querySelector(".DKV0Md")?.textContent,
                    link: el.querySelector(".yuRUbf a")?.getAttribute('href'),
                    description: el.querySelector(".lEBKkf")?.textContent,
                }
            })
        });
        return books_results
    })
    const res = googleContent.slice(0,top) 
    reply.send(res)
})

async function test(url,callback ){
    const url2 = url.replaceAll('"',"")
    try {
        if ( globalBrowser && globalPage) { 
             
            console.log('globalPage will goto',url2 )
            await globalPage.goto(url2, {
                waitUntil: 'networkidle2'
            })
           
            const html = await globalPage.content();
            let ret = null 
            if(callback) ret =  await callback( globalPage )
            console.log('result',ret)
            return ret?ret:html
        }
    }catch(e ){
        console.log('no result',e )
    }
}

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


const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.75 Safari/537.36';

async function createPage (url) {
    const userAgent = randomUseragent.getRandom();
    const UA = userAgent || USER_AGENT;
    const page = await browser.newPage();
    await page.setViewport({
        width: 1920 + Math.floor(Math.random() * 100),
        height: 3000 + Math.floor(Math.random() * 100),
        deviceScaleFactor: 1,
        hasTouch: false,
        isLandscape: false,
        isMobile: false,
    });
    await page.setUserAgent(UA);
    await page.setJavaScriptEnabled(true);
    await page.setDefaultNavigationTimeout(0);
    if (true) {
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if(req.resourceType() == 'stylesheet' || req.resourceType() == 'font' || req.resourceType() == 'image'){
                req.abort();
            } else {
                req.continue();
            }
        });
    }

    await page.evaluateOnNewDocument(() => {
        //pass webdriver check
        Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
        });
    });

    await page.evaluateOnNewDocument(() => {
        //pass chrome check
        window.chrome = {
            runtime: {},
            // etc.
        };
    });

    await page.evaluateOnNewDocument(() => {
        //pass plugins check
        const originalQuery = window.navigator.permissions.query;
        return window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
        );
    });

    await page.evaluateOnNewDocument(() => {
        // Overwrite the `plugins` property to use a custom getter.
        Object.defineProperty(navigator, 'plugins', {
            // This just needs to have `length > 0` for the current test,
            // but we could mock the plugins too if necessary.
            get: () => [1, 2, 3, 4, 5],
        });
    });

    await page.evaluateOnNewDocument(() => {
        // Overwrite the `plugins` property to use a custom getter.
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en'],
        });
    });

    await page.goto(url, { waitUntil: 'networkidle2',timeout: 0 } );
    return page;
}

fastify.post('/ssr', async (request, reply) => {
    console.log( 'request.body.url',request.body.url)
    const { html } = await ssr(request.body.url);
    fs.writeFileSync( 
       '/usr/cache/'+ getFileNameFromUrl(request.body.url), html
    )
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
        await fastify.listen({ port: 4000, host: '0.0.0.0' })
    } catch (err) {
        fastify.log.error(err)
        await globalPage.close()
        await globalBrowser.close()
        process.exit(1)
    }
}


start()