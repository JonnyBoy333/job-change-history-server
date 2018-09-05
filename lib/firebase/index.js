"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const admin = require("firebase-admin");
const serviceAccount = require('../certs/kpay-automator-firebase-adminsdk-kxlz0-37f4666e1c.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://kpay-automator.firebaseio.com'
});
exports.db = admin.database();
//# sourceMappingURL=index.js.map