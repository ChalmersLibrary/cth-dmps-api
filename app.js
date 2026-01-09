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
const { equal } = require('assert');
// const ssl_options = {
//   key: fs.readFileSync(process.env.SSL_KEY || 'key.pem'),
//   cert: fs.readFileSync(process.env.SSL_CERT || 'cert.pem')
// };

// Authentication
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token == process.env.JWT_SECRET) {
        console.log("Authenticated!");
        next();
    } else {
        console.log("NOT Authenticated!");
        return res.status(401).json({
            "error_message": "Authentication required",
            "error_code": "authentication_required"
        });
    }
};

// Check Accept header
const requireJsonAccept = (req, res, next) => {
    const accept = req.headers['accept'];
    if (accept && 
        !accept.includes('application/json') && 
        !accept.includes('application/vnd.org.rd-alliance.dmp-common.v1.2+json') && 
        !accept.includes('*/*')) {
        return res.status(406).json({
            "error_message": "Client must accept application/json or application/vnd.org.rd-alliance.dmp-common.v1.2+json",
            "error_code": "not_acceptable"
        });
    }
    next();
};

// Validate query params and return 400 on malformed input
const validateRequest = (req, res, next) => {
  const count = req.query['count'];
  const offset = req.query['offset'];

  // if provided, count must be a non-negative integer
  if (typeof count !== 'undefined') {
    if (!/^\d+$/.test(String(count)) || parseInt(count, 10) < 0) {
      return res.status(400).json({
        "error_message": "Invalid 'count' parameter; must be non-negative integer"
      });
    }
  }

  // if provided, offset must be a non-negative integer
  if (typeof offset !== 'undefined') {
    if (!/^\d+$/.test(String(offset)) || parseInt(offset, 10) < 0) {
      return res.status(400).json({
        "error_message": "Invalid 'offset' parameter; must be non-negative integer"
      });
    }
  }
  next();
};

// Reject methods other than GET (allow OPTIONS and HEAD for CORS/preflight)
const allowGetOnly = (req, res, next) => {
  const allowed = ['GET', 'OPTIONS', 'HEAD'];
  if (!allowed.includes(req.method)) {
    res.set('Allow', allowed.join(', '));
    return res.status(405).json({
      "error_message": "Method not allowed - only GET is supported for now.",
      "error_code": "method_not_allowed"
    });
  }
  next();
};

var indexName = process.env.ES_INDEX || 'dsw-dmps';

app.use(bodyParser.json());
//app.set('port', process.env.PORT || 3000);
var port = process.env.PORT || 3000;

// Set path to serve static files.
app.use(express.static(path.join(__dirname, 'public')));

// Enable CORS
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Enforce allowed methods after CORS headers are set
app.use(allowGetOnly);

app.get('/', function (req, res) {
    res.sendFile('index.html', {
      root: path.join(__dirname, 'views'),
    });
  });

