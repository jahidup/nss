require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { z } = require('zod');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Security and utility middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com", "https://maps.gstatic.com", "https://maps.googleapis.com"],
      connectSrc: ["'self'"],
      frameSrc: ["'self'", "https://www.google.com"]
    }
  }
}));

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));
app.use(cookieParser());

// Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests from this IP. Please try again later.' }
});
app.use('/api/', globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' }
});

// Configure Cloudinary
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

// Multer in-memory storage for file handling
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Cache database connection for Vercel Serverless
let cachedDb = null;
async function connectToDatabase() {
  if (cachedDb) return cachedDb;
  if (!process.env.MONGODB_URI) {
    console.error('CRITICAL: MONGODB_URI is not set in environment variables.');
    throw new Error('Database configuration missing');
  }
  const db = await mongoose.connect(process.env.MONGODB_URI);
  cachedDb = db;
  console.log('Successfully connected to MongoDB database.');
  return db;
}

// ---------------- DATABASE MODELS ----------------

const InquirySchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true },
  mobile: { type: String, required: true, trim: true },
  subject: { type: String, required: true, trim: true },
  message: { type: String, required: true },
  status: { type: String, enum: ['new', 'contacted', 'closed'], default: 'new' },
  createdAt: { type: Date, default: Date.now }
});
InquirySchema.index({ status: 1, createdAt: -1 });
const Inquiry = mongoose.model('Inquiry', InquirySchema);

const AILeadSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  class: { type: String, required: true, trim: true },
  interest: { type: String, required: true },
  phone: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
  parentName: { type: String, trim: true, default: '' },
  email: { type: String, trim: true, default: '' },
  aiSummary: { type: String, default: '' },
  leadScore: { type: Number, min: 0, max: 100, default: 0 },
  status: { type: String, enum: ['pending', 'contacted', 'converted'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});
AILeadSchema.index({ status: 1, leadScore: -1 });
const AILead = mongoose.model('AILead', AILeadSchema);

const AIQuestionSchema = new mongoose.Schema({
  type: { type: String, enum: ['text', 'image', 'pdf'], required: true },
  question: { type: String, required: true },
  answer: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const AIQuestion = mongoose.model('AIQuestion', AIQuestionSchema);

const ResultSchema = new mongoose.Schema({
  registrationNumber: { type: String, required: true, unique: true, trim: true },
  studentName: { type: String, required: true, trim: true },
  fatherName: { type: String, required: true, trim: true },
  dob: { type: String, required: true }, // Format YYYY-MM-DD
  photo: { type: String, default: '' }, // Cloudinary URL
  grade: { type: String, required: true, trim: true },
  remarks: { type: String, default: '' },
  published: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});
ResultSchema.index({ registrationNumber: 1, dob: 1 });
const Result = mongoose.model('Result', ResultSchema);

const EventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  date: { type: Date, required: true },
  image: { type: String, default: '' }, // Cloudinary URL
  createdAt: { type: Date, default: Date.now }
});
const Event = mongoose.model('Event', EventSchema);

const GallerySchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
  caption: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now }
});
const Gallery = mongoose.model('Gallery', GallerySchema);

const ProgramSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  category: { type: String, enum: ['Foundation 6-8', 'Academic 9-10', 'Senior 11-12', 'JEE/NEET', 'Future Skills'], required: true },
  description: { type: String, required: true },
  features: [{ type: String }],
  image: { type: String, default: '' }
});
const Program = mongoose.model('Program', ProgramSchema);

// ---------------- MIDDLEWARES ----------------

// DB Connector Middleware
app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (err) {
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// Admin JWT Authentication Verification
const requireAdmin = (req, res, next) => {
  const token = req.cookies.auth_token;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized access. Login required.' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    req.admin = decoded;
    next();
  } catch (err) {
    res.clearCookie('auth_token');
    return res.status(401).json({ error: 'Session expired. Please login again.' });
  }
};

