'use strict';


// Module dependencies
const Trello = require('node-trello');
const marked = require('marked');
const textFromHTML = require('html2plaintext');
const escape = require('escape-html');
const loadYAML = require('js-yaml').load;


class Converter {
  constructor(appKey, authToken, boardId) {
    this.api = new Trello(appKey, authToken);
    this.boardId = boardId;
    this.lexer = new marked.Lexer({
      gfm: true,
      breaks: true,
      tables: false
    });
    this.parser = new marked.Parser({
      gfm: true,
      breaks: true,
      tables: false
    });
    this.options = Converter.defaultOptions;
  }

  convert() {
    return new Promise((resolvePromise, rejectPromise) => {

      // Trello API requests
      var requests = [];
      requests.push(this.getLists());
      requests.push(this.getLabels());
      requests.push(this.getCards());

      // After all requests have completed
      Promise.all(requests).then((responses) => {
        var lists = responses[0];
        var labels = responses[1];
        var cards = responses[2];
        var subRequests = [];
        var cardShortIds = [];
        var cardsByShortId = {};
        var results = [];

        // FIRST PASS: cards --> cardsByShortId
        // Get cards by short identifier, with unparsed tokens instead of HTML
        cards.forEach((card) => {
          var obj = {
            id: card.id,
            title: card.name,
            list: lists[card.idList]
          };
          if (card.idAttachmentCover !== null) {
            subRequests.push(this.addCardCover(card, obj));
          }
          if (card.due !== null) {
            obj.date = card.due;
            obj.draft = !card.dueComplete;
          }
          else {
            obj.draft = false;
          }
          labels.forEach((label) => {
            obj[label.name] = (card.idLabels.indexOf(label.id) != -1);
          });
          cardShortIds.push(card.shortLink);
          cardsByShortId[card.shortLink] = {
            card: obj,
            tokens: {}
          };
          try {
            this.addProperties(
              cardsByShortId[card.shortLink],
              card.desc
            );
          }
          catch (error) {
            rejectPromise(error);
            return;
          }
        });

        // SECOND PASS: cardsByShortId --> results
        // Build an array of cards and convert unparsed tokens to HTML
        Promise.all(subRequests).then(() => {
          cardShortIds.forEach((cardShortId) => {
            var result = cardsByShortId[cardShortId];
            Object.keys(result.tokens).forEach((key) => {
              var renderer = this.customMarkdownRenderer(
                result.card,
                key,
                cardsByShortId
              );
              var parser = new marked.Parser({
                gfm: true,
                breaks: true,
                tables: false,
                renderer: renderer
              });
              try {
                var html = parser.parse(result.tokens[key]);
              }
              catch (error) {
                rejectPromise(error);
                return;
              }
              result.card[key] = html.replace(/\n+$/, '');
            });
            results.push(result.card);
          });
          resolvePromise(results);
        }, (reason) => {
          rejectPromise(reason);
        });

      // Could not complete a request
      }, (reason) => {
        rejectPromise(reason);
      });
    });
  }

  getCards() {
    return new Promise((resolvePromise, rejectPromise) => {
      var filter = 'visible';
      if (this.options.getArchived) {
        filter = 'all';
      }
      var apiEndpoint = '/1/boards/' + this.boardId + '/cards/' + filter
      + '?fields=id,shortLink,idList,idAttachmentCover,name,due,dueComplete,idLabels,desc';
      this.api.get(apiEndpoint, (error, cards) => {
        if (error) {
          rejectPromise(error);
          return;
        }
        resolvePromise(cards);
      });
    });
  }

  addCardCover(card, obj) {
    return new Promise((resolvePromise, rejectPromise) => {
      var apiEndpoint = '/1/cards/' + card.id
      + '/attachments/' + card.idAttachmentCover + '?fields=id,url';
      this.api.get(apiEndpoint, (error, attachment) => {
        if (error) {
          rejectPromise(error);
          return;
        }
        obj.cover = attachment.url;
        resolvePromise();
      });
    });
  }

  getLabels() {
    return new Promise((resolvePromise, rejectPromise) => {
      var apiEndpoint = '/1/boards/' + this.boardId
      + '/labels?fields=id,name,color';
      this.api.get(apiEndpoint, (error, labels) => {
        if (error) {
          rejectPromise(error);
          return;
        }
        labels.forEach((label) => {
          if (label.name != '') {
            label.name = this.options.keyFromText(label.name, 'label');
          }
          else {
            label.name = label.color;
          }
        });
        resolvePromise(labels);
      });
    });
  }

