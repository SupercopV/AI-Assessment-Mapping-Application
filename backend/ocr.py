import os
import fitz  # PyMuPDF
import logging
from PIL import Image
import numpy as np
import io
import cv2
from typing import List, Dict, Any, Tuple
from models import BoundingBox

logger = logging.getLogger(__name__)

PADDLEOCR_AVAILABLE = False
paddle_ocr_engine = None

try:
    from paddleocr import PaddleOCR
    PADDLEOCR_AVAILABLE = True
except Exception as e:
    logger.warning(f"PaddleOCR is not available. {e}")

def get_ocr_engine():
    global paddle_ocr_engine, PADDLEOCR_AVAILABLE
    if not PADDLEOCR_AVAILABLE:
        return None
    if paddle_ocr_engine is None:
        try:
            # use_angle_cls=True detects orientation to help with rotation/upside down pages
            paddle_ocr_engine = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
        except Exception as e:
            logger.error(f"Failed to initialize PaddleOCR: {e}")
            PADDLEOCR_AVAILABLE = False
    return paddle_ocr_engine

def is_mock_mode() -> bool:
    """Helper to detect if we are running in development mock mode."""
    key = os.environ.get("DEEPSEEK_API_KEY", "")
    return not key or key.lower() in ["", "mock", "development", "none"]

