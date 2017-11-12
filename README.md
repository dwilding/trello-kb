# Overview of Trello KB

Trello KB enables you to download a [Trello](https://trello.com) board as an array of reusable content objects. The objects in the array correspond to the cards on the board.

For example, you could produce a magazine in Trello, then use Trello KB to get a JSON version of each article:

![Trello card with JSON object](doc/food_magazine.jpg)

Trello KB is not affiliated with Trello or Atlassian in any way.

## Main Features

Trello KB converts each card on the board to a self-contained object. The conversion process has the following main features:

- **Markdown+YAML → JSON+HTML.** Trello lets you [use a flavor of markdown to format card descriptions](http://help.trello.com/article/821-using-markdown-in-trello). Trello KB converts the card description to HTML and places the result in the `description` property.
  
  If the card description contains level 1 headers, Trello KB creates a separate property for each level 1 header. If the only content following a level 1 header is a code block, Trello KB assumes that the code block contains YAML, then converts the YAML to JSON.
  
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
  
  Trello KB creates the following properties:
  
      "description": "<p>This is a <strong>card</strong></p>",
      "more_details": "<ul>\n<li>More text</li>\n<li><em>Even more</em> text</li>\n</ul>",
      "custom_data": {
        "key": "value",
        "array": [
          "one",
          "two"
        ]
      }
  
  > **NOTE:** Trello KB does not support [MSON](https://github.com/apiaryio/mson).

- **Labels → Booleans.** Trello lets you [add labels to cards](http://help.trello.com/article/797-adding-labels-to-cards). For each label on the board, Trello KB creates a boolean property that indicates whether the card has the label.
  
  For example, if the card has a label "Opinion Piece" and there is also an unnamed yellow label on the board, Trello KB creates the following properties:
  
      "yellow": false,
      "opinion_piece": true