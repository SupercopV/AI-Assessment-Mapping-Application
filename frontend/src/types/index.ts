export interface BoundingBox {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  coordinate_system: string;
}

export interface Question {
  id: string;
  number: string;
  text: string;
  marks: number | null;
  order: number;
  source_pages: number[];
  extraction_confidence?: number;
}

export interface AnswerBlock {
  id: string;
  text: string;
  pages: number[];
  regions: BoundingBox[];
  ocr_confidence: number;
}

export interface AnswerMapping {
  question_id: string | null;  // null for unmatched answers
  answer_id: string | null;    // null for unanswered questions
  status: 'answered' | 'unanswered' | 'unmatched' | 'uncertain';
  confidence: number;
  mapping_confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
}

export interface Grade {
  question_id: string;
  marks_obtained: number | null;
  max_marks: number | null;
  percentage: number | null;
  feedback: string;
  grading_confidence?: number;
}

export interface AssessmentSummary {
  total_questions: number;
  answered: number;
  unanswered: number;
  unmatched_answers: number;
  needs_review: number;
  total_marks: number;
  marks_obtained: number;
  percentage: number;
  overall_feedback: string;
}

export interface Assessment {
  id: string;
  questions: Question[];
  answers: AnswerBlock[];
  mappings: AnswerMapping[];
  grades: Grade[];
  summary: AssessmentSummary | null;
  status: 'processing' | 'completed' | 'failed';
  error_message?: string;
}

export interface ProcessingStatus {
  step:
    | 'uploading'
    | 'processing_qp'
    | 'extracting_questions'
    | 'processing_as'
    | 'extracting_answers'
    | 'mapping_answers'
    | 'grading'
    | 'complete'
    | 'failed';
  status: 'pending' | 'running' | 'success' | 'failed';
  progress: number; // 0 to 100
  message: string;
}