// Input Sanitization Middleware
const sanitizeInput = (req, res, next) => {
  const sanitize = (val) => {
    if (typeof val === 'string') {
      return val.replace(/<[^>]*>/g, '').trim(); // Remove basic HTML tags
    }
    if (Array.isArray(val)) {
      return val.map(sanitize);
    }
    if (val !== null && typeof val === 'object') {
      const cleaned = {};
      for (const k in val) {
        cleaned[k] = sanitize(val[k]);
      }
      return cleaned;
    }
    return val;
  };
  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  next();
};
app.use(sanitizeInput);

// Helper to upload files to Cloudinary from memory buffer
const uploadToCloudinary = (fileBuffer, folder = 'sankalp') => {
  return new Promise((resolve, reject) => {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return reject(new Error('Cloudinary not configured'));
    }
    const stream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    stream.end(fileBuffer);
  });
};

// ---------------- PUBLIC API ROUTES ----------------

// Zod validation schemas
const InquiryZod = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  mobile: z.string().min(10),
  subject: z.string().min(2),
  message: z.string().min(5)
});

const AILeadZod = z.object({
  firstName: z.string().min(2),
  class: z.string(),
  interest: z.string(),
  phone: z.string().min(10),
  city: z.string().min(2),
  parentName: z.string().optional(),
  email: z.string().email().optional().or(z.literal(''))
});

// Contact/Enroll Submit
app.post('/api/contact', async (req, res) => {
  try {
    const data = InquiryZod.parse(req.body);
    const inquiry = new Inquiry(data);
    await inquiry.save();
    res.status(201).json({ success: true, message: 'Inquiry submitted successfully!' });
  } catch (err) {
    res.status(400).json({ error: err.errors ? err.errors[0].message : 'Invalid request payload' });
  }
});

// Lead Capture with AI scoring & summarization via Gemini 2.5 Flash
app.post('/api/lead', async (req, res) => {
  try {
    const data = AILeadZod.parse(req.body);
    let aiSummary = 'No analysis completed.';
    let leadScore = 50;

    // Trigger Gemini for lead evaluation if key is available
    if (process.env.GEMINI_API_KEY) {
      try {
        const prompt = `Evaluate the following lead for admission to Sankalp Digital Pathshala:
Name: ${data.firstName}
Class: ${data.class}
Interest: ${data.interest}
Phone: ${data.phone}
City: ${data.city}
Parent Name: ${data.parentName || 'Not provided'}
Email: ${data.email || 'Not provided'}

Analyze their interest and details to produce a brief 2-sentence summary (aiSummary) and a score (leadScore) between 0 and 100 representing their likelihood of converting. Give a higher score (e.g. 85+) for complete profiles with clear goals.
Provide response strictly in JSON format matching keys "aiSummary" (string) and "leadScore" (number). No extra formatting, code blocks, or explanations.`;

        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          let text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
          // Clean possible markdown JSON wrappers
          text = text.replace(/```json/g, '').replace(/```/g, '').trim();
          try {
            const parsed = JSON.parse(text);
            if (parsed.aiSummary) aiSummary = parsed.aiSummary;
            if (typeof parsed.leadScore === 'number') leadScore = parsed.leadScore;
          } catch (e) {
            console.error('Failed to parse Gemini lead assessment JSON:', text, e);
          }
        }
      } catch (geminiErr) {
        console.error('Gemini Lead Scoring error:', geminiErr);
      }
    }

    const lead = new AILead({
      ...data,
      aiSummary,
      leadScore
    });
    await lead.save();
    res.status(201).json({ success: true, leadScore, aiSummary });
  } catch (err) {
    res.status(400).json({ error: err.errors ? err.errors[0].message : 'Invalid lead parameters' });
  }
});

