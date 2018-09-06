import * as express from 'express';
import * as puppeteer from 'puppeteer';
import { db } from '../firebase';
import { defaultViewport, duration, takeScreenshot } from '../modules/helperFunctions';
const router = express.Router();

router.get('/', async (req, res, next) => {
  const d = (new Date()).getTime();

  const { authmethod, uid } = req.query;
  console.log('Auth Method', authmethod);

  if (!authmethod) {
    res.json({ result: 'error', error: { message: 'No Auth Method Specified' } });
    return;
  }
  db.ref(`users/${uid}/job`).update({
    paused: false,
    '2FA': { authMethod: authmethod, code: '', defeated: false, has2FA: true }
  });

  const endpoint = await db.ref(`users/${uid}/job/endpoint`).once('value').then(snap => snap.val());
  console.log('Endpoint', endpoint);
  try {
    const browser = await puppeteer.connect({ browserWSEndpoint: endpoint });
    duration(d, 'after browser open');

    let page: puppeteer.Page;
    const pages = await browser.pages();
    for (let i = 0; i < pages.length; i++) {
      page = pages[i];
      // const content = await page.content();
      const content = await page.evaluate(() => document.querySelector('body').innerHTML);
      console.log('Content Length', content.length);
      if (content.length > 0) {
        console.log('Showing page', i + 1);
        break;
      }
    }
    page.setViewport(defaultViewport);
    await page.evaluate((authMeth) => {
      const smsRadio: HTMLInputElement = document.querySelector(`input[value="${authMeth}"]`);
      smsRadio.click();
      const sendAuthMsgBtn: HTMLInputElement = document.querySelector(`[name="Send${authMeth}Button"]`);
      if (!sendAuthMsgBtn) {
        throw new Error('Auth Method Not Configured');
      } else {
        sendAuthMsgBtn.click();
      }
    }, authmethod);
    db.ref(`users/${uid}/job/2FA`).update({ messageSent: true });
    await page.waitForNavigation();
    await takeScreenshot(uid, page);
    duration(d, 'after sent auth message');

    const newEndpoint = browser.wsEndpoint();
    db.ref(`users/${uid}/job`).update({ endpoint: newEndpoint, paused: true });
  } catch (err) {
    console.error(err);
    // res.json({ result: 'error', error: { message: err.message } });
    db.ref(`users/${uid}/job`).update({ errored: true, errorMessage: err.message });
  }
  res.json({ result: 'success' });
});

export default router;