  getLists() {
    return new Promise((resolvePromise, rejectPromise) => {
      var hash = {};
      var filter = 'open';
      if (this.options.getArchived) {
        filter = 'all';
      }
      var apiEndpoint = '/1/boards/' + this.boardId + '/lists/' + filter
      + '?fields=id,name';
      this.api.get(apiEndpoint, (error, lists) => {
        if (error) {
          rejectPromise(error);
          return;
        }
        lists.forEach((list) => {
          hash[list.id] = list.name;
        });
        resolvePromise(hash);
      });
    });
  }

  addProperties(result, markdown) {
    var tokens = this.lexer.lex(markdown);
    result.card.description = null;
    result.tokens.description = this.getDescription(tokens);
    var property;
    while (tokens.length > 0) {
      property = this.getProperty(tokens);
      if (property.parsed) {
        result.card[property.key] = property.value;
      }
      else {
        result.card[property.key] = null;
        result.tokens[property.key] = property.value;
      }
    }
  }

  getDescription(tokens) {
    for (var i = 0; i < tokens.length; i++) {
      if (tokens[i].type == 'heading' && tokens[i].depth == 1) {
        break;
      }
    }
    var descriptionTokens = tokens.splice(0, i);
    descriptionTokens.links = tokens.links;
    return descriptionTokens;
  }

  getProperty(tokens) {
    var headingTokens = tokens.splice(0, 1);
    headingTokens.links = tokens.links;
    var key = this.keyFromHeading(headingTokens);
    for (var i = 0; i < tokens.length; i++) {
      if (tokens[i].type == 'heading' && tokens[i].depth == 1) {
        break;
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

  keyFromHeading(tokens) {
    var markdown = tokens[0].text;
    var matchesCode = markdown.match(/^`([^`]+)`$/);
    if (matchesCode !== null) {
      return matchesCode[1];
    }
    else {
      var html = this.parser.parse(tokens);
      var text = textFromHTML(html);
      return this.options.keyFromText(text, 'header');
    }
  }

  customMarkdownRenderer(card, key, cardsByShortId) {
    var renderer = new marked.Renderer();

    // Custom link rendering to handle card links
    renderer.link = (href, title, text) => {
      var trelloURLFormat = /^https:\/\/trello\.com\/(b|c)\/([\w]{8})([\/\w-]+)?(#.*)?$/;
      var trelloURL = href.match(trelloURLFormat);

      // Link does not point to a card or a board
      if (trelloURL === null) {
        return Converter.renderLink(href, title, text);
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
      href = escape(this.options.linkTargetURL(card, key, target));
      if (href != '') {
        return Converter.renderLink(href, title, text);
      }
      else {
        return text;
      }
    }

    // Custom header rendering
    renderer.heading = (text, level) => {
      level = this.options.headerMap(card, key, level);

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
      var id = escape(this.options.headerId(card, key, textPlain));
      return Converter.renderHeader(level, id, text);
    }

    return renderer;
  }

  static renderLink(href, title, text) {
    var html = '<a href="' + href + '"';
    if (title) {
      html += ' title="' + title + '"';
    }
    html += '>' + text + '</a>';
    return html;
  }

  static renderHeader(level, id, text) {
    var html = '<h' + level;
    if (id != '') {
      html += ' id="' + id + '"';
    }
    html += '>' + text + '</h1>\n';
    return html;
  }

  static get defaultOptions() {
    var options = {};

    // By default, only get the cards that are visible on the board
    options.getArchived = false;

    // Specifies how to convert label names and header text to property names
    options.keyFromText = (text, type) => {
      var key = text.toLowerCase();
      key = key.replace(/[^\w]+/g, '_');
      key = key.replace(/_$/, '');
      key = key.replace(/^[_\d]*/, '');
      if (key == '') {
        key = '_';
      }
      return key;
    }

    // Specifies how to handle level 2-6 headers in card descriptions
    options.headerMap = (source, key, level) => {
      return level - 1;
    }

    // Specifies the IDs of headers in the HTML output
    options.headerId = (source, key, text) => {
      var id = text.toLowerCase();
      id = id.replace(/[^\w]+/g, '-');
      id = id.replace(/-$/, '');
      id = id.replace(/^-/, '');
      return id;
    }

    // Specifies the URLs of object links in the HTML output
    options.linkTargetURL = (source, key, target) => {
      return '#' + target.id;
    }

    return options;
  }
}


// Module interface
module.exports.Converter = Converter;
module.exports.options = Converter.defaultOptions;
module.exports.get = (appKey, authToken, boardId) => {
  var converter = new Converter(
    appKey,
    authToken,
    boardId
  );
  converter.options = module.exports.options;
  return converter.convert();
}