// AI Question Solver via Gemini 2.5 Flash
app.post('/api/solve-question', upload.single('file'), async (req, res) => {
  try {
    const { question, type } = req.body;
    if (!question && !req.file) {
      return res.status(400).json({ error: 'Please provide a question text or upload a file.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'AI Solver is not configured. (GEMINI_API_KEY missing)' });
    }

    const systemPrompt = `You are a world-class academic mentor at Sankalp Digital Pathshala. 
Provide a clear, detailed, step-by-step educational solution for the user's question. 
Ensure it is structured nicely with headings and code-blocks if applicable. Explain key concepts clearly.`;

    const contents = [{
      parts: [
        { text: `${systemPrompt}\n\nQuestion:\n${question || 'Solve the attached document/file.'}` }
      ]
    }];

    // Attach uploaded file if any
    if (req.file) {
      contents[0].parts.push({
        inlineData: {
          mimeType: req.file.mimetype,
          data: req.file.buffer.toString('base64')
        }
      });
    }

    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API returned error:', errText);
      return res.status(502).json({ error: 'AI solver error. Please try again later.' });
    }

    const responseData = await geminiRes.json();
    const answer = responseData.candidates?.[0]?.content?.parts?.[0]?.text || 'No solution could be generated.';

    // Store in DB history
    const aiQuestion = new AIQuestion({
      type: type || (req.file ? (req.file.mimetype.includes('pdf') ? 'pdf' : 'image') : 'text'),
      question: question || `Uploaded File (${req.file.originalname})`,
      answer
    });
    await aiQuestion.save();

    res.status(200).json({ success: true, answer });
  } catch (err) {
    console.error('Question Solver Error:', err);
    res.status(500).json({ error: 'Internal server error resolving question.' });
  }
});

// Chatbot Streaming via OpenRouter
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Conversation messages are required.' });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).json({ error: 'Chatbot service is not configured.' });
    }

    const systemPrompt = `You are 'Sankalp Sathi', the official AI assistant of Sankalp Digital Pathshala. 
Sankalp Digital Pathshala is a premium offline coaching institute powered by advanced AI tools. 
Mission: To provide high-quality offline mentorship, structured academic and competitive coaching, and modern AI tools for personalized study support.
Founders & Leadership: Founded by expert educators dedicated to academic excellence.
Milestones: Trusted by over 1,500 students across India with high success rates in Board Exams, JEE, and NEET.
Special Initiatives:
- 'Rojgaar Buddy': A career counseling and placement assistance platform integrated with local industries for student internships and career guidance.
- Community Programs: Provides free weekend coaching and study material kits for underprivileged children under the 'Sankalp Shiksha Initiative'.
Contact Info:
- Address: 123 Education Hub, Sector 4, New Delhi, India.
- Phone: +91 98765 43210
- Email: admissions@sankalp.edu
- Website: https://sankalp.edu
AI Developer Credits: This platform is designed, developed, and powered by NexGenAiTech (headed by Jahid, contact: +91 8055698328, website: https://nexgenaitech.online).
Response Rules:
- Answer in plain paragraphs ONLY. Do NOT use markdown, do NOT use bold (**), do NOT use bullet points, do NOT use numbered lists, and do NOT use HTML.
- Maintain a warm, friendly, polite, and encouraging tone.
- Speak in Hindi, English, or Hinglish depending on how the student/parent asks.
- Your main goal is to be helpful and gently guide them toward admissions by collecting lead information (like name, mobile, and class) so that our counselor can reach out to them.
- If they ask about admission fees, details of courses, or test schedules, tell them we have classroom programs (Foundation 6-8, Academics 9-10, Senior 11-12, JEE/NEET, and Future Skills) and ask for their mobile number or guide them to fill our inquiry form.`;

    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    const openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b:free',
        messages: fullMessages,
        stream: true
      })
    });

    if (!openRouterRes.ok) {
      const errText = await openRouterRes.text();
      console.error('OpenRouter API returned error:', errText);
      return res.status(502).json({ error: 'Chat completion is temporarily unavailable.' });
    }

    // Set streaming headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Pipe response stream directly to Express response
    for await (const chunk of openRouterRes.body) {
      res.write(chunk);
    }
    res.end();
  } catch (err) {
    console.error('Chat API Error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Result verification checker
app.post('/api/result/check', async (req, res) => {
  try {
    const { registrationNumber, dob } = req.body;
    if (!registrationNumber || !dob) {
      return res.status(400).json({ error: 'Registration number and date of birth are required.' });
    }

    const record = await Result.findOne({
      registrationNumber: registrationNumber.toUpperCase().trim(),
      dob,
      published: true
    });

    if (!record) {
      return res.status(404).json({ error: 'No matching verified marksheet found. Please verify details.' });
    }

    res.status(200).json({ success: true, result: record });
  } catch (err) {
    res.status(500).json({ error: 'Server error retrieving result information.' });
  }
});

// Get Public Programs, Events, and Gallery
app.get('/api/public/programs', async (req, res) => {
  try {
    const list = await Program.find({});
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve classroom programs.' });
  }
});

app.get('/api/public/events', async (req, res) => {
  try {
    const list = await Event.find({}).sort({ date: 1 });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve events.' });
  }
});

app.get('/api/public/gallery', async (req, res) => {
  try {
    const list = await Gallery.find({}).sort({ createdAt: -1 });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve gallery photos.' });
  }
});

// ---------------- ADMIN API ROUTES (PROTECTED) ----------------

// Admin Auth Routes
app.post('/api/admin/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@sankalp.edu';
    const adminPassword = process.env.ADMIN_PASSWORD || 'SankalpAdminSecure123';

    if (email !== adminEmail || password !== adminPassword) {
      return res.status(401).json({ error: 'Invalid admin credentials.' });
    }

    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET || 'fallback_secret', {
      expiresIn: '4h'
    });

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 4 * 60 * 60 * 1000 // 4 hours
    });

    res.status(200).json({ success: true, message: 'Logged in successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error logging in.' });
  }
});

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.status(200).json({ success: true, message: 'Logged out successfully.' });
});

