'use strict';

const path = require('path');
const testPath = path.dirname(require.main.filename);
const modulePath = path.join(testPath, '..');
const thisModule = require(modulePath);

// Load environment variables from .env file
require('dotenv').load();

// Get the board https://trello.com/b/dMFueFPQ
var promise = thisModule.get(
  process.env.TRELLO_DEV_KEY,
  process.env.TRELLO_AUTH_TOKEN,
  'dMFueFPQ'
);

// Display the response
promise.then((cards) => {
  console.log(JSON.stringify(cards, null, 2));
}, (reason) => {
  if (reason.name == 'BoardConversionWarnings') {
    reason.warnings.forEach(function (warning) {
      console.error(warning);
    });
  }
  else {
    console.error(reason.message);
  }
});
