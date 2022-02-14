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
const ssl_options = {
  key: fs.readFileSync(process.env.SSL_KEY || 'key.pem'),
  cert: fs.readFileSync(process.env.SSL_CERT || 'cert.pem')
};

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

app.get('/search', function (req, res) {
    res.setHeader('Content-Type', 'application/json');
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    //const payload = jwt.verify(token, process.env.JWT_SECRET)
    if (token == process.env.JWT_SECRET) {
        console.log("Autenticated!");
    } 
    else {
        console.log("NOT Autenticated!");
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
        res.json(dmpArray);
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
