import cv2
import numpy as np
import os
import glob
import config

class ScoreExtractor:
    def __init__(self, templates_dir):
        self.templates = {}
        # Load all character templates (24x24 patches)
        template_files = glob.glob(os.path.join(templates_dir, "*.png"))
        for filepath in template_files:
            name = os.path.basename(filepath).replace(".png", "")
            if name == "template_lane":
                continue
                
            template_img = cv2.imread(filepath, cv2.IMREAD_GRAYSCALE)
            if template_img is not None:
                char_map = {"minus": "-", "spare": "/"}
                char_name = char_map.get(name, name)
                self.templates[char_name] = template_img
                
        print(f"Loaded {len(self.templates)} 24x24 templates: {list(self.templates.keys())}")

    def recognize_character(self, roi, is_active):
        """
        Extracts a clean character patch from the ROI using contour bounding box combining,
        applies size-based heuristics for '-' and '1', and matches against templates for others.
        """
        if is_active:
            roi = 255 - roi
            
        min_val, max_val, _, _ = cv2.minMaxLoc(roi)
        val_range = max_val - min_val
        if val_range < 85: # Ignore low contrast blank backgrounds
            return None
            
        # Threshold of 150 completely blackouts grid dividers
        _, thresh = cv2.threshold(roi, 150, 255, cv2.THRESH_BINARY)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        valid_contours = []
        for c in contours:
            x, y, w, h = cv2.boundingRect(c)
            # Filter out vertical divider lines (tall and thin)
            if h >= 18 and w < 10:
                continue
            # Allow h >= 1 to capture extremely thin minus characters
            if w >= 2 and h >= 1:
                valid_contours.append(c)
                
        if not valid_contours:
            return None
            
        # Combine all valid contours to reconstruct split characters
        x_min = min(cv2.boundingRect(c)[0] for c in valid_contours)
        y_min = min(cv2.boundingRect(c)[1] for c in valid_contours)
        x_max = max(cv2.boundingRect(c)[0] + cv2.boundingRect(c)[2] for c in valid_contours)
        y_max = max(cv2.boundingRect(c)[1] + cv2.boundingRect(c)[3] for c in valid_contours)
        
        w_box = x_max - x_min
        h_box = y_max - y_min
        
        # Size-based heuristics (highly robust for minus and 1)
        if h_box < 10:
            return "-"
        if w_box < 9:
            return "1"
            
        char_crop = roi[y_min:y_max, x_min:x_max]
        patch = cv2.resize(char_crop, (24, 24))
        
        best_char = None
        best_score = -1.0
        
        for char, template in self.templates.items():
            res = cv2.matchTemplate(patch, template, cv2.TM_CCOEFF_NORMED)
            score = res[0][0]
            if score > best_score:
                best_score = score
                best_char = char
                
        if best_score > 0.82:
            return best_char
        return None

    def extract_rolls_from_frame(self, frame, player_code, col_idx, is_active):
        """
        Extracts roll scores for a specific player and frame column.
        col_idx is 0-indexed (0 to 9).
        """
        y_start, y_end = config.PLAYER_ROWS[player_code]
        x_col = config.COL_START_X + col_idx * config.COL_WIDTH
        
        y1 = y_start + config.CROP_Y_START
        y2 = y_start + config.CROP_Y_END
        
        rolls = []
        
        if col_idx < 9:
            r1_start = x_col + config.ROLL1_ROI_X[0]
            r1_end = x_col + config.ROLL1_ROI_X[1]
            r2_start = x_col + config.ROLL2_ROI_X[0]
            r2_end = x_col + config.ROLL2_ROI_X[1]
            
            roi_r1 = frame[y1:y2, r1_start:r1_end]
            roi_r2 = frame[y1:y2, r2_start:r2_end]
            
            gray_r1 = cv2.cvtColor(roi_r1, cv2.COLOR_BGR2GRAY)
            gray_r2 = cv2.cvtColor(roi_r2, cv2.COLOR_BGR2GRAY)
            
            c1 = self.recognize_character(gray_r1, is_active)
            c2 = self.recognize_character(gray_r2, is_active)
            
            # Strike logic
            if c1 == 'X':
                rolls = ['X', '']
            elif c2 == 'X':
                rolls = ['X', '']
            else:
                rolls = [c1, c2]
        else:
            r1_start = x_col + config.ROLL1_F10_X[0]
            r1_end = x_col + config.ROLL1_F10_X[1]
            r2_start = x_col + config.ROLL2_F10_X[0]
            r2_end = x_col + config.ROLL2_F10_X[1]
            r3_start = x_col + config.ROLL3_F10_X[0]
            r3_end = x_col + config.ROLL3_F10_X[1]
            
            roi_r1 = frame[y1:y2, r1_start:r1_end]
            roi_r2 = frame[y1:y2, r2_start:r2_end]
            roi_r3 = frame[y1:y2, r3_start:r3_end]
            
            gray_r1 = cv2.cvtColor(roi_r1, cv2.COLOR_BGR2GRAY)
            gray_r2 = cv2.cvtColor(roi_r2, cv2.COLOR_BGR2GRAY)
            gray_r3 = cv2.cvtColor(roi_r3, cv2.COLOR_BGR2GRAY)
            
            c1 = self.recognize_character(gray_r1, is_active)
            c2 = self.recognize_character(gray_r2, is_active)
            c3 = self.recognize_character(gray_r3, is_active)
            
            rolls = [c1, c2, c3]
            
        return rolls
