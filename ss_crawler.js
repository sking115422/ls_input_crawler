////// LIBRARY IMPORTS

const puppeteer = require('puppeteer')
const fs = require('fs');
const moment = require('moment')
const config = require('config');

////// SETTING VARIABLES FROM CONFIG

const paths = config.get('paths')

let ac_wl_fp = paths.adult_content_word_list
let lsw_wl_fp = paths.lang_stop_word_list
let uri_input_path_ = paths.uri_input_path

const pupp_conf = config.get('puppeteer_config')

let wait_until = pupp_conf.wait_until
let headless_ = pupp_conf.headless
let page_load_time_out = pupp_conf.page_load_time_out

const lang_check_conf = config.get('lang_check_config')

let wp_desired_lang_ = lang_check_conf.wp_desired_lang
let wp_lang_thresh_ = lang_check_conf.wp_lang_thresh

const wp_exp_conf = config.get('wp_exp_conf')

let max_clicks_ = wp_exp_conf.max_clicks
let click_timeout_ = wp_exp_conf.click_timeout
let max_num_bad_clicks_ = wp_exp_conf.max_num_bad_clicks
let depth_ = wp_exp_conf.depth

////// READING IN FILES

// Reading in stop words
f = fs.readFileSync(lsw_wl_fp, {encoding: 'utf8', flag: "r"})
sw_list = f.split("\r\n")

// Reading in stop words
f2 = fs.readFileSync(ac_wl_fp, {encoding: 'utf8', flag: "r"})
ac_list = f2.split("\n")

////// HELPER FUNCTIONS

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

function removeDups(lst) {
    return [...new Set(lst)]
}

function setDiff(l1, l2) {
    let s1 = new Set(l1)
    let s2 = new Set(l2)
    return Array.from(new Set([...s1].filter(x => !s2.has(x))));
}

/* Randomize array in-place using Durstenfeld shuffle algorithm */
function shuffleArr(array) {
    let arrayCopy = [...array]
    for (var i = arrayCopy.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = arrayCopy[i];
        arrayCopy[i] = arrayCopy[j];
        arrayCopy[j] = temp;
    }
    return arrayCopy
}

function getRandomSubArrFromArr(arr, num) {
    let ind_arr = Array.from({ length: arr.length }, (value, index) => index)
    if (num > arr.length) {
        num = arr.length
    }
    let ind_arr_shuffle_choose = shuffleArr(ind_arr).slice(0, num)
    let ret_arr = []
    for (i=0; i<ind_arr_shuffle_choose.length; i++) {
        ret_arr.push(arr[ind_arr_shuffle_choose[i]])
    }
    return ret_arr
}

function removeItemFromArray(arr, item) {
    arr_tmp = [...arr]
    const index_ = arr_tmp.indexOf(item);
    if (index_ > -1) { // only splice array when item is found
      arr_tmp.splice(index_, 1); // 2nd parameter means remove one item only
    }
    return arr_tmp
}

////// MAIN FUNCTIONS

async function checkWebpageLang(sw_list, page, wp_desired_lang, wp_lang_thresh) {

    // Setting language word percent to zero
    let lang_w_per = 0

    // Checking to see if webpage has specified language
    const wp_raw_lang = await page.$eval('html', element => element.lang);

    // If so and language matches desired language set percent to 1
    if (wp_raw_lang == wp_desired_lang) {
        lang_w_per = 1
    }

    // If not we will check the inner text of all element of the page against common stopwords of the language
    // then we will recompute lang_w_per
    if (lang_w_per < wp_lang_thresh) {

        en_count = 0
        word_count = 0

        const element_list_text = await page.$$eval('*', elements => elements.map(element => element.innerText));

        for (let i = 0; i < element_list_text.length; i++) {
            elemWords = element_list_text[i].split(" ")
            for (let j = 0; j < elemWords.length; j++) {
                word_count++
                for (k = 0; k < sw_list.length; k++){
                    if (elemWords[j] == sw_list[k]) {
                        en_count ++
                    }
                } 
            }
        }
        lang_w_per = en_count/word_count
    }

    // console.log(lang_w_per)

    // If language percent too low throw error
    if (lang_w_per < wp_lang_thresh) {
        throw "This webpage is not in english so it will be skipped!"
    }

}

async function clickAllElements(page, element_list, max_clicks, click_timeout, max_num_bad_clicks) {

    let uri_list_tmp = []
    let bad_click_ctr = 0

    if (max_clicks = "max" || max_clicks > element_list.length) {
        element_list = getRandomSubArrFromArr(element_list, element_list.length)
    } else {
        element_list = getRandomSubArrFromArr(element_list, max_clicks)
    }

    for (i = 0; i < element_list.length; i++) {

        // console.log("       " + ind)
        // console.log("       bcc " + bad_click_ctr)                    

        if (bad_click_ctr > max_num_bad_clicks){
            break                        
        }

        try {

            let elem = element_list[i]

            // Use a Promise-based timeout mechanism
            await new Promise((resolve, reject) => {

                const timeoutID = setTimeout(() => {
                    clearTimeout(timeoutID) // Clear the timeout
                    reject(bad_click_ctr + 1 + ". click has taken too long to load... it will be skipped!");
                    bad_click_ctr++                               
                }, click_timeout)

                elem.click()
                    .then(() => {
                        clearTimeout(timeoutID) // Clear the timeout
                        resolve()
                    })
                    .catch((error) => {
                        clearTimeout(timeoutID) // Clear the timeout
                        reject(error)
                    })

            })

            uri_list_tmp.push(page.url())

        } catch (e) {
            // console.error(e)
        }

    }

    return uri_list_tmp

}