// GET DMP(s) (with params)
// spec: https://rda-dmp-common.github.io/common-madmp-api/#/DMP/listDMPs
app.get('/dmps/:dmp_id?', authenticateToken, requireJsonAccept, validateRequest, function (req, res) {
    res.setHeader('Content-Type', req.headers['accept'] || 'application/json');

    const dmpId = req.params['dmp_id'];
    // If a dmp_id is provided in the path, search by _id; otherwise use query param or match-all
    let queryStr;
    if (dmpId) {
      queryStr = 'dmp.dmp_id.identifier"' + dmpId + '"';
    } else {
      queryStr = req.query['query'] || '*:*';
    }
    
    // ES params
    count = req.query['count'] || 9999;
    offset = req.query['offset'] || 0;
    sortBy = req.query['sort'] || '_id:asc';

    // Sort params mapping (only implement created and modified for now)
    if (sortBy == 'created,asc') {
      sortBy = 'dmp.created:asc';
    } else if (sortBy == 'created,desc') {
      sortBy = 'dmp.created:desc';
    } else if (sortBy == 'modified,asc') {
      sortBy = 'dmp.modified:asc';
    } else if (sortBy == 'modified,desc') {
      sortBy = 'dmp.modified:desc';
    }

    // Ethical issues param
    ethical_issues_exists = req.query['ethical_issues_exist'] || null;
    if (ethical_issues_exists != null) { 
      if (ethical_issues_exists.toLowerCase() == 'true') {
        if (queryStr != '*:*') {
          queryStr = queryStr + ' AND ' + 'dmp.ethical_issues_exists:yes';
        } else {  
          queryStr = 'dmp.ethical_issues_exists:yes';
        }
      } else if (ethical_issues_exists.toLowerCase() == 'false') {
        if (queryStr != '*:*') {
          queryStr = queryStr + ' AND ' + 'dmp.ethical_issues_exists:no';
        } else {
          queryStr = 'NOT dmp.ethical_issues_exists:no';
        }
      } else {
        // do nothing   
      }
    }

    // todo: implement filtering based on other params. For now ES query is passed directly via 'query' param.

    // Perform the actual search passing in the index, the search query, and the type.
    client
      .search({ index: indexName, type: 'dmp', from: offset, size: count, q: queryStr, sort: sortBy })
      .then((results) => {
        console.log(results);

        // Get, format and return dmp data
        var dmpArray = results.body.hits.hits.map(function(hit) {
          if (req.headers['include-metadata'] == "True") {
            return hit._source;  
          } else {
            var record = JSON.parse(JSON.stringify({ dmp: hit._source.dmp}  ));
            return record;
          }
        });

        var resCount = results.body.hits.total;
        if (dmpId && resCount == 0) {
          return res.status(404).json({
            "error_message": "No DMP found for the provided dmp_id",
            "error_code": "dmp_not_found"
          });
        }   
        // Create JSON response
        var r = {};
        var currDateUtc = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '') + ' UTC' 
        r['application'] = 'cth-dmps-api';
        r['time'] = currDateUtc;
        if (req.headers['user-agent']) {
          r['caller'] = req.headers['user-agent'];
        }
        r['code'] = res.statusCode;
        if (res.statusMessage) {
          r['message'] = res.statusMessage
        }
        r['total_count'] = resCount;
        r['items'] = dmpArray;
        r['errors'] = []; // todo
        res.json(r);   
      })
      .catch((err) => {
        console.log(err);
        res.send([]);
      });
  });

app.get('/api/v0', authenticateToken, function (req, res) {
  res.sendFile('api.html', {
    root: path.join(__dirname, 'views'),
  });
});

app.get('/api/v0/search', authenticateToken, requireJsonAccept, function (req, res) {
    res.setHeader('Content-Type', 'application/json');
    
    // Perform the actual search passing in the index, the search query, and the type.
    client
      .search({ index: indexName, type: 'dmp', from: 0, size: 9999, q: req.query['q'],  })
      .then((results) => {
        console.log(results);

        // Get, format and return dmp data
        var dmpArray = results.body.hits.hits.map(function(hit) {
          if (req.headers['include-metadata'] == "True") {
            return hit._source;  
          } else {
            var record = JSON.parse(JSON.stringify({ dmp: hit._source.dmp}  ));
            return record;
          }
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
        r['total_count'] = resCount;
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
  
  // Retrieve plan by (unique) id.
  app.get('/api/v0/plans/:planId', authenticateToken, requireJsonAccept, function (req, res) {
    res.setHeader('Content-Type', 'application/json');
    
    client
      .search({ index: indexName, type: 'dmp', from: 0, size: 999, q: '_id:"' + req.params['planId'] + '"',  })
      .then((results) => {
        console.log(results);
        // Get, format and return dmp data
        var dmpArray = results.body.hits.hits.map(function(hit) {
          if (req.headers['include-metadata'] == "True") {
            return hit._source;  
          } else {
            var record = JSON.parse(JSON.stringify({ dmp: hit._source.dmp}  ));
            return record;
          }
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
        r['total_count'] = resCount;
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
