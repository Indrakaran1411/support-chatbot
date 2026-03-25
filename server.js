require('dotenv').config();
const express    = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors       = require('cors');
const path       = require('path');

// 👇 ADDED: Google Gemini AI Import 👇
const { GoogleGenerativeAI } = require('@google/generative-ai');

// 👇 ADDED: Network Bug Fix 👇
const dns = require('node:dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────────────────────────────
//  CONFIG  –  set these in .env or environment
// ─────────────────────────────────────────────────────────────
const MONGO_URI   = process.env.MONGO_URI;          
const DB_NAME     = process.env.DB_NAME     || 'support_bot';
const FAQ_COL     = 'faqs';                          
const CHAT_COL    = 'chat_sessions';                 
const PORT        = process.env.PORT        || 3000;

if (!MONGO_URI) {
  console.error('❌  MONGO_URI is not set. Please add it to your .env file.');
  process.exit(1);
}

// 👇 ADDED: Initialize Gemini AI 👇
let genAI;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
} else {
  console.warn('⚠️  GEMINI_API_KEY is not set in .env. General AI questions will not work.');
}

// ─────────────────────────────────────────────────────────────
//  CONNECT TO MONGODB ATLAS
// ─────────────────────────────────────────────────────────────
let db;
let client;

async function connectAtlas() {
  try {
    client = new MongoClient(MONGO_URI, {
      tls: true,
      serverSelectionTimeoutMS: 5000,
    });
    await client.connect();
    db = client.db(DB_NAME);

    // Create text index on FAQ collection for full-text search
    await db.collection(FAQ_COL).createIndex(
      { question: 'text', keywords: 'text', answer: 'text' },
      { weights: { question: 10, keywords: 5, answer: 1 }, name: 'faq_text_index' }
    );

    console.log(`✅  Connected to MongoDB Atlas  →  ${DB_NAME}`);

    // Seed FAQ data if empty
    const count = await db.collection(FAQ_COL).countDocuments();
    if (count === 0) await seedFAQs();

  } catch (err) {
    console.error('❌  Atlas connection failed:', err.message);
    process.exit(1);
  }
}

// 👇 ADDED: Helper to escape regex special characters (Security Fix) 👇
function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

