import pytest
from models import Question, AnswerBlock, BoundingBox, AnswerMapping
from ocr import _process_pdf
from ai_service import (
    _mock_extract_questions,
    _mock_answer_mapping,
    _mock_grade_question,
    segment_answer_sheet
)

def test_heuristic_question_extraction():
    """Verify that heuristic extraction parses standard, subpart and marks formats."""
    ocr_dump = (
        "--- PAGE 1 ---\n"
        "Q1. What is deep learning? [5 marks]\n"
        "Q2: Explain backpropagation. (10)\n"
        "Q3(a) Explain ReLU activation. [3]\n"
        "Q3(b) Compare ReLU vs Sigmoid. [4m]\n"
    )
    
    questions = _mock_extract_questions(ocr_dump)
    
    # Assert counts
    assert len(questions) == 4
    
    # Assert contents
    assert questions[0].number == "1"
    assert questions[0].marks == 5.0
    assert "deep learning" in questions[0].text
    
    assert questions[1].number == "2"
    assert questions[1].marks == 10.0
    
    assert questions[2].number == "3(a)"
    assert questions[2].marks == 3.0
    
    assert questions[3].number == "3(b)"
    assert questions[3].marks == 4.0


def test_answer_grouping_segmentation():
    """Verify that visual lines are grouped into separate AnswerBlocks using vertical boundaries."""
    ocr_words = [
        # Group 1: Page 1, top
        {"text": "Ans", "page": 1, "bbox": BoundingBox(page=1, x=20, y=20, width=20, height=10), "confidence": 0.9},
        {"text": "1:", "page": 1, "bbox": BoundingBox(page=1, x=45, y=20, width=15, height=10), "confidence": 0.9},
        {"text": "My", "page": 1, "bbox": BoundingBox(page=1, x=20, y=35, width=20, height=10), "confidence": 0.8},
        {"text": "answer", "page": 1, "bbox": BoundingBox(page=1, x=45, y=35, width=30, height=10), "confidence": 0.95},
        
        # Group 2: Page 1, bottom (Vertical gap of 100 pt > 80 pt)
        {"text": "Ans", "page": 1, "bbox": BoundingBox(page=1, x=20, y=140, width=20, height=10), "confidence": 0.9},
        {"text": "2:", "page": 1, "bbox": BoundingBox(page=1, x=45, y=140, width=15, height=10), "confidence": 0.9},
        {"text": "Second", "page": 1, "bbox": BoundingBox(page=1, x=20, y=155, width=40, height=10), "confidence": 0.85},
        {"text": "text", "page": 1, "bbox": BoundingBox(page=1, x=65, y=155, width=25, height=10), "confidence": 0.9}
    ]
    
    page_dims = [(1, 612.0, 792.0)]
    blocks = segment_answer_sheet(ocr_words, page_dims)
    
    # We expect 2 blocks due to the vertical Y gap (y=20 to y=140)
    assert len(blocks) == 2
    assert "My answer" in blocks[0].text
    assert "Second text" in blocks[1].text
    assert blocks[0].regions is not None
    assert blocks[0].pages == [1]


def test_out_of_order_mock_mapping():
    """Verify that out-of-order labels map to correct question identifiers."""
    questions = [
        Question(id="q1", number="1", text="Neural networks.", marks=5.0, order=1, source_pages=[1]),
        Question(id="q2", number="2", text="Activation functions.", marks=5.0, order=2, source_pages=[1]),
        Question(id="q3", number="3", text="Loss optimizer.", marks=5.0, order=3, source_pages=[1])
    ]
    
    answers = [
        # Ans 2 is placed before Ans 1
        AnswerBlock(id="answer_1", text="Ans 2. Standard activation function description.", pages=[1], regions=[], ocr_confidence=0.9),
        AnswerBlock(id="answer_2", text="Ans 1. Explanation on neural layer units.", pages=[1], regions=[], ocr_confidence=0.95),
        AnswerBlock(id="answer_3", text="Orphan text not describing other items.", pages=[1], regions=[], ocr_confidence=0.88)
    ]
    
    mappings = _mock_answer_mapping(questions, answers)
    
    # Find mappings
    m_q1 = next((m for m in mappings if m.question_id == "q1"), None)
    m_q2 = next((m for m in mappings if m.question_id == "q2"), None)
    m_q3 = next((m for m in mappings if m.question_id == "q3"), None)
    
    assert m_q1 is not None
    assert m_q1.answer_id == "answer_2"  # Q1 mapped to Ans 1 block
    assert m_q1.status == "answered"
    
    assert m_q2 is not None
    assert m_q2.answer_id == "answer_1"  # Q2 mapped to Ans 2 block
    assert m_q2.status == "answered"
    
    # Q3 has no matching answer labels
    assert m_q3 is not None
    assert m_q3.status in ["unanswered", "uncertain"]


def test_question_grades_heuristics():
    """Test AI grading fallbacks and mock feedbacks."""
    # Complete text length mock check
    g_good = _mock_grade_question("q1", 5.0, "Supervised uses labels, unsupervised does not. Semi-supervised combines both.")
    g_blank = _mock_grade_question("q2a", 5.0, "  ")
    
    assert g_good.marks_obtained > 2.0
    assert g_good.percentage >= 60.0
    
    assert g_blank.marks_obtained == 0.0
    assert "too short" in g_blank.feedback
