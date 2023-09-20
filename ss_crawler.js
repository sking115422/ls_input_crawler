const puppeteer = require('puppeteer')
const fs = require('fs');
const config = require('config');

// Function generates a list of urls specified in a text file for processing
function getUrlsFromTextFile (path) {

    const urls = []

    try {
        const tmp = fs.readFileSync(path, 'utf8')
        tmp.split(/\r?\n/).forEach(line => {
            urls.push(line)
        })
    } catch (err) {
        console.error(err)
    }

    return urls
}

// Sleep function implemetation
function sleep(ms) {
    var start = new Date().getTime()
    var expire = start + ms;
    while (new Date().getTime() < expire) { }
    return;
}

async function get_ss (ind, uri) {

    try {

        const browser = await puppeteer.launch({headless:true})
        const page = await browser.newPage()

        await page.setViewport({
            height: 1080,
            width: 1920
        });

        await page.goto(uri, {
            //https://blog.cloudlayer.io/puppeteer-waituntil-options/
            waitUntil: "networkidle2",
            timeout: 3 * 1000
            // timeout: 0
        })

        await sleep(5000)

        await page.screenshot({
            path: `/home/spenc/research/dtron2_ls_uploader/ss/ss_${ind}.png`,
            clip: {
                x:0,
                y:0,
                width: 1920,
                height: 1080
            }
        })

        await page.close()
        await browser.close()       

    } catch (e) {

        console.error(e)
        await page.close()
        await browser.close()

    } 


    
}

async function mainDriver () {

    let uri_list = getUrlsFromTextFile("./url_lists/open_phish.txt")

    ind = 0
    for (const uri of uri_list) {
        try {
            await get_ss(ind, uri)
        } catch (e) {
            console.error(e)
        }
            
        ind++
    }

}

mainDriver()


