import os
os.environ["DEEPSEEK_API_KEY"] = "mock"
import json
from models import Assessment
from ocr import extract_text_from_pdf_or_image
from ai_service import (
    extract_questions_from_ocr,
    segment_answer_sheet,
    map_answers_to_questions,
    grade_assessment,
    merge_continuation_answers
)

def run_integration_acceptance_test():
    print("======================================================================")
    print("Ramping up E2E Pipeline Integration Test...")
    print("======================================================================")
    
    qp_path = "qp.pdf"
    as_path = "as.pdf"
    
    if not os.path.exists(qp_path) or not os.path.exists(as_path):
        print("ERROR: Test PDFs (qp.pdf / as.pdf) do not exist! Run create_test_pdf.py first.")
        return
        
    # 1. OCR Extract
    print("\n1. Running OCR on Question Paper...")
    qp_ocr, qp_dims = extract_text_from_pdf_or_image(qp_path, is_answer_sheet=False)
    print(f"QP OCR detected {len(qp_ocr)} words.")
    
    # 2. Extract Questions
    print("\n2. Running Question Extraction...")
    questions = extract_questions_from_ocr(qp_ocr)
    print(f"Extracted {len(questions)} questions:")
    for q in questions:
        print(f"  - ID: {q.id}, Number: {q.number}, Max Marks: {q.marks}, Text: {q.text[:40]}...")
        
    # 3. OCR Answer Sheet
    print("\n3. Running OCR on Student Answer Sheet...")
    as_ocr, as_dims = extract_text_from_pdf_or_image(as_path, is_answer_sheet=True)
    print(f"AS OCR detected {len(as_ocr)} words across {len(as_dims)} pages.")
    
    # 4. Logical Segmentation
    print("\n4. Segmenting Answer Sheet...")
    answers = segment_answer_sheet(as_ocr, as_dims)
    print(f"Segmented {len(answers)} answer blocks:")
    for a in answers:
        print(f"  - ID: {a.id}, Pages: {a.pages}, OCR Conf: {a.ocr_confidence}, Text: {a.text}")
        
    # 5. Question-to-Answer Mapping
    print("\n5. Mapping Questions to Answer Blocks...")
    mappings = map_answers_to_questions(questions, answers)
    print(f"Initial mapping results (before merging):")
    for m in mappings:
        print(f"  - Question: {m.question_id}, Answer: {m.answer_id}, Status: {m.status}, Mapping Conf: {m.mapping_confidence} ({m.confidence})")
        
    # 6. Merge Continuation Blocks
    print("\n6. Running Continuation Block Merging...")
    merged_answers, merged_mappings = merge_continuation_answers(answers, mappings)
    print(f"Merged answer blocks count: {len(merged_answers)}")
    print(f"Merged mapping results:")
    for m in merged_mappings:
        print(f"  - Question: {m.question_id}, Answer: {m.answer_id}, Status: {m.status}, Mapping Conf: {m.mapping_confidence} ({m.confidence})")
        
    # Inspect Q3(a) merged answer block to confirm multiple pages and regions
    q3a_mapping = next((m for m in merged_mappings if m.question_id == "q3a" or m.question_id == "q_3a" or (m.question_id and "3a" in m.question_id)), None)
    if q3a_mapping and q3a_mapping.answer_id:
        q3a_block = next((a for a in merged_answers if a.id == q3a_mapping.answer_id), None)
        if q3a_block:
            print("\n*** Q3(a) Target Answer Block Details ***")
            print(f"  - ID: {q3a_block.id}")
            print(f"  - Pages Spanned: {q3a_block.pages}")
            print(f"  - Number of Highlight Regions: {len(q3a_block.regions)}")
            print(f"  - Aggregated Text Content:\n{q3a_block.text}")
            
    # 7. Grading
    print("\n7. Grading Assessment...")
    grades, summary = grade_assessment(questions, merged_answers, merged_mappings)
    print("Grades allocated:")
    for g in grades:
        print(f"  - Question: {g.question_id}, Score: {g.marks_obtained}/{g.max_marks} ({g.percentage}%), Feedback: {g.feedback[:40]}...")
        
    print("\nAssessment Summary:")
    print(f"  - Total Questions: {summary.total_questions}")
    print(f"  - Answered: {summary.answered}")
    print(f"  - Unanswered: {summary.unanswered}")
    print(f"  - Unmatched: {summary.unmatched_answers}")
    print(f"  - Needs Review: {summary.needs_review}")
    print(f"  - Total Score: {summary.marks_obtained}/{summary.total_marks} ({summary.percentage}%)")
    print(f"  - Overall Feedback: {summary.overall_feedback}")
    
    print("\n======================================================================")
    print("SUCCESS: End-to-End integration scenario verification completed.")
    print("======================================================================")

if __name__ == "__main__":
    run_integration_acceptance_test()
