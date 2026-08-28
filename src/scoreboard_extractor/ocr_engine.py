import glob
import os

import cv2
import numpy as np

from .config import AppConfig
from .models import OCRResult


class OCREngine:
    def __init__(self, templates_dir: str, config: AppConfig):
        self.config = config
        self.templates_dir = templates_dir
        self.templates = {}
        self.easyocr_reader = None

        if self.config.ocr.mode == "easyocr":
            # Lazy load easyocr to prevent startup lag when not in use
            import easyocr
            self.easyocr_reader = easyocr.Reader(['en'], gpu=False)
        else:
            # Load custom reference character templates
            self._load_templates()

    def _load_templates(self):
        """Loads reference digit templates from the templates directory."""
        if not os.path.exists(self.templates_dir):
            raise FileNotFoundError(f"Templates directory not found at: {self.templates_dir}")

        template_files = glob.glob(os.path.join(self.templates_dir, "*.png"))
        for filepath in template_files:
            name = os.path.basename(filepath).replace(".png", "")
            if name == "template_lane":
                continue

            img = cv2.imread(filepath, cv2.IMREAD_GRAYSCALE)
            if img is not None:
                # Map special symbol filenames to rolls representations
                char_map = {"minus": "-", "spare": "/"}
                char_name = char_map.get(name, name)
                self.templates[char_name] = img

        if not self.templates:
            print(f"Warning: No digit templates loaded from {self.templates_dir}")

    def recognize_character(self, roi: np.ndarray, is_active: bool) -> OCRResult:
        """
        Recognizes character from the grayscale ROI.
        Returns OCRResult with text and confidence score.
        """
        if self.config.ocr.mode == "easyocr":
            return self._recognize_easyocr(roi)
        else:
            return self._recognize_custom(roi, is_active)

    def _recognize_easyocr(self, roi: np.ndarray) -> OCRResult:
        """Runs EasyOCR on the image region."""
        # EasyOCR works best on slightly larger, padded crops
        resized = cv2.resize(roi, (64, 64), interpolation=cv2.INTER_LINEAR)
        results = self.easyocr_reader.readtext(resized)

        if not results:
            return OCRResult(text="", confidence=0.0)

        # Select result with highest confidence
        best_res = max(results, key=lambda x: x[2])
        text = best_res[1].strip()
        confidence = float(best_res[2])

        return OCRResult(text=text, confidence=confidence)

    def _recognize_custom(self, roi: np.ndarray, is_active: bool) -> OCRResult:
        """
        Custom High-Precision NCC Template Matcher and Size Heuristic OCR.
        """
        if is_active:
            # Active player has dark text on light background; invert it to make it white-on-black
            roi = 255 - roi

        min_val, max_val, _, _ = cv2.minMaxLoc(roi)
        if max_val - min_val < 85:  # Ignore low-contrast blank cells
            return OCRResult(text="", confidence=0.0)

        # Threshold to blackout background dividers
        _, thresh = cv2.threshold(roi, self.config.ocr.binary_threshold, 255, cv2.THRESH_BINARY)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        valid_contours = []
        for c in contours:
            x, y, w, h = cv2.boundingRect(c)
            # Filter out vertical dividers
            if h >= 18 and w < 10:
                continue
            if w >= 2 and h >= 1:
                valid_contours.append(c)

        if not valid_contours:
            return OCRResult(text="", confidence=0.0)

        # Combine all valid contours to form the bounding box of the digit
        x_min = min(cv2.boundingRect(c)[0] for c in valid_contours)
        y_min = min(cv2.boundingRect(c)[1] for c in valid_contours)
        x_max = max(cv2.boundingRect(c)[0] + cv2.boundingRect(c)[2] for c in valid_contours)
        y_max = max(cv2.boundingRect(c)[1] + cv2.boundingRect(c)[3] for c in valid_contours)

        w_box = x_max - x_min
        h_box = y_max - y_min

        # Size Heuristics (extremely robust for Gutter '-' and digit '1')
        if h_box < 10:
            return OCRResult(text="-", confidence=1.0)
        if w_box < 9:
            return OCRResult(text="1", confidence=1.0)

        char_crop = roi[y_min:y_max, x_min:x_max]
        patch = cv2.resize(char_crop, (24, 24))

        best_char = ""
        best_score = -1.0

        for char, template in self.templates.items():
            res = cv2.matchTemplate(patch, template, cv2.TM_CCOEFF_NORMED)
            score = res[0][0]
            if score > best_score:
                best_score = score
                best_char = char

        if best_score >= self.config.ocr.confidence_threshold:
            return OCRResult(text=best_char, confidence=float(best_score))

        return OCRResult(text="", confidence=0.0)
