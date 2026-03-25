# 🤖 MongoDB Atlas Support Chatbot

A customer-support chatbot that queries a **MongoDB Atlas** knowledge base (FAQs) using full-text search + keyword matching, with **Gemini AI** as a fallback for general questions.

---

## 🗂 Project Structure

```
support-chatbot/
├── server.js           ← Express backend (Atlas connection + API routes)
├── package.json
├── .env.example        ← Copy to .env and fill in your credentials
├── public/
│   └── index.html      ← Chat UI served by Express
└── README.md
```

---

## ⚙️ Setup Instructions

### Step 1 — Clone the repo

```bash
git clone <your-repo-url>
cd support-chatbot
```

### Step 2 — Install dependencies

```bash
npm install
```

### Step 3 — Create your .env file

**On Mac/Linux:**
```bash
cp .env.example .env
```

**On Windows (CMD):**
```cmd
copy .env.example .env
```

Then open `.env` and fill in your credentials:

```env
MONGO_URI=your_mongodb_atlas_connection_string_here
GEMINI_API_KEY=your_gemini_api_key_here
```

---

## 🍃 MongoDB Atlas Setup

### 1. Create a free cluster
1. Go to https://cloud.mongodb.com
2. Create a free **M0** cluster (choose any region)

### 2. Get your connection string
1. Click **Connect → Drivers**
2. Copy the connection string:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```
3. Replace `<username>` and `<password>` with your DB user credentials

### 3. Allow network access
- In Atlas: **Network Access → Add IP Address → Allow Access from Anywhere** (for dev)

---

## 🔮 Gemini AI Setup

1. Go to https://aistudio.google.com/app/apikey
2. Sign in with your Google account
3. Click **Create API Key**
4. Copy the key and paste it into your `.env` file as `GEMINI_API_KEY`

> **Note:** Make sure you use model `gemini-2.5-flash` in `server.js` (line 245). Older models like `gemini-1.5-flash` are no longer supported.

---

## 🚀 Running the App

```bash
npm start
```

Open **http://localhost:3000** in your browser.

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
| 4th  | **Gemini AI fallback** | Gemini 2.5 Flash answers general questions not in the FAQ |

---

## 🔎 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Send message → get answer from Atlas or Gemini |
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

Insert a document into the `faqs` collection in Atlas:

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

---

## 🔒 Security Notes

- Never commit your `.env` file — it is listed in `.gitignore`
- Use `.env.example` as a template for others to follow
- Rotate your API keys periodically
- For production, restrict MongoDB network access to specific IPs only

---

## 🛠 Troubleshooting

| Problem | Fix |
|---------|-----|
| `MONGO_URI is not set` | Make sure `.env` exists with correct key name `MONGO_URI` |
| `GEMINI_API_KEY` error | Check for spaces around the `=` sign in `.env` |
| Gemini model not found | Use `gemini-2.5-flash` in `server.js` line 245 |
| MongoDB connection fails | Check Atlas network access and credentials |
| `Cannot find module` | Run `npm install` |
