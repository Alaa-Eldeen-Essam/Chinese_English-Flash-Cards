# API Specification (OpenAPI excerpt)

```yaml
openapi: 3.0.3
info:
  title: Simplified Chinese Flashcards API
  version: 0.1.0
servers:
  - url: http://localhost:8000
paths:
  /health:
    get:
      summary: Health check
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Health"
  /cards:
    get:
      summary: List flashcards
      responses:
        "200":
          description: Flashcard list
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Flashcard"
    post:
      summary: Create a new flashcard
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/FlashcardCreate"
      responses:
        "200":
          description: Flashcard created
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Flashcard"
  /reviews:
    post:
      summary: Submit a review rating and update scheduling
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/ReviewCreate"
      responses:
        "200":
          description: Updated flashcard
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Flashcard"
components:
  schemas:
    Health:
      type: object
      properties:
        status:
          type: string
          example: ok
    Flashcard:
      type: object
      properties:
        id:
          type: integer
        hanzi:
          type: string
        pinyin:
          type: string
        english:
          type: string
        ease_factor:
          type: number
        interval_days:
          type: integer
        repetition:
          type: integer
        due_at:
          type: string
          format: date-time
    FlashcardCreate:
      type: object
      required: [hanzi, pinyin, english]
      properties:
        hanzi:
          type: string
        pinyin:
          type: string
        english:
          type: string
        ease_factor:
          type: number
          default: 2.5
        interval_days:
          type: integer
          default: 0
        repetition:
          type: integer
          default: 0
        due_at:
          type: string
          format: date-time
    ReviewCreate:
      type: object
      required: [card_id, rating]
      properties:
        card_id:
          type: integer
        rating:
          type: integer
          minimum: 0
          maximum: 5
```
