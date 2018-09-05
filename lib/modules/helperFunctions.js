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
const firebase_1 = require("../firebase");
// Constants
const defaultViewport = { width: 1200, height: 800 };
exports.defaultViewport = defaultViewport;
const delay = process.env.NODE_ENV !== 'production' ? 800 : 800;
exports.delay = delay;
const tempFolder = process.env.NODE_ENV === 'production' ? '/tmp' : './tmp';
exports.tempFolder = tempFolder;
// How long did this take?
function duration(d, message) {
    const runtimeDuration = ((new Date()).getTime() - d) / 1000;
    console.log(`Duration ${message}`, runtimeDuration);
}
exports.duration = duration;
// Take a screenshot and save it
function takeScreenshot(uid, page) {
    return __awaiter(this, void 0, void 0, function* () {
        const imageOpts = {
            encoding: 'base64',
            type: 'jpeg',
            quality: 80
        };
        yield sleep(delay);
        const base64Image = yield page.screenshot(imageOpts);
        firebase_1.db.ref(`users/${uid}/job`).update({ screenshot: `data:image/png;base64,${base64Image}` });
        yield sleep(delay);
    });
}
exports.takeScreenshot = takeScreenshot;
// Sleep
const sleep = ms => new Promise(res => setTimeout(res, ms));
exports.sleep = sleep;
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
        if (!result[empId])
            result[empId] = {
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
    empArray.sort((a, b) => Number(a.empId) - Number(b.empId));
    return empArray;
}
exports.csvToObj = csvToObj;
//# sourceMappingURL=helperFunctions.js.map