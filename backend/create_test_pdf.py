import fitz
import os

def create_test_pdfs():
    # 1. Create QP PDF
    qp_doc = fitz.open()
    qp_page = qp_doc.new_page(width=595, height=842)
    qp_page.insert_text((100, 80), "QUESTION PAPER - COMPUTER SCIENCE", fontname="helv", fontsize=16)
    
    # Q1
    qp_page.insert_text((100, 180), "Q1. Explain AI.", fontname="helv", fontsize=12)
    
    # Q2
    qp_page.insert_text((100, 280), "Q2. Define machine learning.", fontname="helv", fontsize=12)
    
    # Q3(a)
    qp_page.insert_text((100, 380), "Q3(a). Explain supervised learning.", fontname="helv", fontsize=12)
    
    # Q3(b)
    qp_page.insert_text((100, 480), "Q3(b). Give two applications.", fontname="helv", fontsize=12)
    
    qp_doc.save("qp.pdf")
    qp_doc.close()
    print("Created qp.pdf successfully.")

    # 2. Create Student AS PDF
    as_doc = fitz.open()
    
    # Page 1
    as_page1 = as_doc.new_page(width=595, height=842)
    as_page1.insert_text((100, 80), "STUDENT ANSWER SHEET (Page 1)", fontname="helv", fontsize=16)
    
    # Ans 3(b) answered first (out-of-order)
    as_page1.insert_text((100, 180), "Ans 3(b). Two applications of supervised learning are spam detection and stock price prediction.", fontname="helv", fontsize=12)
    
    # Ans 1 answered next
    as_page1.insert_text((100, 300), "Ans 1. AI stands for Artificial Intelligence. It involves building systems that can perform", fontname="helv", fontsize=12)
    as_page1.insert_text((100, 320), "tasks that typically require human intelligence, such as reasoning and learning.", fontname="helv", fontsize=12)
    
    # Ans 3(a) start
    as_page1.insert_text((100, 450), "Ans 3(a). Supervised learning is a machine learning paradigm where the model is trained on labeled data.", fontname="helv", fontsize=12)
    
    # Extra answer (matches no question)
    as_page1.insert_text((100, 600), "Unrelated Answer Block. Photosynthesis is the process by which green plants make food using sunlight.", fontname="helv", fontsize=12)
    
    # Page 2
    as_page2 = as_doc.new_page(width=595, height=842)
    as_page2.insert_text((100, 80), "STUDENT ANSWER SHEET (Page 2)", fontname="helv", fontsize=16)
    
    # Ans 3(a) continuation
    as_page2.insert_text((100, 180), "Ans 3(a) continuation. Here is the continuation text for supervised learning. It maps to Q3(a).", fontname="helv", fontsize=12)
    
    as_doc.save("as.pdf")
    as_doc.close()
    print("Created as.pdf successfully.")

if __name__ == "__main__":
    create_test_pdfs()
