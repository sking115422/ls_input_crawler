const puppeteer = require('puppeteer')
const fs = require('fs');
const config = require('config');
const cheerio = require('cheerio');
const moment = require('moment')

// Reading in stop words
f = fs.readFileSync("./stop_word_list/stop_word_list_174.txt", {encoding: 'utf8', flag: "r"})
sw_list = f.split("\r\n")

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
    let start = new Date().getTime()
    let expire = start + ms;
    while (new Date().getTime() < expire) { }
    return;
}

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

/////////////////////////////////////////////////////////////////////////////////////

function removeDups(lst) {
    return [...new Set(lst)]
}

function setDiff(l1, l2) {
    let s1 = new Set(l1)
    let s2 = new Set(l2)
    return Array.from(new Set([...s1].filter(x => !s2.has(x))));
}

// async function get_ss (ind, uri) {

//     try {

//         const browser = await puppeteer.launch({headless:'new'})
//         const page = await browser.newPage(); //open new tab
//         await (await browser.pages())[0].close(); //close first one, to overcome the bug in stealth library mentioned in
//         //https://github.com/berstend/puppeteer-extra/issues/88

//         await page.setViewport({
//             height: 1080,
//             width: 1920
//         });

//         await page.goto(uri, {
//             //https://blog.cloudlayer.io/puppeteer-waituntil-options/
//             waitUntil: "networkidle2",
//             timeout: 3 * 1000
//             // timeout: 0
//         })

//         await sleep(1000)

//         const t_hold = .35

//         let eng_w_per = 0

//         let wp_lang = await page.evaluate(() => {
//             const lang = document.querySelector('html').lang
//             return lang
//         })

//         if (wp_lang = "en") {
//             eng_w_per = 1
//         }

//         if (eng_w_per < t_hold) {
            
//             allElements = await page.evaluate(() => {
//                 const tmp_list = []
//                 const allElements = document.querySelectorAll('*')
//                 for (const element of allElements) {
//                     tmp_list.push(element.innerText)
//                 }             
//                 return tmp_list
//             })

//             en_count = 0
//             word_count = 0

//             for (let i = 0; i < allElements.length; i++) {
//                 elemWords = allElements[i].split(" ")
//                 bf = false
//                 for (let j = 0; j < elemWords.length; j++) {
//                     word_count++
//                     for (k = 0; k < sw_list.length; k++){
//                         if (elemWords[j] == sw_list[k]) {
//                             en_count ++
//                         }
//                     } 
//                 }
//             }

//             eng_w_per = en_count/word_count
//         }

//         if (eng_w_per < t_hold) {
//             throw {name: "nonEnglishWebpageException", message: "This webpage is not in english so it will be skipped!"};
//         }

//         await sleep(2000)

//         await page.screenshot({
//             path: `./ss/ss_${ind}.png`,
//             clip: {
//                 x:0,
//                 y:0,
//                 width: 1920,
//                 height: 1080
//             }
//         })

//         await page.close()
//         await browser.close()       

//     } catch (e) {

//         console.error(e)
//         await page.close()
//         await browser.close()

//     } 

// }

