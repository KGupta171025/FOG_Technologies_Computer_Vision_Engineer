import cv2
import numpy as np
import config

class ScoreboardDetector:
    def __init__(self, template_path):
        self.template = cv2.imread(template_path, cv2.IMREAD_GRAYSCALE)
        if self.template is None:
            raise FileNotFoundError(f"Lane template not found at {template_path}")
            
    def is_scoreboard_visible(self, frame):
        """
        Detects if the scoreboard is currently visible on the screen.
        Compares the lane template box against the expected location in the frame.
        """
        # Crop the lane indicator ROI
        x, y, w, h = config.LANE_TEMPLATE_ROI
        roi = frame[y:y+h, x:x+w]
        
        # Convert to grayscale for comparison
        gray_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        
        # Run template matching
        res = cv2.matchTemplate(gray_roi, self.template, cv2.TM_CCOEFF_NORMED)
        ncc = res[0][0]
        
        # An NCC score > 0.96 indicates scoreboard presence with high confidence
        # (prevents false positives during fade transitions)
        return ncc > 0.96, ncc

    def get_active_player(self, frame):
        """
        Detects which player row is active (highlighted in yellow).
        Returns the row code ('J', 'V', 'P', 'T') or None if no active row is detected.
        """
        for player, (y_start, y_end) in config.PLAYER_ROWS.items():
            # Check the player initial box (x: 60 to 100)
            roi = frame[y_start+20 : y_end-20, 60:100]
            mean_color = np.mean(roi, axis=(0,1))  # BGR
            b, g, r = mean_color
            
            # Yellow highlights have high Red and low Blue
            if r > config.ACTIVE_ROW_THRESHOLD_RED and b < config.ACTIVE_ROW_THRESHOLD_BLUE:
                return player
        return None
