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
const helperFunctions_1 = require("../modules/helperFunctions");
const router = express.Router();
router.get('/', (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    const d = (new Date()).getTime();
    const { authmethod, uid } = req.query;
    console.log('Auth Method', authmethod);
    if (!authmethod) {
        res.json({ result: 'error', error: { message: 'No Auth Method Specified' } });
        return;
    }
    firebase_1.db.ref(`users/${uid}/job`).update({
        paused: false,
        '2FA': { authMethod: authmethod, code: '', defeated: false, has2FA: true }
    });
    const endpoint = yield firebase_1.db.ref(`users/${uid}/job/endpoint`).once('value').then(snap => snap.val());
    console.log('Endpoint', endpoint);
    try {
        const browser = yield puppeteer.connect({ browserWSEndpoint: endpoint });
        helperFunctions_1.duration(d, 'after browser open');
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
        page.setViewport(helperFunctions_1.defaultViewport);
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
        firebase_1.db.ref(`users/${uid}/job/2FA`).update({ messageSent: true });
        yield page.waitForNavigation();
        yield helperFunctions_1.takeScreenshot(uid, page);
        helperFunctions_1.duration(d, 'after sent auth message');
        const newEndpoint = browser.wsEndpoint();
        firebase_1.db.ref(`users/${uid}/job`).update({ endpoint: newEndpoint, paused: true });
    }
    catch (err) {
        console.error(err);
        // res.json({ result: 'error', error: { message: err.message } });
        firebase_1.db.ref(`users/${uid}/job`).update({ errored: true, errorMessage: err.message });
    }
    res.json({ result: 'success' });
}));
exports.default = router;
//# sourceMappingURL=authMethod.js.map