app.get('/api/admin/check-auth', requireAdmin, (req, res) => {
  res.status(200).json({ authenticated: true });
});

app.get('/api/admin/dashboard', requireAdmin, async (req, res) => {
  try {
    const numInquiries = await Inquiry.countDocuments({});
    const numNewInquiries = await Inquiry.countDocuments({ status: 'new' });
    const numContactedInquiries = await Inquiry.countDocuments({ status: 'contacted' });

    const numLeads = await AILead.countDocuments({});
    const numQuestions = await AIQuestion.countDocuments({});
    const numResults = await Result.countDocuments({});

    res.status(200).json({
      inquiries: { total: numInquiries, new: numNewInquiries, contacted: numContactedInquiries },
      leads: numLeads,
      questions: numQuestions,
      results: numResults
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve dashboard stats.' });
  }
});

// Admin Inquiries CRUD
app.get('/api/admin/inquiries', requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const items = await Inquiry.find(filter).sort({ createdAt: -1 });
    res.status(200).json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch inquiries' });
  }
});

app.patch('/api/admin/inquiries/:id', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const item = await Inquiry.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!item) return res.status(404).json({ error: 'Inquiry not found' });
    res.status(200).json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update inquiry status' });
  }
});

app.delete('/api/admin/inquiries/:id', requireAdmin, async (req, res) => {
  try {
    const item = await Inquiry.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Inquiry not found' });
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete inquiry' });
  }
});

// Admin Leads CRM CRUD
app.get('/api/admin/leads', requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const items = await AILead.find(filter).sort({ createdAt: -1 });
    res.status(200).json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

app.patch('/api/admin/leads/:id', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const item = await AILead.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!item) return res.status(404).json({ error: 'Lead not found' });
    res.status(200).json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update lead status' });
  }
});

