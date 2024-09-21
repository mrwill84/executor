
import Fastify from 'fastify'
import fs from 'fs'
import url from 'url'
import redis from 'redis';
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

let globalBrowser = null
let globalPage = null
import { PuppeteerCrawler, Dataset } from 'crawlee';
import _ from 'lodash';
// Define the crawler outside the request handler to reuse it if possible


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

fastify.post('/links', async (request, reply) => {
    try {
        const { website } = request.body;
        const client = redis.createClient({
            url:'redis://bandaai_redis:6379'
            // Default connection settings; specify port and host if needed
          });
        await client.connect();
        const results = []
        const cachedResultsLen = await client.hLen(`website:${website}`);
        if(cachedResultsLen > 0) {
            return reply.send('ok'); // Parse and return the cached results
        }
        
        //console.log('website',website )
        const crawler = new PuppeteerCrawler({
            maxConcurrency: 1,
            async requestHandler({ request, page, enqueueLinks, log }) {
                //const title = await page.title();
                const res = {
                    content: await page.content(),
                    title: await page.title(),
                    url: request.url,
                    succeeded: true,
                }
                await client.hSet(
                    `website:${website}`, `${res.url}`,
                        JSON.stringify(res)
                    );
                results.push(res)
                await enqueueLinks({
                    globs: [`${website}/**`],
                });
            },
        });
         
        
        await crawler.addRequests([`${website}`]);
        await crawler.run();
        reply.send('ok');
    } catch (e) {
        console.log(e)
    }
});
// Run the crawler with initial request



fastify.post('/google', async (request, reply) => {
    const { item, top, pages } = request.body;
    const encodedSearchTerm = encodeURIComponent(item);
    const searchURL = `https://www.google.com/search?q=${encodedSearchTerm}&gl=us`;
    console.log('searchURL', searchURL)
    let results = '';
    const crawler = new PuppeteerCrawler({
        //maxConcurrency: 1,
        async requestHandler({ request, page }) {

            const booksResults = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('.MjjYud')).map(el => ({
                    title: el.querySelector('.DKV0Md')?.textContent,
                    link: el.querySelector('.yuRUbf a')?.getAttribute('href'),
                    description: el.querySelector('.Hdw6tb')?.textContent,
                }));
            });
            results = booksResults.filter(book => book.link);

        },
        errorHandler({ error }) {
            console.log(`Error occurred during crawling: ${error.message}`);
        }
    });

    await crawler.addRequests([searchURL]);

    // Start the crawler
    await crawler.run();

    // Retrieve the results from the Dataset
    //let results = await Dataset.getData();
    let items = results.items
    // Clear the Dataset for the next request

    if (items && items.length > 0) {
        items = items.slice(0, top)
    }
    console.log('encodedSearchTerm2', JSON.stringify(items))
    reply.send(items);
});



async function ssr(url) {
    url = decodeURIComponent(url)
    try {
        const html = await test(url)
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
    const fullFileName = domain + '.html';

    return fullFileName;
}


fastify.post('/ssr-v2', async (request, reply) => {
    let urls = request.body.urls;
    let atleast = 1
    // Check if urls is not an array or is empty
    if (!Array.isArray(urls) || urls.length === 0) {
        return reply.status(400).send({ error: "Invalid input: urls must be a non-empty array." });
    }
    let results = []
    const ssrCrawler = new PuppeteerCrawler({
        maxConcurrency: 1,
        async requestHandler({ page, request }) {
            //pageContent = await page.content();
            results.push({
                content: await page.content(),
                title: await page.title(),
                url: request.url,
                succeeded: true,
            })
        },
        errorHandler({ request, error }) {
            console.log(`Error crawling ${request.url}: ${error.message}`);
            //throw error; // Re-throw the error for outer try..catch to handle
        },
    });

    if (typeof urls[0] === 'object') {
        // Expected to find objects with a link property
        let links = urls.map(obj => _.get(obj, 'link', null)).filter(link => link);

        if (links.length === 0) {
            return reply.status(400).send({ error: "No valid links found in objects." });
        }
        await ssrCrawler.addRequests(links);
    } else if (typeof urls[0] === 'string') {
        await ssrCrawler.addRequests(urls);
    } else {
        // In case of unexpected urls format
        reply.status(400).send({ error: "Invalid format of urls." });
    }
    await ssrCrawler.run();
    if (results.length >= atleast) {
        reply.send(results[0].content);
    } else {
        reply.status(400).send({ error: "No Enough Available " });
    }
    //reply.send(pageContent);
})

fastify.post('/ssr', async (request, reply) => {
    //console.log( 'urlToRender',request.body.url)
    let urlToRender = decodeURIComponent(request.body.url);
    //console.log( 'urlToRender', urlToRender)
    const fileName = getFileNameFromUrl(urlToRender);
    urlToRender = urlToRender.replaceAll('"', '')
    console.log('urlToRender', urlToRender)

    let pageContent = '';
    try {
        // Initialize crawler specific for SSR
        const ssrCrawler = new PuppeteerCrawler({
            maxConcurrency: 1,
            async requestHandler({ page }) {
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
        savepath = url.replaceAll('/', '').replaceAll(':', '')
        const page = await openPage(url)
        await page.setViewport({ width: 1920, height: 1080 });
        await page.screenshot({ path: `./src/${savepath}.png` })
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
    savepath = request.query.url.replaceAll('/', '').replaceAll(':', '')
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

        await fastify.listen({ port: 4000, host: '0.0.0.0' })
    } catch (err) {
        fastify.log.error(err)
        await globalPage.close()
        await globalBrowser.close()
        process.exit(1)
    }
}


start()