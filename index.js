const express = require('express');
const puppeteer = require('puppeteer');
const firebase = require('firebase-admin');
const fs = require('fs');

var config = {
  apiKey: 'AIzaSyDtI98-ps88Wyfq9T0O0EgBLLnCAvvWbF8',
  authDomain: 'test-puppeteer.firebaseapp.com',
  databaseURL: 'https://test-puppeteer.firebaseio.com',
  projectId: 'test-puppeteer',
  storageBucket: 'test-puppeteer.appspot.com',
  messagingSenderId: '834798462063'
};

if (!firebase.apps.length) {
  firebase.initializeApp(config)
}

const db = firebase.database();
const app = express();

app.get('/openpage', async (req, res) => {

  let lyrics = 'But still I\'m having memories of high speeds when the cops crashed\n' +
    'As I laugh, pushin the gas while my Glocks blast\n' +
    'We was young and we was dumb but we had heart';

  // write to a new file named 2pac.txt
  fs.writeFile('/tmp/2pac.txt', lyrics, (err) => {
    // throws an error, you could also catch it here
    if (err) throw err;

    // success case, the file was saved
    console.log('Lyric saved!');
  });

  try {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    const url = 'https://google.com';
    await page.goto(url, { waitUntil: 'networkidle2' });

    const endpoint = browser.wsEndpoint();
    console.log('Endpoint', endpoint);
    db.ref('test/').update({ endpoint });
    await browser.disconnect();

    res.send(endpoint);
  } catch (err) {
    console.log(err);
  }
});

app.get('/input', async (req, res) => {

  // const endpoint = req.query.endpoint;
  const endpoint = await db.ref('test/endpoint').once('value').then(snap => snap.val());
  const newBrowser = await puppeteer.connect({ browserWSEndpoint: endpoint });
  try {
    const pages = await newBrowser.pages();
    console.log('Pages', pages.length);
    console.log('Page 1 Content', (await pages[0].content()).length);
    console.log('Page 2 Content', (await pages[1].content()).length);

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const content = await page.content();
      if (content.length > 50) {
        console.log('Showing page', i + 1);
        // const page = pages[1];
        await page.evaluate(() => {
          document.querySelector('#lst-ib').value = 'dog';
        });
        const buffer = await page.screenshot();
        res.type('image/png').send(buffer);
      }
    }

  } catch (err) {
    console.error(err);
    res.send(err.toString());
  }
  await newBrowser.close();
})

app.listen(process.env.PORT || '8080');