async function exploreUri(uri_list) {

    let uri_list_uniq_master = []

    for (uri_ind=0; uri_ind<uri_list.length; uri_ind++) {

        console.log("   " + uri_ind)

        let uri = uri_list[uri_ind]

        const browser = await puppeteer.launch({headless:false})
        const page = await browser.newPage(); //open new tab
        await (await browser.pages())[0].close(); //close first one, to overcome the bug in stealth library mentioned in
        //https://github.com/berstend/puppeteer-extra/issues/88

        // timeoutID = setInterval(async ()=> {
        //     let pages_list = await browser.pages()
        //     console.log(pages_list)
        //     for(i=pages_list.length - 1; i>0; i--){
        //         console.log([pages_list[i]])
        //         console.log("******************")
        //         pages_list[i].close()
        //         sleep(5 * 1000)
        //     } 
        // }, 5 * 1000)

        try {  

            // timeoutID = setTimeout(async ()=> {
            //     await page.close()
            //     await browser.close()
            // }, 20 * 1000)

            await page.goto(uri, {
                //https://blog.cloudlayer.io/puppeteer-waituntil-options/
                waitUntil: "networkidle2",
                timeout: 5 * 1000
                // timeout: 0
            })

            async function clickAllElements (element_list) {
                let uri_list_tmp = []
                for (i=0; i<element_list.length; i++) {
                    try {
                        let elem = element_list[i]
                        await elem.click()
                        uri_list_tmp.push(page.url())
                        // console.log("element " + i + " clicked")
                    } catch (e) {
                        // console.error(e)
                    }
                }
                return uri_list_tmp
            }

            const element_list = await page.$$('*')
            let uri_list = await clickAllElements(element_list)
            let tab_list = await browser.pages()

            for (i=0; i<tab_list.length; i++) {
                uri_list.push(tab_list[i].url())
            }

            let uri_list_uniq = removeDups(uri_list)

            uri_list_uniq_master = removeDups([...uri_list_uniq_master, ...uri_list_uniq])

            // clearTimeout(timeoutID)

        } catch (e) {

            console.error(e)

        } finally {

            await page.close()
            await browser.close()

        }
    }
    return uri_list_uniq_master
}

async function exploreUriToDepth (uri, depth) {

    let ind = 0
    let uri_list_exp = [uri]
    let uri_list_exp_all = [uri]

    while (ind < depth) {

        let uri_list_exp_new = await exploreUri(uri_list_exp)
        let diff_list = setDiff(uri_list_exp_new, uri_list_exp)
        uri_list_exp_all.push(diff_list)
        uri_list_exp = diff_list
        console.log(ind)
        ind++
    }

    return uri_list_exp_all

}

async function exploreUriListToDepth (uri_list, depth) {

    let mast_list = []
    
    ind = 0
    while (ind < uri_list.length) {
        console.log(uri_list[ind])
        tmp_list = await exploreUriToDepth(uri_list[ind], depth)
        mast_list.push(tmp_list)
        ind++
    }

    return mast_list

}

async function mainDriver () {

    uri_input_path = "./url_lists/test_3.txt"
    uri_seed_list = getUrlsFromTextFile(uri_input_path)
    depth = 3

    uri_list_master = await exploreUriListToDepth(uri_seed_list, depth)

    const timestamp = new Date().getTime()
    ts_f = moment(timestamp).format()

    if (!fs.existsSync("./logs/" + ts_f))
        fs.mkdirSync("./logs/" + ts_f)

    fs.writeFileSync("./logs/" + ts_f + "/uri_list_master.json", JSON.stringify(uri_list_master))

    for (i = 0; i < uri_seed_list.length; i++) {
        if (i != uri_seed_list.length - 1)
            fs.appendFileSync("./logs/" + ts_f + "/uri_seed_list.txt", uri_seed_list[i] + "\r\n", )
        else 
        fs.appendFileSync("./logs/" + ts_f + "/uri_seed_list.txt", uri_seed_list[i], )
    }

    uri_list_master_flat = removeDups(uri_list_master.flat(2))
    uri_out_path_list1 = uri_input_path.split("/")
    uri_out_path_list2 = uri_out_path_list1[uri_out_path_list1.length - 1].split(".")
    uri_out_path = uri_out_path_list1.slice(0, uri_out_path_list1.length - 1).join("/") + "/" + uri_out_path_list2[0] + "__exp.txt"

    for (i = 0; i < uri_list_master_flat.length; i++) {
        if (i != uri_list_master_flat.length - 1)
            fs.appendFileSync(uri_out_path, uri_list_master_flat[i] + "\r\n" )
        else 
        fs.appendFileSync(uri_out_path, uri_list_master_flat[i] )
    }
        
    

}

mainDriver()


