// REST interface for simple Elasticsearch queries
const express = require('express');
const router = express.Router();
const elastic = require('elasticsearch');

// Service port
const port = process.env.PORT || 3003;

// Elasticsearch settings
const client = new elastic.Client({ host: 'localhost:9200' });
const index = 'my-index';

// Limit number of results
const maxSize = 100;
// Exclude document body from response
const _source = {
  excludes: ['body*']
};
// Add highlighted matches to response
const highlight = {
  fields: {
    body: {}
  }
};

const app = express();

// Standard route
router.get('/', (req, res) => {

  res.json({

    name: 'Elasticsearch Simple Search',
    message: 'Elasticsearch Simple Search is up and running',
    version: '0.0.1'
  });
});

// Search route /match
// Full text search, finds only exact matches "John Doe"
// https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-multi-match-query.html
router.get('/match/:query', (req, res) => {

  const query = req.params.query;

  client.search({
    index,
    size: maxSize,
    body: {
      query: {
        multi_match: {
          query,
          type: 'phrase',
          fields: ['body', 'body.folded']
        }
      },
      _source,
      highlight
    }
  }, (error, result) => {

    res.json(result);
  });
});

// Search route /custom
// Full text search, finds all terms of a query: "John" AND "Doe"
// Supports wildcards and simple search operators
// https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-simple-query-string-query.html
router.get('/custom/:query', (req, res) => {

  const query = req.params.query;

  client.search({
    index,
    size: maxSize,
    body: {
      query: {
        simple_query_string: {
          query,
          fields: ['body','body.folded'],
          default_operator: 'and',
          analyze_wildcard: true
        }
      },
      _source,
      highlight
    }
  }, (error, result) => {

    res.json(result);
  });
});

// Search route /fuzzy
// Fuzzy term search, finds all terms of a query: "Jhon"
// https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-fuzzy-query.html
router.get('/fuzzy/:query', (req, res) => {

  const query = req.params.query;

  client.search({
    index,
    size: maxSize,
    body: {
      query: {
        fuzzy: {
          body: query
        }
      },
      _source,
      highlight
    }
  }, (error, result) => {

    res.json(result);
  });
});

// Search route /regexp
// Fuzzy term search, finds all terms of a query: "J.h*"
// https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-regexp-query.html
router.get('/regexp/:query', (req, res) => {

  const query = req.params.query;

  client.search({
    index,
    size: maxSize,
    body: {
      query: {
        regexp: {
          body: query
        }
      },
      _source,
      highlight
    }
  }, (error, result) => {

    res.json(result);
  });
});

// Allow Cross-origin request
app.use((req, res, next) => {

  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

  // Intercept OPTIONS method
  if ('OPTIONS' == req.method) {

    res.send(200);
  } else {

    next();
  }
});

app.use('/', router);

app.listen(port);

console.log(`Server is running on port ${port}`);