// ─────────────────────────────────────────────────────────────
//  SEED: Customer Support FAQs
// ─────────────────────────────────────────────────────────────
async function seedFAQs() {
  const faqs = [
    {
      category: 'Account',
      question: 'How do I reset my password?',
      keywords: ['password', 'reset', 'forgot', 'login', 'sign in', 'access', 'locked'],
      answer: "To reset your password:\n1. Go to the login page and click **Forgot Password**\n2. Enter your registered email address\n3. Check your inbox for a reset link (valid for 30 minutes)\n4. Click the link and create a new password\n\nStill locked out? Contact us at **support@company.com**",
      helpful: 0,
      notHelpful: 0,
      createdAt: new Date()
    },
    {
      category: 'Account',
      question: 'How do I update my email address?',
      keywords: ['email', 'update', 'change', 'account', 'profile', 'address'],
      answer: "To change your email:\n1. Log in and go to **Account Settings → Profile**\n2. Click **Edit** next to your email address\n3. Enter your new email and confirm with your password\n4. A verification link will be sent to the new address\n\nNote: Your old email stays active until you verify the new one.",
      helpful: 0,
      notHelpful: 0,
      createdAt: new Date()
    },
    {
      category: 'Billing',
      question: 'How do I cancel my subscription?',
      keywords: ['cancel', 'subscription', 'unsubscribe', 'stop', 'end', 'billing', 'plan'],
      answer: "To cancel your subscription:\n1. Go to **Account → Billing → Manage Subscription**\n2. Click **Cancel Plan**\n3. Select a cancellation reason (optional)\n4. Confirm cancellation\n\nYou'll retain access until the end of your current billing period. We don't offer pro-rated refunds for partial months. Need help? Chat with us anytime.",
      helpful: 0,
      notHelpful: 0,
      createdAt: new Date()
    },
    {
      category: 'Billing',
      question: 'What payment methods do you accept?',
      keywords: ['payment', 'pay', 'credit card', 'debit', 'paypal', 'invoice', 'billing', 'method'],
      answer: "We accept the following payment methods:\n- 💳 **Visa, Mastercard, Amex, Discover**\n- 🔵 **PayPal**\n- 🏦 **Bank transfer / ACH** (Enterprise plans only)\n- 📄 **Invoice billing** (annual plans only)\n\nAll payments are securely processed via **Stripe**. We do not store card numbers on our servers.",
      helpful: 0,
      notHelpful: 0,
      createdAt: new Date()
    },
    {
      category: 'Billing',
      question: 'Can I get a refund?',
      keywords: ['refund', 'money back', 'charge', 'dispute', 'overcharged', 'return'],
      answer: "Our refund policy:\n- **New customers**: Full refund within **14 days** of first purchase, no questions asked.\n- **Renewals**: Refunds are reviewed case-by-case within 7 days of renewal.\n- **Annual plans**: Pro-rated refunds available within 30 days.\n\nTo request a refund, email **billing@company.com** with your order ID. Refunds process in **5–10 business days**.",
      helpful: 0,
      notHelpful: 0,
      createdAt: new Date()
    },
    {
      category: 'Technical',
      question: 'The app is not loading or very slow',
      keywords: ['slow', 'loading', 'not working', 'broken', 'crash', 'error', 'bug', 'down', 'freeze'],
      answer: "Try these steps to fix loading issues:\n1. **Hard refresh**: Press `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)\n2. **Clear cache**: Browser Settings → Clear browsing data\n3. **Try incognito mode** to rule out extension conflicts\n4. **Check status**: Visit **status.company.com** for outages\n5. **Switch browser**: Try Chrome or Firefox\n\nIf the issue persists, email **tech@company.com** with a screenshot.",
      helpful: 0,
      notHelpful: 0,
      createdAt: new Date()
    },
    {
      category: 'Technical',
      question: 'How do I export my data?',
      keywords: ['export', 'download', 'data', 'backup', 'csv', 'pdf', 'report', 'extract'],
      answer: "To export your data:\n1. Go to **Settings → Data & Privacy**\n2. Click **Export My Data**\n3. Select the format: **CSV**, **JSON**, or **PDF**\n4. Choose a date range (optional)\n5. Click **Generate Export** — you'll get a download link via email within 10 minutes.\n\nLarge exports may take up to 1 hour. Exports are available for 48 hours after generation.",
      helpful: 0,
      notHelpful: 0,
      createdAt: new Date()
    },
    {
      category: 'Orders',
      question: 'Where is my order? How do I track it?',
      keywords: ['order', 'track', 'tracking', 'shipping', 'delivery', 'where', 'status', 'shipped'],
      answer: "To track your order:\n1. Check your confirmation email for a **tracking number**\n2. Visit **Track Order** on our website and enter your order number\n3. Or log in → **Orders → View Details**\n\nTypical delivery times:\n- Standard shipping: **5–7 business days**\n- Express shipping: **2–3 business days**\n- Overnight: **Next business day**\n\nFor missing packages, contact us after the estimated delivery date.",
      helpful: 0,
      notHelpful: 0,
      createdAt: new Date()
    },
    {
      category: 'Orders',
      question: 'How do I return or exchange a product?',
      keywords: ['return', 'exchange', 'swap', 'wrong item', 'damaged', 'broken', 'product'],
      answer: "Our return & exchange process:\n1. Go to **Orders → Request Return** within **30 days** of delivery\n2. Select the item(s) and reason\n3. Print the prepaid return label (emailed to you)\n4. Drop the package at any courier location\n\nRefunds are issued within **7 business days** of receiving the return. Exchanges ship within **2 business days**. Items must be unused and in original packaging.",
      helpful: 0,
      notHelpful: 0,
      createdAt: new Date()
    },
    {
      category: 'General',
      question: 'How do I contact support?',
      keywords: ['contact', 'support', 'help', 'reach', 'human', 'agent', 'talk', 'call', 'phone', 'email'],
      answer: "You can reach our support team through:\n- 💬 **Live Chat**: Available on this page (Mon–Fri, 9am–6pm EST)\n- 📧 **Email**: support@company.com (reply within 24 hours)\n- 📞 **Phone**: +1-800-555-0123 (Mon–Fri, 9am–5pm EST)\n- 🌐 **Help Center**: help.company.com\n\nFor urgent issues, live chat is the fastest option!",
      helpful: 0,
      notHelpful: 0,
      createdAt: new Date()
    },
    {
      category: 'General',
      question: 'What are your business hours?',
      keywords: ['hours', 'business hours', 'open', 'available', 'when', 'time', 'schedule', 'weekend'],
      answer: "Our support team is available:\n- **Live Chat & Phone**: Monday–Friday, 9am–6pm EST\n- **Email**: 24/7 (we respond within 24 hours)\n- **Help Center**: Always available at help.company.com\n\nWe're closed on **US Federal holidays**. During peak seasons, wait times may be longer — email is the best option then.",
      helpful: 0,
      notHelpful: 0,
      createdAt: new Date()
    },
  ];

  await db.collection(FAQ_COL).insertMany(faqs);
  console.log(`🌱  Seeded ${faqs.length} FAQ documents into MongoDB Atlas`);
}

