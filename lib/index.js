"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const admin = require("firebase-admin");
const puppeteer = require("puppeteer");
const multer = require("multer");
const fs = require("fs");
const serviceAccount = require('./certs/kpay-automator-firebase-adminsdk-kxlz0-37f4666e1c.json');
// import serviceAccount from './certs/kpay-automator-firebase-adminsdk-kxlz0-37f4666e1c.json';
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://kpay-automator.firebaseio.com'
    });
}
const app = express();
const db = admin.database();
const tempFolder = process.env.NODE_ENV === 'production' ? '/tmp' : './tmp';
app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});
// const upload = multer({ dest: tempFolder });
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // no larger than 5mb, you can change as needed.
    }
});
app.get('/version', function versionHandler(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const browser = yield puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const version = yield browser.version();
        console.log(version);
        res.status(200).send(version);
        yield browser.close();
    });
});
// interface IRequest extends Request {
//   fields: { [key: string]: string }
//   files: File[]
// }
const initialJobState = {
    job: {
        '2FA': {
            authMethod: '',
            code: '',
            defeated: false,
            has2FA: false,
        },
        canceled: false,
        progress: {
            percent: 0,
            processed: 0,
            total: 0
        },
        screenshot: '',
        started: true
    }
};
// const finalJobState = {
//   job: {
//     '2FA': {
//       authMethod: '',
//       code: '',
//       defeated: false,
//       has2FA: false,
//       messageSent: false
//     },
//     canceled: false,
//     progress: {
//       percent: 0,
//       processed: 0,
//       total: 0
//     },
//     screenshot: '',
//     started: false
//   }
// }
const canceledJobState = Object.assign({}, initialJobState, { job: {
        canceled: true,
        started: false
    } });