async function exploreUri(uri_list) {

    let uri_list_uniq_master = []
    let del_list_uniq_master = []

    for (i=0; i<uri_list.length; i++) {
        
        console.log("   " + i)

        let uri = uri_list[i]

        const browser = await puppeteer.launch({headless: headless_ })
        const page = await browser.newPage(); //open new tab
        await (await browser.pages())[0].close(); //close first one, to overcome the bug in stealth library mentioned in
        //https://github.com/berstend/puppeteer-extra/issues/88

        try {  


            await page.goto(uri, {
                //https://blog.cloudlayer.io/puppeteer-waituntil-options/
                waitUntil: wait_until,
                timeout: page_load_time_out * 1000
                // timeout: 0
            })

            const element_list = await page.$$('*')

            await checkWebpageLang(sw_list, page, wp_desired_lang_ , wp_lang_thresh_)
            let uri_list = await clickAllElements(page, element_list, max_clicks_, click_timeout_ * 1000, max_num_bad_clicks_)
            let tab_list = await browser.pages()

            for (j=0; j<tab_list.length; j++) {
                uri_list.push(tab_list[j].url())
            }

            uri_list_uniq_master = removeDups([...uri_list_uniq_master, ...uri_list])

            // console.log(uri_list_uniq_master)

        } catch (e) {
            
            //return this and uri_list_uniq_master then remove from finally array in higher function before it is written into txt file
            del_list = [uri, ...uri_list]
            del_list_uniq_master = removeDups([...del_list, ...del_list_uniq_master])
            console.error(e)

        } finally {

            await page.close()
            await browser.close()

        }

    }

    return [uri_list_uniq_master, del_list_uniq_master]

}

async function exploreUriToDepth (uri, depth) {

    let ind = 0
    let uri_list = [uri]
    let uri_list_master = [uri]
    let del_list_master = []

    while (ind < depth) {

        let res = []

        try {
            res = await exploreUri(uri_list)
        } catch (e) {
            console.log(e)
        }

        let uri_list_new = res[0]
        let diff_list = setDiff(uri_list_new, uri_list)
        uri_list_master.push(diff_list)
        uri_list = diff_list

        let del_list = res[1]
        if (del_list.length > 0) {
            del_list_master.push(...del_list)
        }    

        console.log(ind)
        ind++

    }

    return [uri_list_master, del_list_master]

}

async function exploreUriListToDepth (uri_list, depth) {

    let ret_list = []
    let del_list = []
    
    ind = 0
    while (ind < uri_list.length) {
        console.log(uri_list[ind])
        tmp_list = await exploreUriToDepth(uri_list[ind], depth)
        ret_list.push(tmp_list[0])
        del_list.push(tmp_list[1])
        ind++
    }

    return [ret_list, del_list]

}

////// MAIN DRIVER

async function mainDriver () {

    uri_seed_list = getUrlsFromTextFile(uri_input_path_)

    tmp_list = await exploreUriListToDepth(uri_seed_list, depth_)
    uri_list_master = tmp_list[0]
    uri_del_list_master = tmp_list[1]

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
    uri_del_list_master_flat = removeDups(uri_del_list_master.flat(2))

    let uri_list_master_flat_cln = uri_list_master_flat
    for (i=0; i<uri_del_list_master_flat.length; i++) {
        uri_list_master_flat_cln = removeItemFromArray(uri_list_master_flat_cln, uri_del_list_master_flat[i])
    }

    del_list_ac = []
    for (i=0; i<uri_list_master_flat_cln.length; i++){
        for (j=0; j<ac_list.length; j++){
            // console.log(uri_list_master_flat_cln[i],  ac_list[j], uri_list_master_flat_cln[i].indexOf(ac_list[j]))
            if (uri_list_master_flat_cln[i].indexOf(ac_list[j]) >= 0) {
                // console.log(uri_list_master_flat_cln[i],  ac_list[j], uri_list_master_flat_cln[i].indexOf(ac_list[j]))
                del_list_ac.push(uri_list_master_flat_cln[i])
            }
        }
    }

    for (i=0; i<del_list_ac.length; i++) {
        uri_list_master_flat_cln = removeItemFromArray(uri_list_master_flat_cln, del_list_ac[i])
    }

    let uri_out_path_list1 = uri_input_path_.split("/")
    let uri_out_path_list2 = uri_out_path_list1[uri_out_path_list1.length - 1].split(".")
    let uri_out_path = uri_out_path_list1.slice(0, uri_out_path_list1.length - 1).join("/") + "/" + uri_out_path_list2[0] + "__exp.txt"

    for (i = 0; i < uri_list_master_flat_cln.length; i++) {
        if (i != uri_list_master_flat_cln.length - 1){
            fs.appendFileSync(uri_out_path, uri_list_master_flat_cln[i] + "\r\n" )            
        }
        else {
            fs.appendFileSync(uri_out_path, uri_list_master_flat_cln[i])
        }
    }

}

mainDriver()
