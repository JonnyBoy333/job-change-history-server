import * as express from 'express';

// Routes
import version from './routes/version';
import start from './routes/start';
import authMethod from './routes/authMethod';
import authCode from './routes/authCode';

const app = express();

app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.use('/version', version);
app.use('/api/start', start);
app.use('/api/authmethod', authMethod);
app.use('/api/authCode', authCode);


app.listen(process.env.PORT || '8080');