const sleep = ms => new Promise(res => setTimeout(res, ms));
const fields = [
    { name: 'leader-list', maxCount: 1 }
];
app.post('/api/start', upload.fields(fields), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    const d = (new Date()).getTime();
    const { username, password, shortname, loginredirect, uid } = req.body;
    // Create the job object in the database
    console.log('Update job');
    db.ref(`users/${uid}`).update(initialJobState);
    // const body = req.body;
    console.log('Body', req.body);
    console.log('Files', req.files);
    const mappingFiles = req.files['leader-list'];
    // A bucket is a container for objects (files).
    // const bucket = Storage.bucket('puppeteer-test-app.appspot.com');
    // Validate mapping file
    if (mappingFiles) {
        const mappingFileName = mappingFiles[0].originalname;
        const extension = mappingFileName.substr(mappingFileName.length - 4);
        console.log('Extension', extension);
        if (mappingFileName.substr(mappingFileName.length - 4) !== '.csv') {
            console.log('Incorrect File Type');
            res.send({
                status: 'failure',
                message: 'Incorrect leader list file type, must be a CSV file.'
            });
            return;
        }
    }
    else {
        res.send({
            status: 'failure',
            message: 'Please upload a leader file list.'
        });
        return;
    }
    fs.writeFile(`${tempFolder}/${uid}.csv`, mappingFiles[0].buffer, (err) => {
        // throws an error, you could also catch it here
        if (err)
            throw err;
        // success case, the file was saved
        console.log('Lyric saved!');
    });
    // fs.rename(mappingFiles[0].path, `${tempFolder}/${uid}.csv`, function (err) {
    //   if (err) console.log('ERROR: ' + err);
    // });
    // let mappingObj = [];
    // const csvTextFile = await readFileAsync(mappingFiles[0].path, 'utf8');
    // mappingObj = csvToObj(csvTextFile);
    // console.log('Mapping', mappingObj);
    // Cleanup mapping file
    // fs.unlink(mappingFiles[0].path, (err) => {
    //   if (err) throw err;
    // });
    // console.log('Listen for job cancel');
    // // Listen for job cancel
    // functions.database.ref(`users/${uid}/job/canceled`)
    //   .onUpdate((snap) => {
    //     const val = snap.after.val();
    //     console.log('Job Canceled', val)
    //     if (val === true) {
    //       db.ref(`users/${uid}`).update(canceledJobState)
    //         .then(() => {
    //           throw new Error('Job Canceled');
    //         })
    //     }
    //   })
    console.log('Start the main process');
    const browser = yield puppeteer.launch({ args: ['--no-sandbox'] });
    try {
        const page = yield browser.newPage();
        duration(d, 'after browser load');
        // Open login page
        // await page.goto('https://secure.entertimeonline.com/ta/KPAY1001850.login?NoRedirect=1');
        yield page.goto(`https://secure.entertimeonline.com/ta/${shortname}.login?NoRedirect=${loginredirect === 'on' ? '1' : '0'}`, { waitUntil: 'networkidle2' });
        duration(d, 'after login page load');
        yield takeScreenshot(uid, page);
        // Fill in login window
        yield page.evaluate((user, pass) => {
            document.querySelector('[name="Username"]').value = user;
            document.querySelector('[name="PasswordView"]').value = pass;
            document.querySelector('[name="LoginButton"').click();
        }, username, password);
        yield page.waitForNavigation();
        duration(d, 'after 2FA load');
        yield takeScreenshot(uid, page);
        // Does it have 2FA?
        const has2FA = yield page.evaluate(() => {
            const twoFAHeaderElem = document.querySelector('div.inputFormWr>h2');
            if (twoFAHeaderElem && twoFAHeaderElem.textContent) {
                return twoFAHeaderElem.textContent === 'Configure Virtual Code Settings';
            }
            return false;
        });
        console.log('Has 2FA', has2FA);
        duration(d, 'after 2FA lookup');
        // Wait for 2FA auth method selection
        if (has2FA) {
            const endpoint = browser.wsEndpoint();
            db.ref(`users/${uid}/job`).update({
                endpoint,
                '2FA': { authMethod: '', code: '', defeated: false, has2FA: true }
            });
        }
        // const buffer = await page.screenshot();
        // res.type('image/png').send(buffer);
    }
    catch (err) {
        console.error(err);
        res.json({ result: 'error', error: { message: err.message } });
    }
    yield browser.disconnect();
    res.json({ result: 'success' });
}));
app.get('/api/authmethod', (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    const d = (new Date()).getTime();
    const { authmethod, uid } = req.query;
    console.log('Auth Method', authmethod);
    if (!authmethod) {
        res.json({ result: 'error', error: { message: 'No Auth Method Specified' } });
        return;
    }
    db.ref(`users/${uid}/job/2FA`).update({ authMethod: authmethod });
    const endpoint = yield db.ref(`users/${uid}/job/endpoint`).once('value').then(snap => snap.val());
    console.log('Endpoint', endpoint);
    try {
        const browser = yield puppeteer.connect({ browserWSEndpoint: endpoint });
        duration(d, 'after browser open');
        let page;
        const pages = yield browser.pages();
        for (let i = 0; i < pages.length; i++) {
            page = pages[i];
            // const content = await page.content();
            const content = yield page.evaluate(() => document.querySelector('body').innerHTML);
            console.log('Content Length', content.length);
            if (content.length > 0) {
                console.log('Showing page', i + 1);
                break;
            }
        }
        // const page = await browser.newPage();
        yield page.evaluate((authMeth) => {
            const smsRadio = document.querySelector(`input[value="${authMeth}"]`);
            smsRadio.click();
            const sendAuthMsgBtn = document.querySelector(`[name="Send${authMeth}Button"]`);
            if (!sendAuthMsgBtn) {
                throw new Error('Auth Method Not Configured');
            }
            else {
                sendAuthMsgBtn.click();
            }
        }, authmethod);
        yield page.waitForNavigation();
        yield takeScreenshot(uid, page);
        duration(d, 'after sent auth message');
        res.json({ result: 'success' });
        const newEndpoint = browser.wsEndpoint();
        db.ref(`users/${uid}/job`).update({ endpoint: newEndpoint });
    }
    catch (err) {
        console.error(err);
        res.json({ result: 'error', error: { message: err.message } });
    }
}));
app.get('/api/authcode', (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    const d = (new Date()).getTime();
    const { authcode, uid } = req.query;
    console.log('Auth Code', authcode);
    if (!authcode) {
        res.json({ result: 'error', error: { message: 'No Auth Code Specified' } });
        return;
    }
    db.ref(`users/${uid}/job/2FA`).update({ code: authcode });
    const job = yield db.ref(`users/${uid}/job`).once('value').then(snap => snap.val());
    const endpoint = job.endpoint;
    const authMethod = job['2FA'].authMethod;
    const browser = yield puppeteer.connect({ browserWSEndpoint: endpoint });
    try {
        let page;
        const pages = yield browser.pages();
        for (let i = 0; i < pages.length; i++) {
            page = pages[i];
            const content = yield page.evaluate(() => document.querySelector('body') ? document.querySelector('body').innerHTML : '');
            console.log('Content Length', content.length);
            if (content.length > 0) {
                console.log('Showing page', i + 1);
                break;
            }
        }
        yield page.evaluate((authMeth, authCode) => {
            document.querySelector(`[name="TokenValue${authMeth}"]`).value = authCode;
            const continueButton = document.querySelector('[name="AuthenticateMFAButton"]');
            continueButton.click();
        }, authMethod, authcode);
        yield page.waitForNavigation();
        duration(d, 'after 2FA bypass');
        db.ref(`users/${uid}/job/2FA`).update({ defeated: true });
        yield takeScreenshot(uid, page);
        browser.disconnect();
        res.json({ result: 'success' });
    }
    catch (err) {
        console.error(err);
        res.json({ result: 'error', error: { message: err.message } });
    }
    duration(d, 'after completion');
}));
function duration(d, message) {
    // How long did this take?
    const runtimeDuration = ((new Date()).getTime() - d) / 1000;
    console.log(`Duration ${message}`, runtimeDuration);
}
function takeScreenshot(uid, page) {
    return __awaiter(this, void 0, void 0, function* () {
        const imageOpts = { encoding: 'base64' };
        const base64Image = yield page.screenshot(imageOpts);
        yield db.ref(`users/${uid}/job`).update({ screenshot: `data:image/png;base64,${base64Image}` });
        // await sleep(500);
    });
}
// Convert CSV To Object Helper Func
function csvToObj(csv) {
    const cleanedCsv = csv.replace(/\r/g, '').replace(/^\uFEFF/, '');
    const lines = cleanedCsv.split('\n');
    const result = [];
    const headers = lines[0].split(',');
    for (let i = 1; i < lines.length; i++) {
        const obj = {};
        const currentline = lines[i].split(',');
        for (let j = 0; j < headers.length; j++) {
            obj[headers[j]] = currentline[j];
        }
        result.push(obj);
    }
    return result;
}
app.listen(process.env.PORT || '8080');
// app.listen(3000, () => console.log('Example app listening on port 3000!'))
// async function doTheThing() {
//   var sleep = ms => new Promise(res => setTimeout(res, ms));
//   try {
//       var adminWindow = document.getElementsByName('ADMIN_CENTER')[0].contentWindow;
//       adminWindow.document.getElementsByName('zN56Q')[0].value = '49807538';
//       await sleep(2000);
//       adminWindow.document.getElementsByClassName('reloadButton addedTitle')[0].click();
//       await sleep(2000);
//       adminWindow.document.getElementsByClassName('resultRow1')[0].cells[1].children[0].click();
//       await sleep(2000);
//       adminWindow.document.getElementsByClassName('resultRow1')[0].cells[1].children[0].click();
//       await sleep(2000);
//       var popupWindow = adminWindow.document.getElementById('PopupBodyFrame').contentWindow;
//       popupWindow.document.getElementById('z15AMMA_LKP').click();
//       await sleep(2000);
//       var managerPopupWindow = popupWindow.document.getElementById('PopupBodyFrame').contentWindow;
//       managerPopupWindow.selectValue('48637087', 'Jerick Valenzuela Aapuhin');
//       await sleep(2000);
//       // adminWindow.doAction("SAVE");
//       popupWindow.document.getElementsByClassName('primaryButton')[0].click();
//       await sleep(200);
//       adminWindow.document.getElementById('PAGE_BACK_BTN').click();
//   } catch (err) {
//       console.error(err);
//   }
// }
// doTheThing();
//# sourceMappingURL=index.js.map