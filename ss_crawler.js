const puppeteer = require('puppeteer')
const fs = require('fs');
const moment = require('moment')

// Reading in stop words
f = fs.readFileSync("./stop_word_list/stop_word_list_174.txt", {encoding: 'utf8', flag: "r"})
sw_list = f.split("\r\n")


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

async function clickAllElements(page, element_list, max_clicks, click_timeout_ms, max_num_bad_clicks) {

    let uri_list_tmp = []
    let bad_click_ctr = 0
    let element_sub_list = []

    if (max_clicks = "max") {
        element_sub_list = element_list
    } else {
        element_sub_list = getRandomSubArrFromArr(element_list, max_clicks)
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
                }, click_timeout_ms)

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

    for (uri_ind=0; uri_ind<uri_list.length; uri_ind++) {
        
        console.log("   " + uri_ind)

        let uri = uri_list[uri_ind]

        const browser = await puppeteer.launch({headless:false})
        const page = await browser.newPage(); //open new tab
        await (await browser.pages())[0].close(); //close first one, to overcome the bug in stealth library mentioned in
        //https://github.com/berstend/puppeteer-extra/issues/88

        try {  

            await page.goto(uri, {
                //https://blog.cloudlayer.io/puppeteer-waituntil-options/
                waitUntil: "networkidle2",
                timeout: 5 * 1000
                // timeout: 0
            })


            const element_list = await page.$$('*')
            let uri_list = await clickAllElements(page, element_list, 1000, 2 * 1000, 10)
            let tab_list = await browser.pages()

            for (i=0; i<tab_list.length; i++) {
                uri_list.push(tab_list[i].url())
            }

            uri_list_uniq_master = removeDups([...uri_list_uniq_master, ...uri_list])

            // console.log(uri_list_uniq_master)

        } catch (e) {
            
            //return this and uri_list_uniq_master then remove from finally array in higher function before it is written into txt file
            del_list = [uri, ...uri_list_uniq_master]
            console.log(del_list)
            console.error(e)

        } finally {

            await page.close()
            await browser.close()

        }

    }

    return removeDups(uri_list_uniq_master)

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

    uri_input_path = "./url_lists/popadsnet_25.txt"
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


