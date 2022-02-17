require('dotenv').config();

var client = require("./elasticsearch.js");
var express = require('express');
const app = express();
//const { query } = require("express");
const bodyParser = require('body-parser');
const path = require('path');
// TODO: use JWT tokens for better security
//const jwt = require('jsonwebtoken');
const { exit } = require('process');

// Use SSL - https://nodejs.org/en/knowledge/HTTP/servers/how-to-create-a-HTTPS-server/
const https = require('https');
const fs = require('fs');
// const ssl_options = {
//   key: fs.readFileSync(process.env.SSL_KEY || 'key.pem'),
//   cert: fs.readFileSync(process.env.SSL_CERT || 'cert.pem')
// };

var indexName = process.env.ES_INDEX || 'dsw-dmps';

app.use(bodyParser.json());
//app.set('port', process.env.PORT || 3000);
var port = process.env.PORT || 3000;

// Set path to serve static files.
app.use(express.static(path.join(__dirname, 'public')));

// Enable CORS.
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.get('/', function (req, res) {
    res.sendFile('index.html', {
      root: path.join(__dirname, 'views'),
    });
  });

app.get('/api/v0/search', function (req, res) {
    res.setHeader('Content-Type', 'application/json');
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    //const payload = jwt.verify(token, process.env.JWT_SECRET)
    if (token == process.env.JWT_SECRET) {
        console.log("Authenticated!");
    } 
    else {
        console.log("NOT Authenticated!");
        return res.sendStatus(403);
    }
   
    // Perform the actual search passing in the index, the search query, and the type.
    client
      .search({ index: indexName, type: 'dmp', from: 0, size: 999, q: req.query['q'],  })
      .then((results) => {
        console.log(results);
        // Get, format and return dmp data
        var dmpArray = results.body.hits.hits.map(function(hit) {
            return hit._source;
           });
        var resCount = results.body.hits.total;   
        // Create JSON response
        var r = {};
        var currDateUtc = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '') + ' UTC' 
        r['application'] = 'cth-dmps-api';
        r['source'] = 'GET /api/v0/search/q=?' + req.query['q'];
        r['time'] = currDateUtc;
        if (req.headers['user-agent']) {
          r['caller'] = req.headers['user-agent'];
        }
        r['code'] = res.statusCode;
        if (res.statusMessage) {
          r['message'] = res.statusMessage
        }
        else {
          if (res.statusCode == '200') {
            r['message'] = 'OK';
          }   
        }
        r['total_items'] = resCount;
        r['items'] = dmpArray;
        r['errors'] = []; // todo
        res.json(r);   
        //res.json(dmpArray);
      })
      .catch((err) => {
        console.log(err);
        res.send([]);
      });
  });
  
  app.get('/api/v0/plans/:planId', function (req, res) {
    res.setHeader('Content-Type', 'application/json');
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    //const payload = jwt.verify(token, process.env.JWT_SECRET)
    if (token == process.env.JWT_SECRET) {
        console.log("Authenticated!");
    } 
    else {
        console.log("NOT Authenticated!");
        return res.sendStatus(403);
    }
   
    // Retrieve plan by (unique) id.
    client
      .search({ index: indexName, type: 'dmp', from: 0, size: 999, q: '_id:"' + req.params['planId'] + '"',  })
      .then((results) => {
        console.log(results);
        // Get, format and return dmp data
        var dmpArray = results.body.hits.hits.map(function(hit) {
            return hit._source;
           });
        var resCount = results.body.hits.total;   
        // Create JSON response
        var r = {};
        var currDateUtc = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '') + ' UTC' 
        r['application'] = 'cth-dmps-api';
        r['source'] = 'GET /api/v0/plans/' + req.params['planId'];
        r['time'] = currDateUtc;
        if (req.headers['user-agent']) {
          r['caller'] = req.headers['user-agent'];
        }
        r['code'] = res.statusCode;
        if (res.statusMessage) {
          r['message'] = res.statusMessage
        }
        else {
          if (res.statusCode == '200') {
            r['message'] = 'OK';
          }   
        }
        r['total_items'] = resCount;
        r['items'] = dmpArray;
        r['errors'] = []; // todo
        res.json(r);   
      })
      .catch((err) => {
        console.log(err);
        res.send([]);
      });
  });

  // Start server and listen on the specified port.
  // var server = https.createServer(ssl_options, app);
  app.listen(port, () => console.log(`Example app listening on port ${port}!`));

  // server.listen(port, () => {
  //   console.log("server starting on port : " + port)
  // });
