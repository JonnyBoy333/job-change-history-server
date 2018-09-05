"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
// Routes
const version_1 = require("./routes/version");
const start_1 = require("./routes/start");
const authMethod_1 = require("./routes/authMethod");
const authCode_1 = require("./routes/authCode");
const app = express();
app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});
app.use('/version', version_1.default);
app.use('/api/start', start_1.default);
app.use('/api/authmethod', authMethod_1.default);
app.use('/api/authCode', authCode_1.default);
app.listen(process.env.PORT || '8080');
//# sourceMappingURL=index.js.map