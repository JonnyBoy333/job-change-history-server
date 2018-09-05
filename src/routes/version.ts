import * as express from 'express';
import * as puppeteer from 'puppeteer';
const router = express.Router();

router.get('/', async function versionHandler(req, res) {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const version = await browser.version()
  console.log(version);
  res.status(200).send(version);
  await browser.close();
});

export default router;