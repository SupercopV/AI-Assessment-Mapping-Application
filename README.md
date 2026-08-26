# AI Assessment Extraction & Answer Mapping Pipeline

An end-to-end, production-ready AI Assessment and Grading assistant. The system takes a Question Paper (PDF/Image) and a student's handwritten or typed Response Sheet (PDF/Image), extracts elements using OCR / digital text streams, aligns student answers to correct question keys using LLM mapping, and lets teachers review and manually override mappings via a premium interactive dashboard.

---

## Key Features

*   **Robust Preprocessing & OCR**: Custom OpenCV grayscaling, CLAHE contrast enhancement, deskewing, and boundary preservation paired with modular PaddleOCR extraction.
*   **Zero-Dependency Digital Fallback**: If PaddleOCR is not installed, the pipeline automatically extracts text layouts from digital PDFs (e.g. Word/Google Doc outputs) using PyMuPDF (`fitz`), bypassing OCR requirements seamlessly.
*   **Stateless Programmatic Demo Mode**: Integrates an orange **"Run Demo Assessment"** button that draws synthetic response inputs on an HTML5 canvas. The backend automatically intercepts these demo files, allowing evaluators to preview the workspace, highlights, and dashboard instantly without any OCR package dependencies or API key limits (100% offline).
*   **OpenRouter & MiniMax Integration**: Standardized on OpenAI-compatible API schemas. Built-in support for OpenRouter and the free **MiniMax M3** model (`minimax/minimax-m3:free`).
*   **Multi-Page Response Consolidation**: Consolidates responses that continue from page 1 onto subsequent pages into single logical grading blocks.
*   **Multi-Metric Confidence Ratings**: Dual-level confidence ratings for extraction and mapping, returning both numerical percentages (`0.0 - 1.0`) and categorical statuses (`"HIGH" | "MEDIUM" | "LOW"`).
*   **Interactive Teacher Workspace**: Allows teachers to click questions to see answer blocks dynamically highlighted in green on the response sheet canvas without scaling drift, edit mappings via a manual override dropdown, and inspect immediate grade score recalibration.

---

## File Structure

```
├── backend/
│   ├── main.py              # FastAPI endpoints, background tasks, routing
│   ├── ocr.py               # Preprocessing, PDF/Image text layout extraction
│   ├── ai_service.py        # OpenRouter/MiniMax AI prompts and Pydantic validation
│   ├── models.py            # Pydantic schemas (Question, AnswerBlock, Mappings, Grade)
│   ├── test_e2e_acceptance.py # Full Acceptance integration test suite
│   ├── create_test_pdf.py   # Test PDF generating script
│   └── requirements.txt     # Python libraries
├── frontend/
│   ├── src/
│   │   ├── app/page.tsx     # Home page hosting dynamic status indicators
│   │   ├── components/      # Upload, Processing, Workspace, and Dashboard screens
│   │   └── types/index.ts   # Model typescript specifications
│   ├── package.json
│   └── tailwind.config.ts
└── README.md                # Project documentation
```

---

## Configuration (`backend/.env`)

Configure the backend variables in `backend/.env` (cloned from `.env.example` in the root folder):

```env
# 1. API Key (e.g., OpenRouter sk-or-v1-..., or "mock" to run 100% local/offline)
DEEPSEEK_API_KEY=sk-or-v1-YOUR_OPENROUTER_API_KEY_HERE

# 2. Completions endpoint completions URL (OpenAI baseURL + /chat/completions)
DEEPSEEK_API_URL=https://openrouter.ai/api/v1/chat/completions

# 3. Model name configuration (e.g., minimax/minimax-m3:free, DeepSeek-V4-Flash)
DEEPSEEK_MODEL=minimax/minimax-m3:free

# 4. Backend Port settings (default is port 8000)
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Local Installation & Setup

### Step 1: Run the Backend
1. Navigate into the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Virtual Environment (Optional but highly recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI development server:
   ```bash
   python -m uvicorn main:app --port 8000 --host 127.0.0.1 --reload
   ```

### Step 2: Run the Frontend
1. Open a new terminal in the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install node dependencies:
   ```bash
   npm install
   ```
3. Start the Next.js development server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Running Acceptance Tests

Verify your pipeline integration directly:
```bash
cd backend
python test_e2e_acceptance.py
```
This runs a simulated grading routine on multi-page digital PDFs, verifying OCR fallback rules, out-of-order mapping, continuation block merges, and grading output.

---

## Production Deployment

### 1. Backend (Hosted on Render)
*   **Build command**: `pip install -r requirements.txt`
*   **Start command**: `python -m uvicorn main:app --host 0.0.0.0 --port 10000`
*   **Environment Variables**: Define `DEEPSEEK_API_KEY`, `DEEPSEEK_API_URL`, and `DEEPSEEK_MODEL` in the Render web settings interface.
*   *(Note: Since Render hosts run Linux, all dependency precompiled binary wheels for PaddleOCR will install and run instantly.)*

### 2. Frontend (Hosted on Vercel)
*   **Root Directory**: Set build root to `frontend/`.
*   **Environment Variables**: Define `NEXT_PUBLIC_API_URL` pointing directly to your deployed Render URL (e.g. `https://my-backend-service.onrender.com`).
