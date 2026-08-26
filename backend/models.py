from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class BoundingBox(BaseModel):
    page: int
    x: float
    y: float
    width: float
    height: float
    coordinate_system: str = "pdf_points"

class Question(BaseModel):
    id: str
    number: str
    text: str
    marks: Optional[float] = None
    order: int
    source_pages: List[int]
    extraction_confidence: Optional[float] = None

class AnswerBlock(BaseModel):
    id: str
    text: str
    pages: List[int]
    regions: List[BoundingBox]
    ocr_confidence: float

class AnswerMapping(BaseModel):
    question_id: Optional[str] = None  # None for unmatched answers
    answer_id: Optional[str] = None    # None for unanswered questions
    status: str                         # "answered", "unanswered", "unmatched", "uncertain"
    confidence: float                   # Numeric mapping confidence score
    mapping_confidence: str             # Categorical: "HIGH", "MEDIUM", "LOW"
    reason: str

class Grade(BaseModel):
    question_id: str
    marks_obtained: Optional[float] = None
    max_marks: Optional[float] = None
    percentage: Optional[float] = None
    feedback: str
    grading_confidence: Optional[float] = None

class AssessmentSummary(BaseModel):
    total_questions: int
    answered: int
    unanswered: int
    unmatched_answers: int
    needs_review: int
    total_marks: float
    marks_obtained: float
    percentage: float
    overall_feedback: str

class Assessment(BaseModel):
    id: str
    questions: List[Question]
    answers: List[AnswerBlock]
    mappings: List[AnswerMapping]
    grades: List[Grade]
    summary: Optional[AssessmentSummary] = None
    status: str  # "processing", "completed", "failed"
    error_message: Optional[str] = None

class ProcessingStatus(BaseModel):
    step: str  # "uploading", "processing_qp", "extracting_questions", "processing_as", "extracting_answers", "mapping_answers", "grading", "complete", "failed"
    status: str  # "pending", "running", "success", "failed"
    progress: int  # 0 to 100
    message: str
