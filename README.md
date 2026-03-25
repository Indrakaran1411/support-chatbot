# 🛟 MongoDB Atlas Support Chatbot

A customer-support chatbot that queries a **MongoDB Atlas** knowledge base (FAQs) using full-text search + keyword matching.

---

## 🗂 Project Structure

```
support-chatbot/
├── server.js           ← Express backend (Atlas connection + API routes)
├── package.json
├── .env.example        ← Copy to .env and fill in your Atlas URI
├── public/
│   └── index.html      ← Chat UI served by Express
└── README.md
```

---

## 🍃 MongoDB Atlas Setup (5 minutes)

### Step 1 — Create a free cluster
1. Go to https://cloud.mongodb.com
2. Create a free **M0** cluster (choose any region)

### Step 2 — Get your connection string
1. Click **Connect** → **Drivers**
2. Copy the connection string:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
3. Replace `<username>` and `<password>` with your DB user credentials

### Step 3 — Allow network access
- In Atlas: **Network Access** → **Add IP Address** → **Allow Access from Anywhere** (for dev)

---

## 🚀 Running the App

```bash
# 1. Install dependencies
npm install

# 2. Create your .env file
cp .env.example .env
# Edit .env and paste your Atlas connection string

# 3. Start the server
npm start

# Open http://localhost:3000
```

On first run, **11 FAQ documents** are automatically seeded into your Atlas collection.

---

## 🍃 MongoDB Collections

### `faqs` — Knowledge Base
```json
{
  "_id": "ObjectId",
  "category": "Billing",
  "question": "Can I get a refund?",
  "keywords": ["refund", "money back", "charge", "dispute"],
  "answer": "Our refund policy: ...",
  "helpful": 5,
  "notHelpful": 1,
  "createdAt": "ISODate"
}
```

### `chat_sessions` — Chat History
```json
{
  "_id": "ObjectId",
  "sessionId": "string",
  "userMessage": "How do I get a refund?",
  "botAnswer": "Our refund policy: ...",
  "category": "Billing",
  "matched": true,
  "faqId": "ObjectId",
  "timestamp": "ISODate"
}
```

---

## 🔍 Search Strategy

The backend uses a **3-tier search** against MongoDB Atlas:

| Tier | Method | How |
|------|--------|-----|
| 1st  | **Full-text search** | MongoDB `$text` index on question + keywords + answer |
| 2nd  | **Keyword array match** | `$elemMatch` on the `keywords` array |
| 3rd  | **Partial/regex match** | Substring regex on question and answer |

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Send message → get answer from Atlas |
| `GET`  | `/api/faqs` | List all FAQs (with optional `?category=Billing`) |
| `POST` | `/api/feedback` | Submit 👍/👎 on an answer |
| `GET`  | `/api/status` | Atlas connection status + document counts |

### POST `/api/chat`
```json
// Request
{ "message": "How do I get a refund?", "sessionId": "optional-session-id" }

// Response
{
  "answer": "Our refund policy: ...",
  "category": "Billing",
  "question": "Can I get a refund?",
  "faqId": "65a1b2c3d4e5f6a7b8c9d0e1",
  "method": "full-text",
  "matched": true,
  "sessionId": "abc123"
}
```

---

## ➕ Adding More FAQs

Simply insert a document into the `faqs` collection in Atlas:

```js
db.faqs.insertOne({
  category: "Shipping",
  question: "Do you ship internationally?",
  keywords: ["international", "ship", "worldwide", "country", "overseas"],
  answer: "Yes! We ship to 50+ countries. Standard international shipping takes 7–14 business days.",
  helpful: 0,
  notHelpful: 0,
  createdAt: new Date()
})
```

No code changes or restarts needed — the chatbot queries Atlas live on every request.