// ─────────────────────────────────────────────────────────────
//  SEARCH MONGODB ATLAS (UPDATED & STRICTER)
// ─────────────────────────────────────────────────────────────
async function searchFAQ(userMessage) {
  const msg = userMessage.toLowerCase().trim();

  // 1. Full-text search with a Confidence Score check
  let results = await db.collection(FAQ_COL)
    .find(
      { $text: { $search: msg } }, 
      { projection: { score: { $meta: 'textScore' }, category: 1, question: 1, answer: 1 } }
    )
    .sort({ score: { $meta: 'textScore' } })
    .limit(1)
    .toArray();

  // ONLY return the database answer if the match score is high (> 1.5)
  // Otherwise, it's a weak match and we should let Gemini AI handle it!
  if (results.length > 0 && results[0].score > 1.5) {
    return { faq: results[0], method: 'full-text' };
  }

  return null; // Passes the question to Gemini
}

// ─────────────────────────────────────────────────────────────
//  ROUTES
// ─────────────────────────────────────────────────────────────

// ── CHAT (Hybrid MongoDB + Gemini AI) ────────────────────────
app.post('/api/chat', async (req, res) => {
  const { message, sessionId } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'message required' });

  try {
    const result = await searchFAQ(message.trim());
    const sid    = sessionId || new ObjectId().toString();
    const timestamp = new Date();

    let response;
    
    // 1. IF FOUND IN MONGODB -> Answer from Database
    if (result) {
      response = {
        answer:    result.faq.answer,
        category:  result.faq.category,
        question:  result.faq.question,
        faqId:     result.faq._id,
        method:    result.method,
        matched:   true,
        sessionId: sid,
      };
    } 
    // 👇 ADDED: 2. IF NOT IN MONGODB -> Ask Google Gemini AI! 👇
    else if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `You are a helpful customer support and general knowledge assistant. A user asked: "${message.trim()}". Please provide a helpful, friendly, and concise answer.`;
        
        const aiResult = await model.generateContent(prompt);
        const aiText = aiResult.response.text();

        response = {
          answer:    aiText,
          category:  'General AI',
          matched:   true, 
          method:    'gemini-ai',
          sessionId: sid,
        };
      } catch (aiError) {
        console.error('Gemini Error:', aiError);
        response = {
          answer:    "I'm sorry, my AI brain is currently experiencing a glitch. Please try again later! 😔",
          category:  'Error',
          matched:   false,
          sessionId: sid,
        };
      }
    } 
    // 3. Fallback if Gemini fails or isn't set up
    else {
      response = {
        answer:    "I'm sorry, I couldn't find an answer for that in our knowledge base. 😔\n\nYou can:\n- Try rephrasing your question\n- Browse our **Help Center** at help.company.com\n- Contact a human agent via **Live Chat** or email **support@company.com**",
        category:  'Unmatched',
        matched:   false,
        sessionId: sid,
      };
    }

    // Persist chat turn to MongoDB Atlas
    await db.collection(CHAT_COL).insertOne({
      sessionId: sid,
      userMessage: message.trim(),
      botAnswer: response.answer,
      category: response.category,
      matched: response.matched,
      faqId: response.faqId || null,
      timestamp,
    });

    res.json(response);
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── FEEDBACK (thumbs up/down on answers) ──────────────────────
app.post('/api/feedback', async (req, res) => {
  const { faqId, helpful } = req.body;
  if (!faqId) return res.status(400).json({ error: 'faqId required' });
  
  // Security fix for invalid ObjectIds
  if (!ObjectId.isValid(faqId)) return res.status(400).json({ error: 'Invalid format for faqId' });

  try {
    const field = helpful ? 'helpful' : 'notHelpful';
    await db.collection(FAQ_COL).updateOne(
      { _id: new ObjectId(faqId) },
      { $inc: { [field]: 1 } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── FAQ LIST ───────────────────────────────────────────────────
app.get('/api/faqs', async (req, res) => {
  const { category } = req.query;
  const filter = category ? { category } : {};
  const faqs = await db.collection(FAQ_COL)
    .find(filter, { projection: { _id: 1, category: 1, question: 1, keywords: 1 } })
    .sort({ category: 1 })
    .toArray();
  res.json(faqs);
});

// ── STATUS ─────────────────────────────────────────────────────
app.get('/api/status', async (req, res) => {
  const faqCount  = await db.collection(FAQ_COL).countDocuments();
  const chatCount = await db.collection(CHAT_COL).countDocuments();
  res.json({
    status:    'connected',
    provider:  'MongoDB Atlas',
    database:  DB_NAME,
    faqCount,
    chatCount,
  });
});

// ── SERVE FRONTEND ─────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─────────────────────────────────────────────────────────────
//  START & SHUTDOWN
// ─────────────────────────────────────────────────────────────
connectAtlas().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀  Support Chatbot  →  http://localhost:${PORT}`);
  });
  
  // Graceful Shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down server...');
    if (client) {
      await client.close();
      console.log('🔌 MongoDB connection closed.');
    }
    process.exit(0);
  });
});