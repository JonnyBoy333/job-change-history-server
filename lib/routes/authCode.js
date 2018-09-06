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
const firebase_1 = require("../firebase");
const fs = require("fs");
const util_1 = require("util");
const helperFunctions_1 = require("../modules/helperFunctions");
const readFileAsync = util_1.promisify(fs.readFile);
const router = express.Router();
router.get('/', (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    const d = (new Date()).getTime();
    const { authcode, uid } = req.query;
    console.log('Auth Code', authcode);
    if (!authcode) {
        res.json({ result: 'error', error: { message: 'No Auth Code Specified' } });
        return;
    }
    firebase_1.db.ref(`users/${uid}/job`).update({ paused: false });
    firebase_1.db.ref(`users/${uid}/job/2FA`).update({ code: authcode });
    // Listen for job cancel
    firebase_1.db.ref(`users/${uid}/job/canceled`)
        .on('value', (snap) => {
        const val = snap.val();
        console.log('Job Canceled', val);
        if (val === true) {
            throw new Error('Job Canceled');
        }
    });
    const job = yield firebase_1.db.ref(`users/${uid}/job`).once('value').then(snap => snap.val());
    const endpoint = job.endpoint;
    const authMethod = job['2FA'].authMethod;
    const browser = yield puppeteer.connect({ browserWSEndpoint: endpoint });
    res.json({ result: 'success' });
    // fs.readFile(`${tempFolder}/${uid}.json`, (err, data) => {
    //   if (err) throw err;
    //   console.log(data);
    // });
    // const employees = [{
    //   'Employee ID': '202',
    //   'Effective Date': '07/26/18',
    //   'Manager 1': '223'
    // }];
    const text = yield readFileAsync(`${helperFunctions_1.tempFolder}/${uid}.json`, { encoding: 'utf8' });
    console.log('Text', text);
    const employees = JSON.parse(text);
    console.log('Object', employees);
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
        page.setViewport(helperFunctions_1.defaultViewport);
        yield page.evaluate((authMeth, authCode) => {
            document.querySelector(`[name="TokenValue${authMeth}"]`).value = authCode;
            const continueButton = document.querySelector('[name="AuthenticateMFAButton"]');
            continueButton.click();
        }, authMethod, authcode);
        yield page.waitForNavigation();
        helperFunctions_1.duration(d, 'after 2FA bypass');
        firebase_1.db.ref(`users/${uid}/job/2FA`).update({ defeated: true });
        yield helperFunctions_1.takeScreenshot(uid, page);
        // Get Frames
        let frames = yield page.frames();
        let frameNames = frames.map(frame => frame.name());
        // Dismiss any prompts
        const popupFrameIndex = frameNames.indexOf('PopupBodyFrame');
        if (popupFrameIndex >= 0) {
            frames[popupFrameIndex].evaluate(() => {
                document.getElementById('NotShowAgain').click();
                document.querySelector('input[name="ButtonOk"]').click();
            });
            yield helperFunctions_1.takeScreenshot(uid, page);
            helperFunctions_1.duration(d, 'after prompt dismissal');
        }
        // Get main frame
        const adminFrameIndex = frameNames.indexOf('ADMIN_CENTER');
        const adminFrame = frames[adminFrameIndex];
        // Select employee menu option
        const menuFrameIndex = frameNames.indexOf('ADMIN_MENU');
        const menuFrame = frames[menuFrameIndex];
        yield menuFrame.evaluate(() => document.getElementById('TopMenu_HM_Menu2').click());
        yield helperFunctions_1.takeScreenshot(uid, page);
        // Select employee list
        const menuBodyFrameIndex = frameNames.indexOf('ADMIN_MENU_BODY');
        const menuBodyFrame = frames[menuBodyFrameIndex];
        const adminFrameNavigation = adminFrame.waitForNavigation();
        yield menuBodyFrame.click('#HM_Item2_1');
        yield adminFrameNavigation;
        yield helperFunctions_1.takeScreenshot(uid, page);
        helperFunctions_1.duration(d, 'after employee list navigation');
        // Start the employee update loop
        let processed = 0;
        for (const employee of employees) {
            const lines = employee.lines;
            const loopStartD = new Date();
            // Imput employee ID and refresh
            yield adminFrame.evaluate((empId) => {
                document.querySelector('input[name="zAN7M"]').value = empId;
                document.querySelector('a.reloadButton').click();
            }, employee.empId);
            yield adminFrameNavigation;
            yield helperFunctions_1.takeScreenshot(uid, page);
            // Open employee record
            yield adminFrame.evaluate(() => document.querySelector('#RepTblContent_zAGAQ > tbody > tr > td:nth-child(2) > a').click());
            yield adminFrameNavigation;
            yield helperFunctions_1.takeScreenshot(uid, page);
            // Select Job Change History tab
            if (processed === 0) {
                yield adminFrame.evaluate(() => {
                    const jobChangeHistoryTab = document.evaluate('//li[contains(., \'Job Change History\')]', document, null, XPathResult.ANY_TYPE, null).iterateNext();
                    if (jobChangeHistoryTab) {
                        jobChangeHistoryTab.click();
                    }
                });
                yield adminFrameNavigation;
                yield helperFunctions_1.takeScreenshot(uid, page);
            }
            // Loop through all Job Change History lines
            for (const line of lines) {
                // Search for job change effective date
                yield adminFrame.evaluate((effDate) => {
                    document.querySelector('input[name="zAN7M"]').value = effDate;
                    document.querySelector('a.reloadButton').click();
                }, line.effDate);
                yield adminFrameNavigation;
                yield helperFunctions_1.takeScreenshot(uid, page);
                // Loop through all job change records for the given effective date
                const trLength = yield adminFrame.$$eval('tr[type="resultRow"]', trs => trs.length);
                for (let i = 0; i < trLength; i++) {
                    // Open the job change record
                    yield adminFrame.evaluate((iteration) => {
                        const rows = document.querySelectorAll('tr[type="resultRow"]');
                        const editLink = rows[iteration].children[1].firstChild;
                        editLink.click();
                    }, i);
                    yield adminFrameNavigation;
                    yield helperFunctions_1.takeScreenshot(uid, page);
                    // Get the job change history popup frame
                    frames = yield page.frames();
                    frameNames = frames.map(frame => frame.name());
                    const jobChangeFrameIndex = frameNames.indexOf('PopupBodyFrame');
                    const jobChangeFrame = frames[jobChangeFrameIndex];
                    // Open the Leader 1 employee lookup
                    // const jobChangeNavigation = jobChangeFrame.waitForNavigation({ timeout: 100 });
                    // try { await jobChangeNavigation } catch (e) {
                    //   console.log('Change Leader error', e);
                    // }
                    yield helperFunctions_1.sleep(100);
                    yield jobChangeFrame.click('#z15AMMA_LKP');
                    yield helperFunctions_1.takeScreenshot(uid, page);
                    // Select employee lookup iFrame
                    frames = yield page.frames();
                    frameNames = frames.map(frame => {
                        const parentFrame = frame.parentFrame();
                        return parentFrame ? parentFrame.name() : '';
                    });
                    const employeeSelectFrameIndex = frameNames.indexOf('PopupBodyFrame');
                    const empSelectFrame = frames[employeeSelectFrameIndex];
                    // Search for manager ID
                    yield empSelectFrame.evaluate((managerId) => {
                        document.querySelector('input[name="zAMF6"]').value = managerId;
                        document.querySelector('a.reloadButton').click();
                    }, line.manager);
                    yield helperFunctions_1.takeScreenshot(uid, page);
                    // Click the flag and save
                    yield empSelectFrame.click('tr.resultRow1 > td > a');
                    yield helperFunctions_1.takeScreenshot(uid, page);
                    yield jobChangeFrame.evaluate(() => {
                        const saveBtn = document.evaluate('//button[contains(., \'Save\')]', document, null, XPathResult.ANY_TYPE, null).iterateNext();
                        saveBtn.click();
                    });
                    yield adminFrameNavigation;
                    yield helperFunctions_1.takeScreenshot(uid, page);
                }
            }
            // Save the employee
            yield adminFrame.evaluate(() => {
                const saveBtn = document.evaluate('//a[contains(., \'Save\')]', document, null, XPathResult.ANY_TYPE, null).iterateNext();
                saveBtn.click();
            });
            yield adminFrameNavigation;
            yield helperFunctions_1.takeScreenshot(uid, page);
            // Back to employee list
            yield adminFrame.evaluate(() => document.getElementById('PAGE_BACK_BTN').click());
            yield adminFrameNavigation;
            yield helperFunctions_1.takeScreenshot(uid, page);
            // Update progress
            processed++;
            const percent = Math.round((processed / employees.length) * 1000) / 10;
            console.log('Percent Complete', percent);
            firebase_1.db.ref(`users/${uid}/job/progress`).update({ processed, percent, currentRec: employee.empId });
            helperFunctions_1.duration(loopStartD, `of employee processing`);
            helperFunctions_1.duration(d, `after ${processed} employee completion`);
        }
        browser.disconnect();
        // Cleanup
        fs.unlink(`${helperFunctions_1.tempFolder}/${uid}.json`, (err) => {
            if (err)
                throw err;
        });
    }
    catch (err) {
        console.error(err);
        firebase_1.db.ref(`users/${uid}/job`).update({ errored: true, errorMessage: err.message });
    }
    helperFunctions_1.duration(d, 'after completion');
}));
exports.default = router;
//# sourceMappingURL=authCode.js.map