def preprocess_image_before_ocr(img_np: np.ndarray) -> np.ndarray:
    """
    Applies image preprocessing before running PaddleOCR:
    - Grayscale
    - Resolution normalization (Target width 1500px)
    - Contrast enhancement (CLAHE)
    - Noise reduction (Bilateral filter)
    - Deskewing (Skew angle alignment)
    """
    # 1. Grayscale
    if len(img_np.shape) == 3:
        if img_np.shape[2] == 4:  # RGBA
            img_np = cv2.cvtColor(img_np, cv2.COLOR_RGBA2RGB)
        gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
    else:
        gray = img_np.copy()

    # 2. Resolution normalization (Normalize width to e.g., 1500px)
    h, w = gray.shape[:2]
    target_width = 1500
    if w != target_width:
        scale = target_width / w
        new_h = int(h * scale)
        gray = cv2.resize(gray, (target_width, new_h), interpolation=cv2.INTER_CUBIC)
    
    # 3. Contrast enhancement (CLAHE - Contrast Limited Adaptive Histogram Equalization)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    
    # 4. Noise reduction (Bilateral filter to smooth background noise while preserving edges)
    denoised = cv2.bilateralFilter(enhanced, d=9, sigmaColor=75, sigmaSpace=75)
    
    # 5. Deskewing / Skew Angle Correction
    try:
        # Inverse threshold to get text contours
        _, thresh = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        coords = np.column_stack(np.where(thresh > 0))
        angle = cv2.minAreaRect(coords)[-1]
        
        # Normalize skew angle to [-45, 45] degrees scope
        if angle < -45:
            angle = -(90 + angle)
        elif angle > 45:
            angle = 90 - angle
            
        # Rotate only if skew is significant and within a reasonable range
        if 0.5 < abs(angle) < 15:
            (h_rot, w_rot) = denoised.shape[:2]
            center = (w_rot // 2, h_rot // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            denoised = cv2.warpAffine(denoised, M, (w_rot, h_rot), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=255)
    except Exception as ex:
        logger.warning(f"Skew correction skipped: {ex}")
        
    # Convert back to 3-channel RGB as expected by PaddleOCR
    preprocessed_rgb = cv2.cvtColor(denoised, cv2.COLOR_GRAY2RGB)
    return preprocessed_rgb


def extract_text_from_pdf_or_image(file_path: str, is_answer_sheet: bool = False) -> Tuple[List[Dict[str, Any]], List[Tuple[int, float, float]]]:
    """
    Orchestrates extraction of text layout coordinates and metadata.
    """
    ext = os.path.splitext(file_path)[1].lower()
    
    if ext in ['.pdf']:
        return _process_pdf(file_path, is_answer_sheet)
    elif ext in ['.jpg', '.jpeg', '.png', '.bmp']:
        return _process_image(file_path, is_answer_sheet)
    else:
        raise ValueError(f"Unsupported file type: {ext}")


def _process_pdf(pdf_path: str, is_answer_sheet: bool) -> Tuple[List[Dict[str, Any]], List[Tuple[int, float, float]]]:
    """
    Loads PDF pages, applies CV2 preprocessing, feeds to PaddleOCR, and maps structures.
    """
    doc = fitz.open(pdf_path)
    words_list = []
    page_dimensions = []
    
    has_digital_text = False
    
    for page_idx in range(len(doc)):
        page = doc[page_idx]
        w, h = page.rect.width, page.rect.height
        page_dimensions.append((page_idx + 1, w, h))
        text = page.get_text().strip()
        if text:
            has_digital_text = True
            
    # For handwritten/scanned sheets or PDFs lacking digital text structure, run OCR
    ocr_engine = get_ocr_engine() if (not has_digital_text or is_answer_sheet) else None
    
    if not has_digital_text and not ocr_engine:
        if is_mock_mode():
            logger.warning("OCR Engine missing in mock mode. Standard fallback will be generated.")
        else:
            raise ValueError("OCR_FAILED: OCR engine is unavailable to process scanned/handwritten PDF.")
            
    if ocr_engine and (not has_digital_text or is_answer_sheet):
        logger.info(f"Running OCR with CV2 preprocessing on PDF: {pdf_path}")
        for page_idx in range(len(doc)):
            page_num = page_idx + 1
            page = doc[page_idx]
            w_pdf, h_pdf = page.rect.width, page.rect.height
            
            # Render page at 150 DPI (zoom = 2.0)
            zoom = 2.0
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat)
            img_data = pix.tobytes("png")
            img = Image.open(io.BytesIO(img_data))
            img_np = np.array(img.convert('RGB'))
            
            # Apply preprocessing
            preprocessed_np = preprocess_image_before_ocr(img_np)
            h_prep, w_prep = preprocessed_np.shape[:2]
            
            # Run OCR on preprocess output
            try:
                result = ocr_engine.ocr(preprocessed_np, cls=True)
                if not result or not result[0]:
                    if not is_mock_mode():
                        raise ValueError(f"OCR_FAILED: OCR engine returned empty result for page {page_num}.")
                    continue
                
                scale_x = w_pdf / w_prep
                scale_y = h_pdf / h_prep
                
                for line in result[0]:
                    box = line[0]  # [[x0, y0], [x1, y1], [x2, y2], [x3, y3]]
                    text_str, conf = line[1]
                    
                    x0 = min(b[0] for b in box) * scale_x
                    y0 = min(b[1] for b in box) * scale_y
                    x1 = max(b[0] for b in box) * scale_x
                    y1 = max(b[1] for b in box) * scale_y
                    
                    bbox = BoundingBox(
                        page=page_num,
                        x=x0,
                        y=y0,
                        width=x1 - x0,
                        height=y1 - y0,
                        coordinate_system="pdf_points"
                    )
                    words_list.append({
                        "text": text_str,
                        "page": page_num,
                        "bbox": bbox,
                        "confidence": float(conf)
                    })
            except Exception as e:
                logger.error(f"OCR execution failed on page {page_num}: {e}")
                if not is_mock_mode():
                    raise ValueError(f"OCR_FAILED: OCR processing thread failed on page {page_num}. Error Details: {str(e)}")
                    
    # Fallback to digital extraction if OCR wasn't required or failed (only valid if digital text exists)
    if not words_list and has_digital_text:
        logger.info(f"Extracting PDF layout digital text stream: {pdf_path}")
        for page_idx in range(len(doc)):
            page_num = page_idx + 1
            page = doc[page_idx]
            
            words = page.get_text("words")
            current_line = []
            current_bbox = None
            
            for w in words:
                x0, y0, x1, y1, text_str, block_no, line_no, word_no = w
                if current_line and abs(y0 - current_bbox[1]) < 5:
                    current_line.append(text_str)
                    current_bbox = [
                        min(current_bbox[0], x0),
                        min(current_bbox[1], y0),
                        max(current_bbox[2], x1),
                        max(current_bbox[3], y1)
                    ]
                else:
                    if current_line:
                        bbox = BoundingBox(
                            page=page_num,
                            x=current_bbox[0],
                            y=current_bbox[1],
                            width=current_bbox[2] - current_bbox[0],
                            height=current_bbox[3] - current_bbox[1],
                            coordinate_system="pdf_points"
                        )
                        words_list.append({
                            "text": " ".join(current_line),
                            "page": page_num,
                            "bbox": bbox,
                            "confidence": 1.0
                        })
                    current_line = [text_str]
                    current_bbox = [x0, y0, x1, y1]
            
            if current_line:
                bbox = BoundingBox(
                    page=page_num,
                    x=current_bbox[0],
                    y=current_bbox[1],
                    width=current_bbox[2] - current_bbox[0],
                    height=current_bbox[3] - current_bbox[1],
                    coordinate_system="pdf_points"
                )
                words_list.append({
                    "text": " ".join(current_line),
                    "page": page_num,
                    "bbox": bbox,
                    "confidence": 1.0
                })
                
    doc.close()
    
    if not words_list and not is_mock_mode():
        raise ValueError("OCR_FAILED: No readable text blocks extracted in the uploaded document.")
        
    return words_list, page_dimensions


