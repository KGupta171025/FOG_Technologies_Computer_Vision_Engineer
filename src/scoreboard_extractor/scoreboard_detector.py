import cv2
import numpy as np

from .config import AppConfig


class ScoreboardDetector:
    def __init__(self, template_path: str, config: AppConfig):
        self.config = config
        self.template = cv2.imread(template_path, cv2.IMREAD_GRAYSCALE)
        if self.template is None:
            raise FileNotFoundError(f"Lane template image not found at: {template_path}")

    def is_scoreboard_visible(self, frame: np.ndarray) -> tuple[bool, float]:
        """
        Runs Normalized Cross-Correlation (NCC) template matching on the lane number
        to verify if the scoreboard is visible in the frame.
        """
        # Crop the expected lane template region
        x, y, w, h = self.config.scoreboard.lane_template_roi
        # Ensure coordinates are within frame bounds
        fh, fw = frame.shape[:2]
        if y + h > fh or x + w > fw:
            return False, 0.0

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        roi = gray[y:y+h, x:x+w]

        # Match template
        res = cv2.matchTemplate(roi, self.template, cv2.TM_CCOEFF_NORMED)
        _, max_val, _, _ = cv2.minMaxLoc(res)

        visible = max_val >= self.config.scoreboard.lane_ncc_threshold
        return visible, max_val

    def get_active_player(self, frame: np.ndarray) -> str:
        """
        Scans the player initials column to detect the active player row
        highlighted in orange/yellow (RGB thresholding).
        """
        # Check initials column bounding box region (x=60 to 100)
        for player, (y_start, y_end) in self.config.player_rows.items():
            fh = frame.shape[0]
            if y_end > fh:
                continue
            # Initial name region crop
            name_roi = frame[y_start+20 : y_end-20, 60:100]
            mean_color = np.mean(name_roi, axis=(0, 1))  # BGR
            b, g, r = mean_color

            # Yellow highlights have high Red, medium/high Green, low Blue
            if r >= self.config.ocr.active_row_threshold_red and b <= self.config.ocr.active_row_threshold_blue:
                return player

        return None
