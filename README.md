# Sankalp Digital Pathshala Full-Stack Platform

Sankalp Digital Pathshala is a premium offline coaching institute platform powered by custom AI tools (Gemini 2.5 Flash and OpenRouter LLMs) built as a serverless-friendly Node.js Express application.

## 🚀 Key Features

### Public Learning Workspace
1. **Interactive Homepage**: Auto-rotating fullscreen background image slideshow, trust badges, stats, and testimonials.
2. **AI Question Solver**: Multi-tab doubt workspace accepting Text prompts, Image uploads, and PDF documents. Utilizes Google Gemini 2.5 Flash for step-by-step resolution.
3. **Sankalp Sathi Streaming Chatbot**: Real-time token-by-token streaming chat using OpenRouter, complete with quick chips and counselor intake lead capture cards.
4. **Public Results Lookup**: Public query desk generating verified watermark digital marksheets with student photos.
5. **Classroom Course Catalogs, campus Galleries, structured Test Series grids, FAQs accordions, and multi-step online admissions Registration forms**.

### Protected CRM Admin Panel
1. **JWT & httpOnly Auth**: Complete security protections preventing brute-force operations.
2. **Leads Management**: Track counselor admissions requests with automatic AI-generated interest summaries and priority scores (0-100).
3. **Inquiry Management**: Monitor, update statuses (new/contacted/closed), or delete contact entries.
4. **Results Desk**: Direct CRUD publishing interface for marksheets, including Multer buffer uploads to Cloudinary storage.
5. **Media Asset Managers**: Live uploads of gallery campus snapshots and upcoming announcements.

---

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (Modular assets served via `/assets`)
- **Backend**: Node.js, Express.js (Single-file entry: `server.js`)
- **Database**: MongoDB Atlas via Mongoose
- **AI Integrations**: Google Gemini 2.5 Flash API & OpenRouter Streaming Completions
- **Security & Validation**: Helmet, CORS, JWT session cookies, Express Rate Limiters, Zod Schemas
- **File Storage**: Multer Memory Storage and Cloudinary Cloud Media Services

---

## ⚙️ Local Configuration & Launch

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Create a `.env` file in the root workspace directory matching the templates in `.env.example`:
   ```env
   MONGODB_URI=your_mongodb_atlas_connection_string
   ADMIN_EMAIL=admin@sankalp.edu
   ADMIN_PASSWORD=SankalpAdminSecure123
   JWT_SECRET=super_secret_jwt_key
   GEMINI_API_KEY=your_gemini_api_key
   OPENROUTER_API_KEY=your_openrouter_api_key
   CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open your browser to `http://localhost:3000`.

---

## ☁️ Vercel Serverless Deployment

This platform is configured for Vercel out of the box using catch-all server redirects inside `vercel.json`.

1. Install the Vercel CLI: `npm i -g vercel`
2. Run the deployment sequence:
   ```bash
   vercel
   ```
3. Set your production environment variables in the Vercel project settings dashboard.
4. Promote to production:
   ```bash
   vercel --prod
   ```

---

## 👨‍💻 Developer Credits

Designed, developed, and powered by **NexGenAiTech** (Headed by Jahid, Contact: +91 8055698328, Website: [https://nexgenaitech.online](https://nexgenaitech.online)).
