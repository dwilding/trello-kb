# Overview of Trello KB

Trello KB enables you to get a [Trello](https://trello.com) board as an array of content objects. The objects in the array correspond to the cards on the board.

For example, you could create a magazine in Trello, then use Trello KB to get a JSON version of each article:

![Trello card with JSON object](doc/food_magazine.jpg)

Trello KB is not affiliated with Trello or Atlassian in any way.

## Main Features

Trello KB converts each card on the board to a self-contained object. The conversion process has the following main features:

- **Markdown+YAML → HTML and nested objects.** Trello lets you [use a flavor of markdown to format card descriptions](http://help.trello.com/article/821-using-markdown-in-trello). Trello KB converts the card description to HTML and places the result in the `description` property.
  
  If the card description contains level 1 headers, Trello KB returns a separate property for each level 1 header. If the only content that follows a level 1 header is a code block, Trello KB assumes that the code block contains YAML, then converts the YAML to an object.
  
  For example, if the card description is:
  
  ``````text
  This is a **card**

  # More Details
  - More text
  - _Even more_ text

  # Custom Data
  ```
  key: value
  array:
  - one
  - two
  ```

  # Summary
  Summary text
  ``````
  
  Trello KB returns the following properties:
  
  ```text
  "description": "<p>This is a <strong>card</strong></p>",
  "more_details": "<ul>\n<li>More text</li>\n<li><em>Even more</em> text</li>\n</ul>",
  "custom_data": {
    "key": "value",
    "array": [
      "one",
      "two"
    ]
  },
  "summary": "<p>Summary text</p>"
  ```
  
  > **NOTE:** Trello KB does not support [MSON](https://github.com/apiaryio/mson).

- **Card links → object links.** If you enter the [URL of a card](http://help.trello.com/article/824-sharing-links-to-cards-and-boards) in the card description, Trello displays a dynamic card link. For example:
  
  ![Card link in a card description](doc/card_link.png)
  
  Trello KB converts card links to object links. For example, if you enter https://trello.com/c/7l47ZiYm in the card description, Trello KB produces the following object link:
  
  ```html
  <a href="#59f3d9f34c8b2c69fdbbf940">Make the perfect carrot cake</a>
  ```
  
  You should use the [linkTargetURL](#linktargeturl) option to customize the URLs of object links according to your needs.
  
  > **NOTE:** Trello KB only supports links to cards on the same board. Trello KB does not support links to comments, actions, or boards.

- **Labels → Booleans.** Trello lets you [add labels to cards](http://help.trello.com/article/797-adding-labels-to-cards). For each label on the board, Trello KB returns a Boolean property that indicates whether the card has the label.
  
  For example, if the card has a label called "Opinion Piece" and there is also an unnamed yellow label on the board, Trello KB returns the following properties:
  
  ```text
  "yellow": false,
  "opinion_piece": true
  ```

# Get a Board

## Prerequisites

- You must have [Node.js](https://nodejs.org) and the `trello-kb` module installed. To install the `trello-kb` module using [npm](https://www.npmjs.com/), run the following command:
  
  ```shell
  npm install trello-kb
  ```

- You must have a Trello account. If you do not have a Trello account, create an account at https://trello.com/signup. If you are building a Trello integration, Trello recommends that you create a Trello account specifically for your integration.
  
  You will need to provide Trello KB with the application key of your Trello account. To view the application key of your Trello account, visit https://trello.com/app-key.

- You will need to provide Trello KB with an authorization token for a Trello account that has access to the board. See [Authorization](https://developers.trello.com/page/authorization) for how to request an authorization token. The authorization token must include the `read` scope.
  
  If your Trello account has access to the board, the simplest way to obtain a suitable authorization token is to visit the following URL:
  
  ```text
  https://trello.com/1/authorize?key=APP_KEY&name=Test%20Integration&scope=read&expiration=never&response_type=token
  ```
  
  Replace `APP_KEY` by the application key of your Trello account.

- You will need to provide Trello KB with the ID of the board. You can obtain the ID from the URL of the board. For example, the ID of [this board](https://trello.com/b/dMFueFPQ/food-magazine) is "dMFueFPQ".

## Example

```javascript
const trelloKB = require('trello-kb');

// Replace this by the application key of your Trello account
var appKey = '4dee095cf22f1793eb435fdac9e9ebec';

// Replace this by a valid authorization token
var authToken = 'ca1dd89c602cb34e8558d9451cdc7727855e3803d885aeb7b671bd64ac7d6bea';

// Get the board https://trello.com/b/dMFueFPQ/food-magazine
trelloKB.get(appKey, authToken, 'dMFueFPQ').then(
  function (cards) {
    // Print the title of each card
    cards.forEach(function (card) {
      console.log(card.title);
    });
  },
  function (reason) {
    // If there were warnings, display each warning
    if (reason.name == 'BoardConversionWarnings') {
      reason.warnings.forEach(function (warning) {
        console.error(warning);
      });
    }
    // Otherwise, display the error message
    else {
      console.error(reason.message);
    }
  }
);
```

Output:

```text
Mushrooms: the definitive guide
New burger restaurant opens downtown
Shortage of ice cream causes panic across the city
Make the perfect carrot cake
How strawberries will transform the way you eat breakfast
```

See [doc/cards.json](doc/cards.json) for a JSON version of the `cards` array in this example.

# Card Object Reference

For each card on the board, Trello KB returns an object with the following properties:

| Property      | Description                                                                                                                                                                                                                                                                                                                                                                           |
|---------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `id`          | <p>The Trello ID of the card.</p><p>You can use the [shortCardIds](#shortcardids) option to control the format of this property.</p>                                                                                                                                                                                                                                                  |
| `title`       | <p>The card title.</p>                                                                                                                                                                                                                                                                                                                                                                |
| `list`        | <p>The name of the list that the card is in.</p>                                                                                                                                                                                                                                                                                                                                      |
| `cover`       | <p>The URL of the card cover.</p><p>Only available if [a cover image has been attached to the card](http://help.trello.com/article/769-adding-attachments-to-cards).</p><p>You can use the [getCovers](#getcovers) option to control whether Trello KB returns this property.</p>                                                                                                     |
| `date`        | <p>The due date of the card.</p><p>Only available if [a due date has been added to the card](http://help.trello.com/article/794-adding-due-dates-to-cards).</p>                                                                                                                                                                                                                       |
| `draft`       | <p>True if the card has a due date but the due date has not been marked as complete; false otherwise.</p>                                                                                                                                                                                                                                                                             |
| _label_       | <p>For each label on the board, a Boolean that indicates whether the card has the label. See [Main Features](#main-features).</p><p>You can use the [keyFromText](#keyfromtext) option to control how Trello KB converts label names to property names.</p>                                                                                                                           |
| `description` | <p>An HTML version of the card description that precedes level 1 headers. See [Main Features](#main-features).</p>                                                                                                                                                                                                                                                                    |
| _header_      | <p>For each level 1 header in the card description:</p><ul><li>an HTML version of the content that follows the header; or</li><li>the object described by the YAML code block that follows the header.</li></ul><p>See [Main Features](#main-features).</p><p>You can use the [keyFromText](#keyfromtext) option to control how Trello KB converts header text to property names.</p> |

You can use the [Trello REST API](https://developers.trello.com/v1.0/reference#cardsid) to get additional card details.

# Module Options

## getArchived

The `getArchived` option is a Boolean that specifies whether Trello KB gets archived cards. The default value is false, which means that Trello KB gets only the cards that are visible on the board.

To get all visible and archived cards:

```javascript
const trelloKB = require('trello-kb');

trelloKB.options.getArchived = true;
```

## getCovers

The `getCovers` option is a Boolean that specifies whether Trello KB gets the URLs of card covers. The default value is true, which means that if a cover image has been attached to a card, Trello KB returns the URL of the image in a property called `cover`.

To ignore card covers:

```javascript
const trelloKB = require('trello-kb');

trelloKB.options.getCovers = false;
```

## shortCardIds

The `shortCardIds` option is a Boolean that specifies whether Trello KB uses short IDs (e.g., "Xrf9TsE1") for card objects. The default value is false, which means that Trello KB uses long IDs (e.g., "59f3d975e68c2ace90bbc3c5") for card objects.

To use short IDs for card objects:

```javascript
const trelloKB = require('trello-kb');

trelloKB.options.shortCardIds = true;
```

## keyFromText

The `keyFromText` option is a function that specifies how Trello KB converts label names and header text to property names. The default function returns names that contain only lower case letters, digits, and underscores.

To disable conversion of label names and header text:

```javascript
const trelloKB = require('trello-kb');

trelloKB.options.keyFromText = function (text, type) {
  // text is a plain text string
  // type is either 'label' or 'header'
  return text;
};
```

> **NOTE:** Trello KB converts header text to plain text before applying `keyFromText`. To completely disable conversion for a particular header, surround the header text by backticks.

## headerMap

The `headerMap` option is a function that specifies how Trello KB handles level 2-6 headers in card descriptions. The default function maps level _N_ headers to level _N_ &minus; 1 headers, which means that level 2 headers in card descriptions become level 1 headers in the HTML that Trello KB returns.

To disable renumbering of headers:

```javascript
const trelloKB = require('trello-kb');

trelloKB.options.headerMap = function (source, key, level) {
  // source is the object that contains the header
  // key is the name of the property that contains the header
  // level is an integer in the range 2 to 6
  return level;
};
```

> **NOTE:** When Trello KB applies `headerMap`, some properties of the source object may be null. This limitation only applies to properties that should contain HTML, such as the `description` property.

## headerId

The `headerId` option is a function that specifies the IDs of headers in the HTML that Trello KB returns. The default function returns IDs that contain only lower case letters, digits, and hyphens.

To remove IDs from headers:

```javascript
const trelloKB = require('trello-kb');

trelloKB.options.headerId = function (source, key, text) {
  // source is the object that contains the header
  // key is the name of the property that contains the header
  // text is a plain text version of the header text
  return '';
};
```

> **NOTE:** When Trello KB applies `headerId`, some properties of the source object may be null. This limitation only applies to properties that should contain HTML, such as the `description` property.

## linkTargetURL

The `linkTargetURL` option is a function that specifies the URLs of object links in the HTML that Trello KB returns. The default function returns "#" followed by the value of the target object's `id` property.

To replace object links by their link text:

```javascript
const trelloKB = require('trello-kb');

trelloKB.options.linkTargetURL = function (source, key, target) {
  // source is the object that contains the link
  // key is the name of the property that contains the link
  // target is the object that the link points to
  return '';
};
```

> **NOTE:** When Trello KB applies `linkTargetURL`, some properties of the source and target objects may be null. This limitation only applies to properties that should contain HTML, such as the `description` properties.

## strictWarnings

The `strictWarnings` option is a Boolean that specifies whether Trello KB returns a rejected promise if warnings were generated during the conversion process. The default value is true, which means that Trello KB returns a rejected promise if any of the following conditions occur:

- A code block in a card description contains invalid YAML
- A card description contains a link to a comment, action, or board
- A card description contains a link to a card that Trello KB did not get
- [headerMap](#headermap) returns a level that is less than 1 or greater than 6
- [headerMap](#headermap), [headerId](#headerid), or [linkTargetURL](#linktargeturl) generates an error

To ignore these conditions:

```javascript
const trelloKB = require('trello-kb');

trelloKB.options.strictWarnings = false;
```
