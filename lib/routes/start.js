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
const puppeteer = require("puppeteer");
const multer = require("multer");
const firebase_1 = require("../firebase");
const fs = require("fs");
const helperFunctions_1 = require("../modules/helperFunctions");
const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 20 * 1024 * 1024 // no larger than 10mb
    }
});
const initialJobState = {
    job: {
        '2FA': { authMethod: '', code: '', defeated: false, has2FA: false },
        progress: { percent: 0, processed: 0, total: 0 },
        screenshot: '',
        endpoint: '',
        started: true,
        canceled: false,
        paused: false,
        errored: false
    }
};
router.post('/', upload.single('leader-list'), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    const d = (new Date()).getTime();
    const { username, password, shortname, loginredirect, uid } = req.body;
    // Create the job object in the database
    console.log('Update job');
    firebase_1.db.ref(`users/${uid}`).update(initialJobState);
    console.log('Body', req.body);
    console.log('Files', req.file);
    const leaderFile = req.file;
    // Validate mapping file
    if (leaderFile) {
        const mappingFileName = leaderFile.originalname;
        if (mappingFileName) {
            const extension = mappingFileName.substr(mappingFileName.length - 4);
            console.log('Extension', extension);
            if (mappingFileName.substr(mappingFileName.length - 4) !== '.csv') {
                console.log('Incorrect File Type');
                res.send({
                    status: 'failure',
                    error: { message: 'Incorrect leader list file type, must be a CSV file.' }
                });
                return;
            }
        }
    }
    else {
        res.send({
            status: 'failure',
            error: { message: 'Please upload a leader file list.' }
        });
        return;
    }
    const csvString = leaderFile.buffer.toString('utf8');
    const leaderArr = helperFunctions_1.csvToObj(csvString);
    fs.writeFile(`${helperFunctions_1.tempFolder}/${uid}.json`, JSON.stringify(leaderArr), (err) => {
        if (err)
            throw err;
    });
    firebase_1.db.ref(`users/${uid}/job/progress`).update({ total: leaderArr.length });
    console.log('Start the main process');
    console.log('Environment', process.env.NODE_ENV);
    const browser = yield puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try {
        const page = yield browser.newPage();
        page.setViewport(helperFunctions_1.defaultViewport);
        helperFunctions_1.duration(d, 'after browser load');
        // Open login page
        // await page.goto('https://secure.entertimeonline.com/ta/KPAY1001850.login?NoRedirect=1');
        yield page.goto(`https://secure.entertimeonline.com/ta/${shortname}.login?NoRedirect=${loginredirect === 'on' ? '1' : '0'}`, { waitUntil: 'networkidle2' });
        helperFunctions_1.duration(d, 'after login page load');
        yield helperFunctions_1.takeScreenshot(uid, page);
        // Fill in login window
        yield page.evaluate((user, pass) => {
            document.querySelector('[name="Username"]').value = user;
            document.querySelector('[name="PasswordView"]').value = pass;
            document.querySelector('[name="LoginButton"').click();
        }, username, password);
        yield page.waitForNavigation();
        helperFunctions_1.duration(d, 'after 2FA load');
        yield helperFunctions_1.takeScreenshot(uid, page);
        // Does it have 2FA?
        const has2FA = yield page.evaluate(() => {
            const twoFAHeaderElem = document.querySelector('div.inputFormWr>h2');
            if (twoFAHeaderElem && twoFAHeaderElem.textContent) {
                return twoFAHeaderElem.textContent === 'Configure Virtual Code Settings';
            }
            return false;
        });
        console.log('Has 2FA', has2FA);
        helperFunctions_1.duration(d, 'after 2FA lookup');
        // Wait for 2FA auth method selection
        if (has2FA) {
            const endpoint = browser.wsEndpoint();
            firebase_1.db.ref(`users/${uid}/job`).update({
                endpoint,
                paused: true,
                '2FA': { authMethod: '', code: '', defeated: false, has2FA: true }
            });
        }
    }
    catch (err) {
        console.error(err);
        res.json({ result: 'error', error: { message: err.message } });
    }
    yield browser.disconnect();
    res.json({ result: 'success' });
}));
exports.default = router;
//# sourceMappingURL=start.js.map