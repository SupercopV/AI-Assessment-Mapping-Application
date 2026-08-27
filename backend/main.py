import os
import shutil
import uuid
import logging
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import fitz  # PyMuPDF

from models import Assessment, ProcessingStatus, AnswerMapping, AssessmentSummary
from ocr import extract_text_from_pdf_or_image
from ai_service import (
    extract_questions_from_ocr,
    segment_answer_sheet,
    map_answers_to_questions,
    grade_assessment,
    is_mock_mode,
    merge_continuation_answers
)

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="AI Assessment Extraction & Answer Mapping API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production as needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory stores
session_store: Dict[str, Assessment] = {}

@app.get("/")
def read_root():
    return {
        "message": "AI Assessment Extraction & Answer Mapping API is Online",
        "health": "/api/health",
        "docs": "/docs"
    }
status_store: Dict[str, ProcessingStatus] = {}
dimensions_store: Dict[str, Dict[str, List[Dict[str, Any]]]] = {}  # session_id -> {qp/as -> dims}

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "temp_uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

class ManualMappingUpdate(BaseModel):
    mappings: List[AnswerMapping]

@app.get("/api/health")
def health_check():
    key_exists = not is_mock_mode()
    model = os.environ.get("DEEPSEEK_MODEL", "DeepSeek-V4-Flash")
    return {
        "status": "healthy",
        "development_mode": not key_exists,
        "deepseek_key_configured": key_exists,
        "model_name": model
    }

def process_assessment_task(
    session_id: str,
    qp_path: str,
    as_path: str
):
    try:
        # Step 2: Processing QP
        logger.info(f"[{session_id}] Starting QP processing")
        status_store[session_id] = ProcessingStatus(
            step="processing_qp", status="running", progress=15, message="Processing question paper (OCR)..."
        )
        
        qp_ocr, qp_dims = extract_text_from_pdf_or_image(qp_path, is_answer_sheet=False)
        
        # Step 3: Extracting Questions
        status_store[session_id] = ProcessingStatus(
            step="extracting_questions", status="running", progress=30, message="Extracting questions using DeepSeek AI..."
        )
        questions = extract_questions_from_ocr(qp_ocr)
        
        if not questions:
            raise ValueError("No questions could be detected or generated.")
            
        # Step 4: Processing Answer Sheet
        status_store[session_id] = ProcessingStatus(
            step="processing_as", status="running", progress=45, message="Processing answer sheet (OCR)..."
        )
        as_ocr, as_dims = extract_text_from_pdf_or_image(as_path, is_answer_sheet=True)
        
        # Save page dimensions for rendering
        dimensions_store[session_id] = {
            "question_paper": [{"page": d[0], "width": d[1], "height": d[2]} for d in qp_dims],
            "answer_sheet": [{"page": d[0], "width": d[1], "height": d[2]} for d in as_dims]
        }
        
        # Step 5: Extracting Answers
        status_store[session_id] = ProcessingStatus(
            step="extracting_answers", status="running", progress=60, message="Grouping answers into logical blocks..."
        )
        answers = segment_answer_sheet(as_ocr, as_dims)
        
        # Step 6: Mapping Answers
        status_store[session_id] = ProcessingStatus(
            step="mapping_answers", status="running", progress=75, message="Mapping questions to student answers..."
        )
        mappings = map_answers_to_questions(questions, answers)
        
        # Merge continuation answers
        answers, mappings = merge_continuation_answers(answers, mappings)
        
        # Step 7: Grading
        status_store[session_id] = ProcessingStatus(
            step="grading", status="running", progress=90, message="Grading answers and generating feedback..."
        )
        grades, summary = grade_assessment(questions, answers, mappings)
        
        # Done
        assessment = Assessment(
            id=session_id,
            questions=questions,
            answers=answers,
            mappings=mappings,
            grades=grades,
            summary=summary,
            status="completed"
        )
        
        session_store[session_id] = assessment
        status_store[session_id] = ProcessingStatus(
            step="complete", status="success", progress=100, message="Assessment processed successfully."
        )
        logger.info(f"[{session_id}] Processing completed successfully.")
        
    except Exception as e:
        logger.error(f"[{session_id}] Processing failed: {e}", exc_info=True)
        status_store[session_id] = ProcessingStatus(
            step="failed", status="failed", progress=100, message=f"Failed: {str(e)}"
        )
        session_store[session_id] = Assessment(
            id=session_id,
            questions=[],
            answers=[],
            mappings=[],
            grades=[],
            status="failed",
            error_message=str(e)
        )


