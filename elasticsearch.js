require('dotenv').config();

const { Client } = require('@elastic/elasticsearch');
console.log(process.env);

const elasticClient = new Client({
  node: process.env.ES_NODE,
  auth: {
    username: process.env.ES_USER,
    password: process.env.ES_PW
  },
  log: 'info',
  agent: { agent: 'options' }
})

module.exports = elasticClient;




