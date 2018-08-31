import * as bodyParser from 'body-parser';
import * as Busboy from 'busboy';
import * as contentType from 'content-type';
import * as getRawBody from 'raw-body';

export default (app) => {
  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: true }))
  app.use((req, res, next) => {
    if (req.rawBody === undefined && req.method === 'POST' && req.headers['content-type'].startsWith('multipart/form-data')) {
      getRawBody(req, {
        encoding: contentType.parse(req).parameters.charset,
        length: req.headers['content-length'],
        limit: '10mb',
      }, (err, str) => {
        if (err) { return next(err) }
        req.rawBody = str
        next()
      })
    } else {
      next()
    }
  })

  app.use((req, res, next) => {
    if (req.method === 'POST' && req.headers['content-type'].startsWith('multipart/form-data')) {
      const busboy = new Busboy({ headers: req.headers })
      let fileBuffer = new Buffer('')
      req.files = [];

      req.fields = {};
      busboy.on('field', (fieldname, value) => {
        // console.log(fieldname, value);
        req.fields[fieldname] = value;
      })

      busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
        console.log('File [' + fieldname + ']: filename: ' + filename + ', encoding: ' + encoding + ', mimetype: ' + mimetype);
        file.on('data', (data) => {
          fileBuffer = Buffer.concat([fileBuffer, data])
        })

        file.on('end', () => {
          const fileObject = {
            buffer: fileBuffer,
            encoding,
            fieldname,
            mimetype,
            'originalname': filename,
          }

          req.files.push(fileObject)
        })
      })

      busboy.on('finish', () => {
        next()
      })


      busboy.end(req.rawBody)
      req.pipe(busboy)
    } else {
      next()
    }
  })
}