@app.post("/api/process")
async def start_processing(
    background_tasks: BackgroundTasks,
    question_paper: UploadFile = File(...),
    student_answer: UploadFile = File(...)
):
    session_id = str(uuid.uuid4())
    session_dir = os.path.join(UPLOAD_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)
    
    # Save files
    qp_ext = os.path.splitext(question_paper.filename)[1]
    as_ext = os.path.splitext(student_answer.filename)[1]
    
    if qp_ext.lower() not in ['.pdf', '.png', '.jpg', '.jpeg']:
        raise HTTPException(status_code=400, detail="Invalid Question Paper format. Use PDF or JPG/PNG.")
    if as_ext.lower() not in ['.pdf', '.png', '.jpg', '.jpeg']:
        raise HTTPException(status_code=400, detail="Invalid Student Answer Sheet format. Use PDF or JPG/PNG.")
        
    qp_filename = f"question_paper_mock{qp_ext}" if "mock" in question_paper.filename.lower() else f"question_paper{qp_ext}"
    as_filename = f"answer_sheet_mock{as_ext}" if "mock" in student_answer.filename.lower() else f"answer_sheet{as_ext}"
    
    qp_path = os.path.join(session_dir, qp_filename)
    as_path = os.path.join(session_dir, as_filename)
    
    # Save question paper
    with open(qp_path, "wb") as buffer:
        shutil.copyfileobj(question_paper.file, buffer)
        
    # Save student answer sheet
    with open(as_path, "wb") as buffer:
        shutil.copyfileobj(student_answer.file, buffer)
        
    status_store[session_id] = ProcessingStatus(
        step="uploading", status="running", progress=5, message="Uploading question paper and answer sheet files..."
    )
    
    # Run pipeline in background
    background_tasks.add_task(
        process_assessment_task,
        session_id=session_id,
        qp_path=qp_path,
        as_path=as_path
    )
    
    return {"session_id": session_id}


@app.get("/api/assessment/{session_id}/status", response_model=ProcessingStatus)
def get_status(session_id: str):
    if session_id not in status_store:
        raise HTTPException(status_code=404, detail="Session not found.")
    return status_store[session_id]


@app.get("/api/assessment/{session_id}", response_model=Assessment)
def get_assessment(session_id: str):
    if session_id not in session_store:
        raise HTTPException(status_code=404, detail="Assessment not found.")
    return session_store[session_id]


@app.get("/api/assessment/{session_id}/dimensions")
def get_dimensions(session_id: str):
    if session_id not in dimensions_store:
        raise HTTPException(status_code=404, detail="Dimensions not found.")
    return dimensions_store[session_id]


@app.post("/api/assessment/{session_id}/mapping", response_model=Assessment)
def update_mapping(session_id: str, update: ManualMappingUpdate):
    if session_id not in session_store:
        raise HTTPException(status_code=404, detail="Assessment not found.")
        
    assessment = session_store[session_id]
    
    # Update mappings
    assessment.mappings = update.mappings
    
    # Merge continuation answers
    assessment.answers, assessment.mappings = merge_continuation_answers(assessment.answers, assessment.mappings)
    
    # Recalculate grades and summary
    grades, summary = grade_assessment(
        assessment.questions,
        assessment.answers,
        assessment.mappings
    )
    
    assessment.grades = grades
    assessment.summary = summary
    
    # Save back
    session_store[session_id] = assessment
    return assessment


@app.get("/api/assessment/{session_id}/page/{file_type}/{page_number}")
def get_page_image(session_id: str, file_type: str, page_number: int):
    """
    Renders and serves a page of either question_paper or answer_sheet as an image (PNG).
    file_type: 'question_paper' or 'answer_sheet'
    page_number: 1-indexed page index
    """
    session_dir = os.path.join(UPLOAD_DIR, session_id)
    if not os.path.exists(session_dir):
        raise HTTPException(status_code=404, detail="Session folder not found.")
        
    # Find file
    target_file = None
    for f in os.listdir(session_dir):
        if f.startswith(file_type):
            target_file = os.path.join(session_dir, f)
            break
            
    if not target_file:
        raise HTTPException(status_code=404, detail=f"File {file_type} not found.")
        
    ext = os.path.splitext(target_file)[1].lower()
    
    if ext in ['.pdf']:
        try:
            doc = fitz.open(target_file)
            page_idx = page_number - 1
            if page_idx < 0 or page_idx >= len(doc):
                raise HTTPException(status_code=400, detail=f"Page {page_number} is out of bounds (1 to {len(doc)}).")
                
            page = doc[page_idx]
            # Use zoom=2.0 for higher quality
            zoom = 2.0
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat)
            img_data = pix.tobytes("png")
            doc.close()
            
            return Response(content=img_data, media_type="image/png")
        except Exception as e:
            logger.error(f"Error rendering PDF page: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to render page: {str(e)}")
    else:
        # It's an image. If page_number is not 1, raise error
        if page_number != 1:
            raise HTTPException(status_code=400, detail="Images only support page 1.")
        return FileResponse(target_file)
