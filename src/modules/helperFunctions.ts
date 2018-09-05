import { db } from '../firebase';

// Constants
const defaultViewport = { width: 1200, height: 800 };
const delay = process.env.NODE_ENV !== 'production' ? 800 : 800;
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
}

export { duration, takeScreenshot, sleep, defaultViewport, delay, tempFolder, csvToObj }