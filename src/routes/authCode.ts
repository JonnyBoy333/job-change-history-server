import * as express from 'express';
import * as puppeteer from 'puppeteer';
import { db } from '../firebase';
import * as fs from 'fs';
import { promisify } from 'util';
import { defaultViewport, duration, takeScreenshot, tempFolder, sleep } from '../modules/helperFunctions';
const readFileAsync = promisify(fs.readFile);
const router = express.Router();

router.get('/', async (req, res, next) => {
  const d = (new Date()).getTime();

  const { authcode, uid } = req.query;
  console.log('Auth Code', authcode);

  if (!authcode) {
    res.json({ result: 'error', error: { message: 'No Auth Code Specified' } });
    return;
  }
  db.ref(`users/${uid}/job`).update({ paused: false });
  db.ref(`users/${uid}/job/2FA`).update({ code: authcode });

  // Listen for job cancel
  // db.ref(`users/${uid}/job/canceled`)
  //   .on('value', (snap) => {
  //     const val = snap.val();
  //     if (val === true) {
  //       console.log('Job Canceled', val)
  //       throw new Error('Job Canceled');
  //     }
  //   })

  const job = await db.ref(`users/${uid}/job`).once('value').then(snap => snap.val());
  const endpoint = job.endpoint;
  const authMethod = job['2FA'].authMethod;
  const browser = await puppeteer.connect({ browserWSEndpoint: endpoint });
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
  const text = await readFileAsync(`${tempFolder}/${uid}.json`, { encoding: 'utf8' });
  console.log('Text', text);
  const employees = JSON.parse(text);
  console.log('Object', employees);
  try {

    let page: puppeteer.Page;
    const pages = await browser.pages();
    for (let i = 0; i < pages.length; i++) {
      page = pages[i];
      const content = await page.evaluate(() => document.querySelector('body') ? document.querySelector('body').innerHTML : '');
      console.log('Content Length', content.length);
      if (content.length > 0) {
        console.log('Showing page', i + 1);
        break;
      }
    }
    page.setViewport(defaultViewport);

    await page.evaluate((authMeth, authCode) => {
      (<HTMLInputElement>document.querySelector(`[name="TokenValue${authMeth}"]`)).value = authCode;
      const continueButton: HTMLInputElement = document.querySelector('[name="AuthenticateMFAButton"]');
      continueButton.click();
    }, authMethod, authcode);
    await page.waitForNavigation();
    duration(d, 'after 2FA bypass');

    db.ref(`users/${uid}/job/2FA`).update({ defeated: true });
    await takeScreenshot(uid, page);

    // Get Frames
    let frames = await page.frames();
    let frameNames = frames.map(frame => frame.name());

    // Dismiss any prompts
    const popupFrameIndex = frameNames.indexOf('PopupBodyFrame');
    if (popupFrameIndex >= 0) {
      frames[popupFrameIndex].evaluate(() => {
        document.getElementById('NotShowAgain').click();
        (<HTMLInputElement>document.querySelector('input[name="ButtonOk"]')).click();
      });
      await takeScreenshot(uid, page);
      duration(d, 'after prompt dismissal');
    }

    // Get main frame
    const adminFrameIndex = frameNames.indexOf('ADMIN_CENTER');
    const adminFrame = frames[adminFrameIndex];

    // Select employee menu option
    const menuFrameIndex = frameNames.indexOf('ADMIN_MENU');
    const menuFrame = frames[menuFrameIndex];
    await menuFrame.evaluate(() => document.getElementById('TopMenu_HM_Menu2').click());
    await takeScreenshot(uid, page);

    // Select employee list
    const menuBodyFrameIndex = frameNames.indexOf('ADMIN_MENU_BODY');
    const menuBodyFrame = frames[menuBodyFrameIndex];

    const adminFrameNavigation = adminFrame.waitForNavigation({ waitUntil: 'networkidle0' });
    await menuBodyFrame.click('#HM_Item2_1');
    await adminFrameNavigation;
    await takeScreenshot(uid, page);
    duration(d, 'after employee list navigation');

    // Start the employee update loop
    let processed = 0;
    for (const employee of employees) {
      const canceled = await db.ref(`users/${uid}/job/canceled`).once('value').then(snap => snap.val());
      if (canceled) { break }

      // try { await adminFrameNavigation } catch (e) {
      //   console.log('Error admin navigation', e.message);
      // }

      const lines = employee.lines;
      const loopStartD = new Date();

      const empListFound = await waitForElement(adminFrame, 'input[name="zAN7M"]');
      if (!empListFound) {
        throw new Error('Employee list did not load.')
      }

      // Imput employee ID and refresh
      await adminFrame.evaluate((empId) => {
        (<HTMLInputElement>document.querySelector('input[name="zAN7M"]')).value = empId;
        (<HTMLInputElement>document.querySelector('a.reloadButton')).click();
      }, employee.empId)
      await adminFrameNavigation;
      await takeScreenshot(uid, page);

      // Open employee record
      await adminFrame.evaluate(() =>
        (<HTMLInputElement>document.querySelector('#RepTblContent_zAGAQ > tbody > tr > td:nth-child(2) > a')).click());
      await adminFrameNavigation;
      await takeScreenshot(uid, page);

      // Select Job Change History tab
      if (processed === 0) {
        await adminFrame.evaluate(() => {
          const jobChangeHistoryTab = <HTMLInputElement>document.evaluate('//li[contains(., \'Job Change History\')]', document, null, XPathResult.ANY_TYPE, null).iterateNext();
          if (jobChangeHistoryTab) {
            jobChangeHistoryTab.click();
          }
        })
        await adminFrameNavigation;
        await takeScreenshot(uid, page);
      }

      // Loop through all Job Change History lines
      const jobChangeListFound = await waitForElement(adminFrame, 'input[name="zAN7M"]');
      if (!jobChangeListFound) {
        throw new Error('Job Change list did not load.')
      }
      for (const line of lines) {
        // Search for job change effective date
        await adminFrame.evaluate((effDate) => {
          (<HTMLInputElement>document.querySelector('input[name="zAN7M"]')).value = effDate;
          (<HTMLInputElement>document.querySelector('a.reloadButton')).click();
        }, line.effDate)
        await adminFrameNavigation;
        await takeScreenshot(uid, page);

        // Loop through all job change records for the given effective date
        const trLength = await adminFrame.$$eval('tr[type="resultRow"]', trs => trs.length);
        for (let i = 0; i < trLength; i++) {

          // Open the job change record
          await adminFrame.evaluate((iteration) => {
            const rows = document.querySelectorAll('tr[type="resultRow"]');
            const editLink = <HTMLInputElement>rows[iteration].children[1].firstChild;
            editLink.click();
          }, i);
          await adminFrameNavigation;
          await takeScreenshot(uid, page);

          // Get the job change history popup frame
          frames = await page.frames();
          frameNames = frames.map(frame => frame.name());
          const jobChangeFrameIndex = frameNames.indexOf('PopupBodyFrame');
          const jobChangeFrame = frames[jobChangeFrameIndex];

          // Open the Leader 1 employee lookup
          // const jobChangeNavigation = jobChangeFrame.waitForNavigation({ timeout: 1000, waitUntil: 'networkidle0' });
          const empLookupFound = await waitForElement(jobChangeFrame, '#z15AMMA_LKP');
          if (!empLookupFound) {
            throw new Error('Employee lookup button not found.')
          }
          await jobChangeFrame.click('#z15AMMA_LKP');
          await takeScreenshot(uid, page);

          // Select employee lookup iFrame
          frames = await page.frames();
          frameNames = frames.map(frame => {
            const parentFrame = frame.parentFrame();
            return parentFrame ? parentFrame.name() : ''
          });
          const employeeSelectFrameIndex = frameNames.indexOf('PopupBodyFrame');
          const empSelectFrame = frames[employeeSelectFrameIndex];

          // Search for manager ID
          const managerListFound = await waitForElement(empSelectFrame, 'input[name="zAMF6"]');
          if (!managerListFound) {
            throw new Error('Manager lookup list did not load.')
          }
          await empSelectFrame.evaluate((managerId) => {
            (<HTMLInputElement>document.querySelector('input[name="zAMF6"]')).value = managerId;
            (<HTMLInputElement>document.querySelector('a.reloadButton')).click();
          }, line.manager);
          await takeScreenshot(uid, page);

          // Click the flag and save
          await empSelectFrame.click('tr.resultRow1 > td > a');
          await takeScreenshot(uid, page);
          await jobChangeFrame.evaluate(() => {
            const saveBtn = <HTMLInputElement>document.evaluate('//button[contains(., \'Save\')]', document, null, XPathResult.ANY_TYPE, null).iterateNext();
            saveBtn.click();
          });
          await adminFrameNavigation;
          await takeScreenshot(uid, page);

        }
      }

      // Save the employee
      await adminFrame.evaluate(() => {
        const saveBtn = <HTMLInputElement>document.evaluate('//a[contains(., \'Save\')]', document, null, XPathResult.ANY_TYPE, null).iterateNext();
        saveBtn.click();
      });
      await adminFrameNavigation;
      await takeScreenshot(uid, page);

      // Back to employee list
      await adminFrame.evaluate(() => document.getElementById('PAGE_BACK_BTN').click());
      await adminFrameNavigation;
      await takeScreenshot(uid, page);

      // Update progress
      processed++;
      const percent = Math.round((processed / employees.length) * 1000) / 10;
      console.log('Percent Complete', percent);
      db.ref(`users/${uid}/job/progress`).update({ processed, percent, currentRec: employee.empId });
      duration(loopStartD, `of employee processing`);
      duration(d, `after ${processed} employee completion`);
    }

    browser.disconnect();

    // Cleanup
    fs.unlink(`${tempFolder}/${uid}.json`, (err) => {
      if (err) throw err;
    });

  } catch (err) {
    console.error(err);
    db.ref(`users/${uid}/job`).update({ errored: true, errorMessage: err.message });
  }
  duration(d, 'after completion');

});

async function waitForElement(frame: puppeteer.Frame, selector: string) {
  if (!frame || !frame.hasOwnProperty('$')){
    await sleep(100);
  }
  let element = await frame.$(selector);
  let found = false;
  for (let k = 0; k < 20; k++) {
    if (!element) {
      await sleep(100);
      element = await frame.$(selector);
    } else {
      found = true;
      break;
    }
  }
  console.log(`${selector} found`, found);
  return found;
}

export default router;