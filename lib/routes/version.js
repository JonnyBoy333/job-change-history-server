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
const router = express.Router();
router.get('/', function versionHandler(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const browser = yield puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const version = yield browser.version();
        console.log(version);
        res.status(200).send(version);
        yield browser.close();
    });
});
exports.default = router;
//# sourceMappingURL=version.js.map