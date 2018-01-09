// Extract text from PDF files, using OCR if necessary (multicore)
(function () {

  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const cluster = require('cluster');

  const async = require('async');
  const dir = require('node-dir');
  const tika = require('tika');

  // Configuration
  let inputFolder = './pdf/';
  let outputFolder = './text/';

  // Tika and OCR options
  const options = {

    contentType: 'application/pdf',
    ocrLanguage: 'deu',
    pdfEnableAutoSpace: true,
    pdfExtractInlineImages: true
  };

  let callback = () => { return; };

  // Execute script if not used as a module
  if (!module.parent) {

    init(
      process.argv[2],
      process.argv[3],
      process.argv[4],
      process.argv[5]
    );
  }

  function init(_inputFolder, _outputFolder, _language, _callback) {

    // Overwrite default configuration with arguments
    // from module or command line interface
    inputFolder = _inputFolder || inputFolder;
    outputFolder = _outputFolder || outputFolder;
    options.language = _language || options.language;
    callback = _callback || callback;

    // Create output folder if missing
    if (!fs.existsSync(outputFolder)) {

      fs.mkdirSync(outputFolder);
    }

    readFiles(prepareCluster);
  }

  function readFiles(callback) {

    // Get a list of all files
    dir.files(inputFolder, (error, fileList) => {

      if (error) { throw error; }

      // Include PDF files only
      fileList = fileList.filter(file => file.search(/\.pdf$/) > -1);

      callback(fileList);
    });
  }

  function prepareCluster(fileList) {

    const workerCount = Math.min(os.cpus().length, fileList.length);
    const fileListBatches = chunkArray(fileList, workerCount);

    if (cluster.isMaster) {

      console.log(`Starting ${workerCount} workers...`);

      for (var i = 0; i < workerCount; i++) {

        cluster.fork().on('error', handleError);
      }
    } else if (cluster.isWorker) {

      console.log(`Worker ${cluster.worker.id} started with ${fileListBatches[cluster.worker.id - 1].length} tasks`);

      async.each(fileListBatches[cluster.worker.id - 1], (file, callback) => {

        extractText(file, callback);
      }, handleComplete);
    }
  }

  function extractText(filePath, callback) {

    console.log(`Processing file ${filePath}`);

    // Extract text from PDF file
    tika.text(filePath, options, (error, result) => {

      // if (error) { callback(error); }

      const fileName = filePath.substr(filePath.lastIndexOf('/') + 1);

      // Save extracted content as text file
      saveFile(path.join(outputFolder, `${fileName}.txt`), result);
      callback();
    });
  }

  function handleComplete(error) {

    if (error) {

      console.error(error);

      cluster.worker.kill();
      process.exit(1);
    } else {

      console.log(`Worker ${cluster.worker.id} is done`);

      cluster.worker.kill();
      process.exit(0);
    }
  }

  function handleError(error) {

    console.error(`Worker error: ${error}`);
  }

  function chunkArray(arr, chunkSize) {

    const groups = [];

    for (let i = 0; i < arr.length; i += chunkSize) {

      groups.push(arr.slice(i, i + chunkSize));
    }

    return groups;
  }

  function saveFile(relativePath, string) {

    // Normalize file path
    relativePath = path.normalize(relativePath);

    try {

      console.log('Saved file', relativePath);

      // Save file
      return fs.writeFileSync(relativePath, string, 'utf8');
    } catch (error) {

      console.error(error);
    }
  }

  module.exports = { init };
})();
