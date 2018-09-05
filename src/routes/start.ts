import * as express from 'express';
import * as puppeteer from 'puppeteer';
import * as multer from 'multer';
import { db } from '../firebase';
import * as fs from 'fs';
import { defaultViewport, duration, takeScreenshot, tempFolder } from '../modules/helperFunctions';
const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024 // no larger than 10mb, you can change as needed.
  }
});

const initialJobState = {
  job: {
    '2FA': {
      authMethod: '',
      code: '',
      defeated: false,
      has2FA: false,
    },
    progress: {
      percent: 0,
      processed: 0,
      total: 0
    },
    screenshot: '',
    endpoint: '',
    started: true,
    canceled: false,
    paused: false,
    errored: false
  }
}

// const tempFolder = process.env.NODE_ENV === 'production' ? '/tmp' : './tmp';
// const defaultViewport = { width: 1200, height: 800 };
// const delay = process.env.NODE_ENV !== 'production' ? 500 : 0;

router.post('/', upload.single('leader-list'), async (req: any, res, next) => {
  // app.post('/api/start', async (req: any, res, next) => {


  const d = (new Date()).getTime();

  // const { username, password, shortname, loginredirect, uid } = req.body;
  const { username, password, shortname, loginredirect, uid } = req.body;

  // Create the job object in the database
  console.log('Update job');
  db.ref(`users/${uid}`).update(initialJobState);

  // const body = req.body;
  console.log('Body', req.body);
  console.log('Files', req.file);
  // const mappingFiles = req.files['leader-list'];
  const leaderFile = req.file
  // const mappingFiles = req.files;

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
  } else {
    res.send({
      status: 'failure',
      error: { message: 'Please upload a leader file list.' }
    });
    return;
  }

  const csvString = leaderFile.buffer.toString('utf8');
  console.log('String', csvString);
  const leaderArr = csvToObj(csvString);
  console.log('Leader Object', leaderArr);
  fs.writeFile(`${tempFolder}/${uid}.json`, JSON.stringify(leaderArr), (err) => {
    if (err) throw err;
  });
  db.ref(`users/${uid}/job/progress`).update({ total: leaderArr.length });

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

  console.log('Start the main process');
  console.log('Environment', process.env.NODE_ENV);

  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    page.setViewport(defaultViewport);
    duration(d, 'after browser load');

    // Open login page
    // await page.goto('https://secure.entertimeonline.com/ta/KPAY1001850.login?NoRedirect=1');
    await page.goto(`https://secure.entertimeonline.com/ta/${shortname}.login?NoRedirect=${loginredirect === 'on' ? '1' : '0'}`, { waitUntil: 'networkidle2' });
    duration(d, 'after login page load');
    await takeScreenshot(uid, page);

    // Fill in login window
    await page.evaluate((user, pass) => {
      (<HTMLInputElement>document.querySelector('[name="Username"]')).value = user;
      (<HTMLInputElement>document.querySelector('[name="PasswordView"]')).value = pass;
      (<HTMLInputElement>document.querySelector('[name="LoginButton"')).click();
    }, username, password);
    await page.waitForNavigation();
    duration(d, 'after 2FA load');
    await takeScreenshot(uid, page);

    // Does it have 2FA?
    const has2FA = await page.evaluate(() => {
      const twoFAHeaderElem = document.querySelector('div.inputFormWr>h2');
      if (twoFAHeaderElem && twoFAHeaderElem.textContent) {
        return twoFAHeaderElem.textContent === 'Configure Virtual Code Settings'
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
        paused: true,
        '2FA': { authMethod: '', code: '', defeated: false, has2FA: true }
      });
    }
  } catch (err) {
    console.error(err);
    res.json({ result: 'error', error: { message: err.message } });
  }
  await browser.disconnect();
  res.json({ result: 'success' });
});

// Convert CSV To Object Helper Func
function csvToObj(csv) {
  const cleanedCsv = csv.replace(/\r/g, '').replace(/^\uFEFF/, '');
  const lines = cleanedCsv.split('\n');
  const results = [];
  const headers = lines[0].split(',');

  for (let i = 1; i < lines.length; i++) {
    const obj = {};
    const currentline = lines[i].split(',');
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = currentline[j];
    }
    results.push(obj);
  }
  console.log('Array before grouping', results);

  const empArray = Object.values(results.reduce((result, emp) => {
    const empId = emp['Employee ID'];
    const effDate = emp['Effective Date'];
    const manager = emp['Manager 1'];
    // Create new group
    if (!result[empId]) result[empId] = {
      empId,
      lines: []
    };
    // Append to group
    result[empId].lines.push({
      effDate,
      manager
    });
    return result;
  }, {}));

  empArray.sort((a: any, b: any) => Number(a.empId) - Number(b.empId));

  return empArray;
  // return groupBy(result, 'Employee ID');
}

export default router;