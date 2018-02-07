'use strict';


// Module dependencies
const Trello = require('node-trello');
const marked = require('marked');
const textFromHTML = require('html2plaintext');
const escape = require('escape-html');
const loadYAML = require('js-yaml').load;


function get(appKey, authToken, boardId) {
  return new Promise(function (resolvePromise, rejectPromise) {
    var api = new Trello(appKey, authToken);
    var requests = [];
    requests.push(getLists(api, boardId));
    requests.push(getLabels(api, boardId));
    requests.push(getCards(api, boardId));

    // After all requests have completed
    Promise.all(requests).then(function (responses) {
      var lists = responses[0];
      var labels = responses[1];
      var cards = responses[2];
      var subRequests = [];
      var cardShortIds = [];
      var cardsByShortId = {};
      var results = [];

      // FIRST PASS: cards --> cardsByShortId
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
        cardShortIds.push(card.shortLink);
        cardsByShortId[card.shortLink] = {
          card: obj,
          tokens: {}
        };
        try {
          addProperties(cardsByShortId[card.shortLink], card.desc);
        }
        catch (error) {
          rejectPromise(error);
          return;
        }
      });

      // SECOND PASS: cardsByShortId --> results
      // Build an array of cards and convert unparsed tokens to HTML
      Promise.all(subRequests).then(function () {
        cardShortIds.forEach(function (cardShortId) {
          var result = cardsByShortId[cardShortId];
          Object.keys(result.tokens).forEach(function (key) {
            setMarkdownRenderer(result.card, key, cardsByShortId);
            try {
              result.card[key] = renderMarkdown(result.tokens[key]);
            }
            catch (error) {
              rejectPromise(error);
              return;
            }
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


function getCards(api, boardId) {
  return new Promise(function (resolvePromise, rejectPromise) {
    var filter = 'visible';
    if (options.getArchived) {
      filter = 'all';
    }
    var apiEndpoint = '/1/boards/' + boardId + '/cards/' + filter
    + '?fields=id,shortLink,idList,idAttachmentCover,name,due,dueComplete,idLabels,desc';
    api.get(apiEndpoint, function(error, cards) {
      if (error) {
        rejectPromise(error);
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
    api.get(apiEndpoint, function(error, attachment) {
      if (error) {
        rejectPromise(error);
        return;
      }
      obj.cover = attachment.url;
      resolvePromise();
    });
  });
}


function getLabels(api, boardId) {
  return new Promise(function (resolvePromise, rejectPromise) {
    var apiEndpoint = '/1/boards/' + boardId
    + '/labels?fields=id,name,color';
    api.get(apiEndpoint, function(error, labels) {
      if (error) {
        rejectPromise(error);
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


function getLists(api, boardId) {
  return new Promise(function (resolvePromise, rejectPromise) {
    var hash = {};
    var filter = 'open';
    if (options.getArchived) {
      filter = 'all';
    }
    var apiEndpoint = '/1/boards/' + boardId + '/lists/' + filter
    + '?fields=id,name';
    api.get(apiEndpoint, function(error, lists) {
      if (error) {
        rejectPromise(error);
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
    if (tokens[i].type == 'heading' && tokens[i].depth == 1) {
      break;
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
    if (tokens[i].type == 'heading' && tokens[i].depth == 1) {
      break
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


function setMarkdownRenderer(card, key, cardsByShortId) {
  var renderer = new marked.Renderer();
  marked.setOptions({
    renderer: renderer
  });

  // Custom link rendering to handle card links
  renderer.link = function (href, title, text) {
    var trelloURLFormat = /^https:\/\/trello\.com\/(b|c)\/([\w]{8})([\/\w-]+)?(#.*)?$/;
    var trelloURL = href.match(trelloURLFormat);

    // Link does not point to a card or a board
    if (trelloURL === null) {
      return renderLink(href, title, text);
    }

    // Link does not point to a card
    if (trelloURL[1] != 'c') {
      throw {
        name: 'UnresolvedTrelloLink',
        message: 'Link target is an unknown card',
        context: {
          id: card.id,
          title: card.title,
          key: key,
          href: href
        }
      };
    }

    // Link points to a card element (e.g., a comment or an action)
    if (trelloURL[4] && trelloURL[4] != '#') {
      console.log(trelloURL[4]);
      throw {
        name: 'UnsupportedTrelloLink',
        message: 'Link target is a card element',
        context: {
          id: card.id,
          title: card.title,
          key: key,
          href: href
        }
      };
    }

    // Link does not point to a valid card
    if (!cardsByShortId.hasOwnProperty(trelloURL[2])) {
      throw {
        name: 'UnresolvedTrelloLink',
        message: 'Link target is an unknown card',
        context: {
          id: card.id,
          title: card.title,
          key: key,
          href: href
        }
      };
    }

    var target = cardsByShortId[trelloURL[2]].card;
    if (text == href) {
      text = escape(target.title);
    }
    href = escape(options.linkTargetURL(card, key, target));
    if (href != '') {
      return renderLink(href, title, text);
    }
    else {
      return text;
    }
  }

  // Custom header rendering
  renderer.heading = function (text, level) {
    level = options.headerMap(card, key, level);

    // Header level is invalid
    if (level < 1 || level > 6) {
      throw {
        name: 'InvalidHeaderLevel',
        message: 'Header level is not in the range 1 to 6',
        context: {
          id: card.id,
          title: card.title,
          key: key,
          level: level
        }
      };
    }

    var textPlain = textFromHTML(text);
    var id = escape(options.headerId(card, key, textPlain));
    return renderHeader(level, id, text);
  }
}


function renderLink(href, title, text) {
  var html = '<a href="' + href + '"';
  if (title) {
    html += ' title="' + title + '"';
  }
  html += '>' + text + '</a>';
  return html;
}


function renderHeader(level, id, text) {
  var html = '<h' + level;
  if (id != '') {
    html += ' id="' + id + '"';
  }
  html += '>' + text + '</h1>\n';
  return html;
}


function renderMarkdown(tokens) {
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

options.headerMap = function (source, key, level) {
  return level - 1;
}

options.headerId = function (source, key, text) {
  var id = text.toLowerCase();
  id = id.replace(/[^\w]+/g, '-');
  id = id.replace(/-$/, '');
  id = id.replace(/^-/, '');
  return id;
}

options.linkTargetURL = function (source, key, target) {
  return '#' + target.id;
}


// Module interface
module.exports.get = get;
module.exports.options = options;