app.delete('/api/admin/leads/:id', requireAdmin, async (req, res) => {
  try {
    const item = await AILead.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Lead not found' });
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

// Admin Results CRUD (with Cloudinary photo uploads)
app.get('/api/admin/results', requireAdmin, async (req, res) => {
  try {
    const items = await Result.find({}).sort({ createdAt: -1 });
    res.status(200).json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

app.post('/api/admin/results', requireAdmin, upload.single('photo'), async (req, res) => {
  try {
    const { registrationNumber, studentName, fatherName, dob, grade, remarks, published } = req.body;
    let photoUrl = '';

    if (req.file) {
      photoUrl = await uploadToCloudinary(req.file.buffer, 'sankalp/students');
    }

    const result = new Result({
      registrationNumber: registrationNumber.toUpperCase().trim(),
      studentName,
      fatherName,
      dob,
      photo: photoUrl,
      grade,
      remarks,
      published: published === 'true' || published === true
    });
    await result.save();
    res.status(201).json(result);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Registration number already exists.' });
    }
    res.status(500).json({ error: 'Failed to create student result.' });
  }
});

app.put('/api/admin/results/:id', requireAdmin, upload.single('photo'), async (req, res) => {
  try {
    const { registrationNumber, studentName, fatherName, dob, grade, remarks, published } = req.body;
    const update = {
      registrationNumber: registrationNumber ? registrationNumber.toUpperCase().trim() : undefined,
      studentName,
      fatherName,
      dob,
      grade,
      remarks,
      published: published === 'true' || published === true
    };

    if (req.file) {
      update.photo = await uploadToCloudinary(req.file.buffer, 'sankalp/students');
    }

    const item = await Result.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!item) return res.status(404).json({ error: 'Result not found' });
    res.status(200).json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update student result.' });
  }
});

app.delete('/api/admin/results/:id', requireAdmin, async (req, res) => {
  try {
    const item = await Result.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Result not found' });
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete student result.' });
  }
});

// Admin Events CRUD
app.get('/api/admin/events', requireAdmin, async (req, res) => {
  try {
    const list = await Event.find({}).sort({ date: 1 });
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve events.' });
  }
});

app.post('/api/admin/events', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { title, description, date } = req.body;
    let imageUrl = '';
    if (req.file) {
      imageUrl = await uploadToCloudinary(req.file.buffer, 'sankalp/events');
    }
    const item = new Event({ title, description, date, image: imageUrl });
    await item.save();
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create event' });
  }
});

app.put('/api/admin/events/:id', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { title, description, date } = req.body;
    const update = { title, description, date };
    if (req.file) {
      update.image = await uploadToCloudinary(req.file.buffer, 'sankalp/events');
    }
    const item = await Event.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!item) return res.status(404).json({ error: 'Event not found' });
    res.status(200).json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update event' });
  }
});

app.delete('/api/admin/events/:id', requireAdmin, async (req, res) => {
  try {
    const item = await Event.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Event not found' });
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// Admin Gallery CRUD
app.post('/api/admin/gallery', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { caption } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Please upload an image.' });
    const imageUrl = await uploadToCloudinary(req.file.buffer, 'sankalp/gallery');
    const item = new Gallery({ imageUrl, caption });
    await item.save();
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload gallery image' });
  }
});

app.delete('/api/admin/gallery/:id', requireAdmin, async (req, res) => {
  try {
    const item = await Gallery.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Gallery photo not found' });
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

// Admin Programs CRUD
app.post('/api/admin/programs', requireAdmin, async (req, res) => {
  try {
    const { title, category, description, features, image } = req.body;
    const item = new Program({ title, category, description, features, image });
    await item.save();
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create program' });
  }
});

app.put('/api/admin/programs/:id', requireAdmin, async (req, res) => {
  try {
    const { title, category, description, features, image } = req.body;
    const item = await Program.findByIdAndUpdate(req.params.id, { title, category, description, features, image }, { new: true });
    if (!item) return res.status(404).json({ error: 'Program not found' });
    res.status(200).json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update program' });
  }
});

app.delete('/api/admin/programs/:id', requireAdmin, async (req, res) => {
  try {
    const item = await Program.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Program not found' });
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete program' });
  }
});

// Serve frontend static files
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all route to serve corresponding HTML files or index.html for routing
app.get('*', (req, res) => {
  const file = req.path === '/' ? 'index.html' : `${req.path.slice(1)}.html`;
  const absolutePath = path.join(__dirname, 'public', file);
  res.sendFile(absolutePath, (err) => {
    if (err) {
      res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running successfully on port ${PORT}`);
});
