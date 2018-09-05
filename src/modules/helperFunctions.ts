import { db } from '../firebase';

// Constants
const defaultViewport = { width: 1200, height: 800 };
const delay = process.env.NODE_ENV !== 'production' ? 800 : 0;
const tempFolder = process.env.NODE_ENV === 'production' ? '/tmp' : './tmp';

// How long did this take?
function duration(d, message) {
  const runtimeDuration = ((new Date()).getTime() - d) / 1000;
  console.log(`Duration ${message}`, runtimeDuration);
}

// Take a screenshot and save it
async function takeScreenshot(uid, page) {
  const imageOpts: any = {
    encoding: 'base64',
    type: 'jpeg',
    quality: 80
  };
  await sleep(delay);
  const base64Image = await page.screenshot(imageOpts);
  db.ref(`users/${uid}/job`).update({ screenshot: `data:image/png;base64,${base64Image}` });
  await sleep(delay);
}

// Sleep
const sleep = ms => new Promise(res => setTimeout(res, ms));

export { duration, takeScreenshot, sleep, defaultViewport, delay, tempFolder }