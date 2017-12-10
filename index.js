'use strict';


// Module dependencies
const Trello = require('node-trello');
const marked = require('marked');
const textFromHTML = require('html2plaintext');
const loadYAML = require('js-yaml').load;


function get(appKey, authToken, boardID) {
  return new Promise(function (resolvePromise, rejectPromise) {
    var api = new Trello(appKey, authToken);
    var requests = [];
    requests.push(getLists(api, boardID));
    requests.push(getLabels(api, boardID));
    requests.push(getCards(api, boardID));

    // After all requests have completed
    Promise.all(requests).then(function (responses) {
      var lists = responses[0];
      var labels = responses[1];
      var cards = responses[2];
      var subRequests = [];
      var cardNums = [];
      var cardsByNum = {};
      var results = [];

      // FIRST PASS: cards --> cardsByNum
      // Get cards by short identifier, with unparsed tokens instead of HTML
      cards.forEach(function (card) {
        var obj = {
          id: card.id,
          title: card.name,
          list: lists[card.idList]
        };
        if (card.idAttachmentCover !== null) {
          subRequests.push(addCardCover(api, card, obj));
        }
        if (card.due !== null) {
          obj.date = card.due;
          obj.draft = !card.dueComplete;
        }
        else {
          obj.draft = false;
        }
        labels.forEach(function (label) {
          obj[label.name] = card.idLabels.includes(label.id);
        });
        cardNums.push(card.idShort);
        cardsByNum[card.idShort] = {
          card: obj,
          tokens: {}
        };
        addProperties(cardsByNum[card.idShort], card.desc);
      });

      // SECOND PASS: cardsByNum --> results
      // Build an array of cards and convert unparsed tokens to HTML
      Promise.all(subRequests).then(function () {
        cardNums.forEach(function (cardNum) {
          var result = cardsByNum[cardNum];
          Object.keys(result.tokens).forEach(function (key) {
            result.card[key] = parseMarkdown(result.tokens[key]);
          });
          results.push(result.card);
        });
        resolvePromise(results);
      }, function (reason) {
        rejectPromise(reason);
      });

    // Could not complete a request
    }, function (reason) {
      rejectPromise(reason);
    });
  });
}


function getCards(api, boardID) {
  return new Promise(function (resolvePromise, rejectPromise) {
    var filter = 'visible';
    if (options.getArchived) {
      filter = 'all';
    }
    var apiEndpoint = '/1/boards/' + boardID + '/cards/' + filter
    + '?fields=id,idShort,idList,idAttachmentCover,name,due,dueComplete,idLabels,desc';
    api.get(apiEndpoint, function(err, cards) {
      if (err) {
        rejectPromise(err);
        return;
      }
      resolvePromise(cards);
    });
  });
}


function addCardCover(api, card, obj) {
  return new Promise(function (resolvePromise, rejectPromise) {
    var apiEndpoint = '/1/cards/' + card.id
    + '/attachments/' + card.idAttachmentCover + '?fields=id,url';
    api.get(apiEndpoint, function(err, attachment) {
      if (err) {
        rejectPromise(err);
        return;
      }
      obj.cover = attachment.url;
      resolvePromise();
    });
  });
}


function getLabels(api, boardID) {
  return new Promise(function (resolvePromise, rejectPromise) {
    var apiEndpoint = '/1/boards/' + boardID
    + '/labels?fields=id,name,color';
    api.get(apiEndpoint, function(err, labels) {
      if (err) {
        rejectPromise(err);
        return;
      }
      labels.forEach(function (label) {
        if (label.name != '') {
          label.name = options.keyFromText(label.name, 'label');
        }
        else {
          label.name = label.color;
        }
      });
      resolvePromise(labels);
    });
  });
}


function getLists(api, boardID) {
  return new Promise(function (resolvePromise, rejectPromise) {
    var hash = {};
    var filter = 'open';
    if (options.getArchived) {
      filter = 'all';
    }
    var apiEndpoint = '/1/boards/' + boardID + '/lists/' + filter
    + '?fields=id,name';
    api.get(apiEndpoint, function(err, lists) {
      if (err) {
        rejectPromise(err);
        return;
      }
      lists.forEach(function (list) {
        hash[list.id] = list.name;
      });
      resolvePromise(hash);
    });
  });
}


function addProperties(result, markdown) {
  var tokens = marked.lexer(markdown);
  result.card.description = null;
  result.tokens.description = getDescription(tokens);
  var property;
  while (tokens.length > 0) {
    property = getProperty(tokens);
    if (property.parsed) {
      result.card[property.key] = property.value;
    }
    else {
      result.card[property.key] = null;
      result.tokens[property.key] = property.value;
    }
  }
}


function getDescription(tokens) {
  for (var i = 0; i < tokens.length; i++) {
    if (tokens[i].type == 'heading') {
      if (tokens[i].depth == 1) {
        break;
      }
      tokens[i].depth = options.headerMap(tokens[i].depth);
    }
  }
  var descriptionTokens = tokens.splice(0, i);
  descriptionTokens.links = tokens.links;
  return descriptionTokens;
}


function getProperty(tokens) {
  var headingTokens = tokens.splice(0, 1);
  headingTokens.links = tokens.links;
  var key = keyFromHeading(headingTokens);
  for (var i = 0; i < tokens.length; i++) {
    if (tokens[i].type == 'heading') {
      if (tokens[i].depth == 1) {
        break;
      }
      tokens[i].depth = options.headerMap(tokens[i].depth);
    }
  }
  var bodyTokens = tokens.splice(0, i);
  bodyTokens.links = tokens.links;
  if (bodyTokens.length == 1 && bodyTokens[0].type == 'code') {
    return {
      key: key,
      value: loadYAML(bodyTokens[0].text),
      parsed: true
    };
  }
  else {
    return {
      key: key,
      value: bodyTokens,
      parsed: false
    };
  }
}


function keyFromHeading(tokens) {
  var markdown = tokens[0].text;
  var matchesCode = markdown.match(/^`([^`]+)`$/);
  if (matchesCode !== null) {
    return matchesCode[1];
  }
  else {
    var html = marked.parser(tokens);
    var text = textFromHTML(html);
    return options.keyFromText(text, 'header');
  }
}


function parseMarkdown(tokens) {
  var output = marked.parser(tokens);
  return output.replace(/\n+$/, '');
}


// Markdown parser options
marked.setOptions({
  gfm: true,
  breaks: true,
  tables: false
});


// Default module options
var options = {};

options.getArchived = false;

options.keyFromText = function (text, type) {
  var key = text.toLowerCase();
  key = key.replace(/[^\w]+/g, '_');
  key = key.replace(/_$/, '');
  key = key.replace(/^[_\d]*/, '');
  if (key == '') {
    key = '_';
  }
  return key;
}

options.headerMap = function (depth) {
  return depth - 1;
}


// Module interface
module.exports.get = get;
module.exports.options = options;