def _process_image(image_path: str, is_answer_sheet: bool) -> Tuple[List[Dict[str, Any]], List[Tuple[int, float, float]]]:
    """
    Loads raw image, applies grayscaling and denoising, and runs PaddleOCR.
    """
    words_list = []
    img = Image.open(image_path)
    w_px, h_px = img.size
    
    # Standardize image coordinates treating pixels = pdf_points
    page_dimensions = [(1, float(w_px), float(h_px))]
    
    # Check if this is a mock/demo file path
    if "mock" in os.path.basename(image_path).lower():
        logger.info(f"Demo file detected: {image_path}. Returning standard mock coordinates.")
        if not is_answer_sheet:
            lines = [
                "Q1. Explain the differences between supervised and unsupervised learning. [5m]",
                "Q2. Explain what is a convolution layer in CNN and why it is parameter-efficient. [10m]",
                "Q3(a). What is SGD optimizer? [3m]",
                "Q3(b). Compare ReLU and GELU activation functions. [4m]"
            ]
            y = 120
            for text in lines:
                words_list.append({
                    "text": text,
                    "page": 1,
                    "bbox": BoundingBox(page=1, x=50, y=float(y - 12), width=700, height=22, coordinate_system="pdf_points"),
                    "confidence": 0.99
                })
                y += 35
        else:
            lines = [
                ("Ans 1. Supervised learning requires labeled dataset input, where each", 120),
                ("example has a target output. Unsupervised learning identifies hidden", 155),
                ("patterns in unlabeled data, for instance clustering similar attributes.", 190),
                ("Ans 3(a). SGD stands for Stochastic Gradient Descent. It computes the gradient", 260),
                ("and updates parameters using a single random sample per iteration.", 295),
                ("Ans 2. A convolution layer slides filters over inputs to construct local feature maps.", 365),
                ("It is parameter-efficient because weights are shared (weight sharing).", 400),
                ("Random notes about activation functions like Sigmoid being saturated.", 470),
                ("This is an orphan block.", 505)
            ]
            for text, y in lines:
                words_list.append({
                    "text": text,
                    "page": 1,
                    "bbox": BoundingBox(page=1, x=50, y=float(y - 12), width=700, height=22, coordinate_system="pdf_points"),
                    "confidence": 0.99
                })
        return words_list, page_dimensions

    ocr_engine = get_ocr_engine()
    
    if not ocr_engine:
        if is_mock_mode():
            logger.warning("OCR Engine missing in mock mode. Returning default image labels.")
            words_list.append({
                "text": "Development Mock Mode: Select and overlay highlighting.",
                "page": 1,
                "bbox": BoundingBox(page=1, x=20, y=20, width=float(w_px - 40), height=50, coordinate_system="pdf_points"),
                "confidence": 0.99
            })
            return words_list, page_dimensions
        else:
            raise ValueError("OCR_FAILED: OCR engine is unavailable to process image uploading.")
            
    img_np = np.array(img.convert('RGB'))
    
    # Preprocess image
    preprocessed_np = preprocess_image_before_ocr(img_np)
    h_prep, w_prep = preprocessed_np.shape[:2]
    
    try:
        result = ocr_engine.ocr(preprocessed_np, cls=True)
        if not result or not result[0]:
            if not is_mock_mode():
                raise ValueError("OCR_FAILED: OCR engine returned empty text extraction from image.")
            return words_list, page_dimensions
            
        scale_x = w_px / w_prep
        scale_y = h_px / h_prep
        
        for line in result[0]:
            box = line[0]
            text_str, conf = line[1]
            
            x0 = min(b[0] for b in box) * scale_x
            y0 = min(b[1] for b in box) * scale_y
            x1 = max(b[0] for b in box) * scale_x
            y1 = max(b[1] for b in box) * scale_y
            
            bbox = BoundingBox(
                page=1,
                x=x0,
                y=y0,
                width=x1 - x0,
                height=y1 - y0,
                coordinate_system="pdf_points"
            )
            words_list.append({
                "text": text_str,
                "page": 1,
                "bbox": bbox,
                "confidence": float(conf)
            })
    except Exception as e:
        logger.error(f"OCR failed for image {image_path}: {e}")
        if not is_mock_mode():
            raise ValueError(f"OCR_FAILED: Image OCR thread execution error. Details: {str(e)}")
            
    return words_list, page_dimensions
