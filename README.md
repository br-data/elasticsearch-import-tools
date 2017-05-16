# Elasticsearch Import Tools
Extract text and meta data from documents and import them to [Elasticsearch](https://www.elastic.co/products/elasticsearch). Quite useful, if you want to analyze a big document leak. The toolset uses [Apache Tika](https://tika.apache.org/) and [Tesseract](https://github.com/tesseract-ocr/tesseract) for text extraction and OCR.

## Usage
1. Clone the repository `git clone https://...`
2. Install dependencies `npm install`
3. Run scripts, e.g. `node extract.js ./pdf ./text 'POR'`

## Requirement
All scripts are written in JavaScript. To run them, you'll need at least **Node.js v6**. Check out the [Node.js installation guide](https://nodejs.org/en/download/package-manager/). The import tools use **Elasticsearch 2.4** for document storage and search. For further details, please refer to the [Elasticsearch installation guide](https://www.elastic.co/guide/en/elasticsearch/reference/2.4/_installation.html).

To check if your Elasticsearch is up and running, call the REST-Interface from the command line:

```
$ curl -XGET http://localhost:9200/_cluster/health\?pretty\=1
```

If you are seeing a _Unassigned shards_ warning, you might consider setting the numbers of replicas to 0. This works fine in a development environment:

```
$ curl -XPUT 'localhost:9200/_settings' -d '         
{                  
  index: {
    number_of_replicas : 0
  }
}'
```

## Tools
This section will explain the particular scripts and how to use them.

### extract.js
Saves all text from various documents (like PDFS) as a text file. Extracts text from PDF files or images if necessary. This is quite common, since many PDF files are simply scanned documents. The script accepts a [ISO language code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-3) as third parameter. Setting the document language will heavily improve OCR quality (default to ENG): 

```
$ node extract.js ./pdf ./text 'POR'
```

The script uses [node-tika](https://github.com/ICIJ/node-tika) as a bridge between Node.js and Tika (Java). However, extracting text from PDFs and images is error-prone. If you encounter problems you might try using Tika without the Node.js bridge. Just [download the Tika JAR](https://tika.apache.org/download.html) and call it from the command line. Example:

```
$ java -jar tika-app-1.14.jar -t -i ./pdf -o ./text   
```

**Note:** The memory allocated by Node.js defaults to 512 MB. In some cases, this is might not be enough and you'll see errors like: *FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - process out of memory*. But don't worry, the available memory can be temporarily increased: `node --max_old_space_size=4000000 extract.js`.

### prepare.js
Prepares an Elasticsearch index for import. Be careful: The old index is deleted. Usage example:

```
$ node prepare.js localhost:9200 my-index doc
```

The analyzer uses [ASCII folding](https://www.elastic.co/guide/en/elasticsearch/guide/2.x/asciifolding-token-filter.html) to enable searching for terms with diacritical characters, replacing diacritic characters with the corresponding ASCII characters. So _Conceição_ in the **body** field becomes _Conceicao_ in the **body.folded** field. If you don't need ASCII folding, disabling it might save a lot of (database) space.

Set the analyzer can also be done manually:

```
$ curl -XPUT localhost:9200/my-index -d '
{
  settings: {
    analysis: {
      analyzer: {
        folding: {
          tokenizer: "standard",
          filter: ["lowercase", "asciifolding"]
        }
      }
    }
  }
}'
```

Set the mapping:

```
$ curl -XPUT localhost:9200/my-index/_mapping/doc -d '
{
  properties: {
    body: {
      type: "string",
      analyzer: "standard",
      fields: {
        folded: {
          type: "string",
          analyzer: "folding"
        }
      }
    }
  }
}'
```

### import.js
Once the Elasticsearch index is prepared, we can start to import the extracted text documents:

```
$ node import.js ./text localhost:9200 my-index doc
```

This simple importer saves only the file path and the document body to Elasticsearch. In theory, you could add additional meta data like date, author, language etc. to allow for advanced filtering and sorting.

```javascript
body: {
  file: file,
  date: date,
  author: date,
  language: language,
  body: body
}
```

To check if your document are all in place, run a simple search query on your index:

```
$ curl -XGET 'localhost:9200/my-index/_search?q=body:my-query&pretty'
```

### server.js
Simple search service with an REST interface. The data from the Elasticsearch cluster can be queried via an API service. There are several ways to make a request:

- `GET http://localhost:3003/match/:query` Full text search. Finds only exact matches **John Doe** ([details](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-multi-match-query.html)).
- `GET http://localhost:3003/custom/:query` Custom full text search. Finds all terms of a query: **"John" AND "Doe"**. Supports wildcards and simple search operators ([details](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-simple-query-string-query.html)).
- `GET http://localhost:3003/fuzzy/:query` Fuzzy search. Finds all similar terms of a query: **Jhon** ([details](https// https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-fuzzy-query.html)).
- `GET http://localhost:3003/regexp/:query` Regular expression support for term-based search: **J.hn*** ([details](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-regexp-query.html)).

Run the server:

```
$ node server.js
```

Query the service for *evil company*:

```
$ curl http://localhost:3003/match/evil%20company
```

And this is what the response might look like:

```json
{
  "took": 2680,
  "timed_out": false,
  "_shards": {
    "total": 5,
    "successful": 5,
    "failed": 0
  },
  "hits": {
    "total": 1,
    "max_score": 0.40393832,
    "hits": [
      {
        "_index": "my-index",
        "_type": "doc",
        "_id": "AVvJsJpysUfTp_aHjvMj",
        "_score": 0.40393832,
        "_source": {
          "file": "text/document-vii-2016-01-11.txt",
          "name": "Notification Of Disclosure, January 11th, 2016 "
        },
        "highlight": {
          "body": [
            "Evidence that <em>Evil Company</em> is doing evil things",
            "More incriminating information about <em>Evil Company</em>",
          ]
        }
      }
    ]
  }
}
```

**Note:** The maximum number of results is hard-coded to 100. You can change the limit in the code: `const maxSize = 500;`. Currently the big document bodies are excluded from the response. Instead we get an array of highlighted paragraphs, which contain our search term. As before, this can easily be changed in the configuration object.

## Frontend
If you are looking for a web frontend to search your Elasticsearch document collection, have a look at [elasticsearch-frontend](https://github.com/br-data/elasticsearch-frontend). The application is build with [Express](https://expressjs.com/) and supports user authentication.

## Improvements
- Move the Elasticsearch database settings (host, port, index) to a `./config` file
