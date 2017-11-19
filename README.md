# Overview of Trello KB

Trello KB enables you to download a [Trello](https://trello.com) board as an array of reusable content objects. The objects in the array correspond to the cards on the board.

For example, you could create a magazine in Trello, then use Trello KB to get a JSON version of each article:

![Trello card with JSON object](doc/food_magazine.jpg)

Trello KB is not affiliated with Trello or Atlassian in any way.

## Main Features

Trello KB converts each card on the board to a self-contained object. The conversion process has the following main features:

- **Markdown+YAML → HTML and nested objects.** Trello lets you [use a flavor of markdown to format card descriptions](http://help.trello.com/article/821-using-markdown-in-trello). Trello KB converts the card description to HTML and places the result in the `description` property.
  
  If the card description contains level 1 headers, Trello KB returns a separate property for each level 1 header. If the only content that follows a level 1 header is a code block, Trello KB assumes that the code block contains YAML, then converts the YAML to an object.
  
  For example, if the card description is:
  
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
  
  Trello KB returns the following properties:
  
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
  
  > **NOTE:** Trello KB does not support [MSON](https://github.com/apiaryio/mson).

- **Labels → Booleans.** Trello lets you [add labels to cards](http://help.trello.com/article/797-adding-labels-to-cards). For each label on the board, Trello KB returns a Boolean property that indicates whether the card has the label.
  
  For example, if the card has a label called "Opinion Piece" and there is also an unnamed yellow label on the board, Trello KB returns the following properties:
  
      "yellow": false,
      "opinion_piece": true

# Card Object Reference
For each card on the board, Trello KB returns an object with the following properties:

| Property      | Description |
|---------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `id`          | <p>The Trello ID of the card.</p>                                                                                                                                                                                                                                                                                                                                       |
| `title`       | <p>The card title.</p>                                                                                                                                                                                                                                                                                                                                                  |
| `list`        | <p>The name of the list that the card is in.</p>                                                                                                                                                                                                                                                                                                                        |
| `cover`       | <p>The URL of the card cover.</p><p>Only available if [a cover image has been attached to the card](http://help.trello.com/article/769-adding-attachments-to-cards).</p>                                                                                                                                                                                                |
| `date`        | <p>The due date of the card.</p><p>Only available if [a due date has been added to the card](http://help.trello.com/article/794-adding-due-dates-to-cards).</p>                                                                                                                                                                                                         |
| `draft`       | <p>True if the card has a due date but the due date has not been marked as complete; false otherwise.</p>                                                                                                                                                                                                                                                               |
| _label_       | <p>For each label on the board, a Boolean that indicates whether the card has the label. See [Main Features](#main-features).</p><p>You can use the `keyFromText` option to control how Trello KB converts label names to property names.</p>                                                                                                                           |
| `description` | <p>An HTML version of the card description that precedes level 1 headings. See [Main Features](#main-features).</p>                                                                                                                                                                                                                                                     |
| _header_      | <p>For each level 1 header in the card description:</p><ul><li>an HTML version of the content that follows the header; or</li><li>an object corresponsing to the YAML code block following the header.</li></ul><p>See [Main Features](#main-features).</p><p>You can use the `keyFromText` option to control how Trello KB converts header text to property names.</p> |

You can use the [Trello REST API](https://developers.trello.com/v1.0/reference#cardsid) to get additional card details.