from typing import Any, Dict

import cv2
import numpy as np

from .config import AppConfig


class Annotator:
    def __init__(self, config: AppConfig):
        self.config = config

    def annotate_frame(
        self,
        frame: np.ndarray,
        scoreboard_state: Dict[str, Any],
        active_player: str,
        ncc_score: float,
        visible: bool,
        timestamp: float
    ) -> np.ndarray:
        """
        Draws professional CV overlays on the video frame.
        """
        annotated = frame.copy()

        # 1. Draw Bounding Box around scoreboard lane region if visible
        x, y, w, h = self.config.scoreboard.lane_template_roi
        color = (0, 255, 0) if visible else (0, 0, 255)
        label = "Scoreboard Active" if visible else "Scoreboard Hidden"

        cv2.rectangle(annotated, (x - 10, y - 10), (x + w + 1100, y + h + 650), color, 3)
        cv2.putText(
            annotated,
            f"{label} (NCC: {ncc_score:.3f})",
            (x - 10, y - 20),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            color,
            2,
            cv2.LINE_AA
        )

        # 2. Status HUD Panel
        hud_bg = np.zeros((150, 450, 3), dtype=np.uint8)
        cv2.rectangle(hud_bg, (0, 0), (450, 150), (20, 20, 20), -1)
        cv2.rectangle(hud_bg, (0, 0), (450, 150), (50, 50, 50), 2)

        # Overlay HUD on top-right of frame
        fh, fw = frame.shape[:2]
        hud_x = fw - 480
        hud_y = 30

        # Draw HUD texts
        cv2.putText(hud_bg, "FOG CV SCOREBOARD EXTRACTOR", (15, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2, cv2.LINE_AA)
        cv2.putText(hud_bg, f"Timestamp: {timestamp:.2f} s", (15, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1, cv2.LINE_AA)
        cv2.putText(hud_bg, f"Active Turn: {active_player or 'NONE'}", (15, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0) if active_player else (128, 128, 128), 1, cv2.LINE_AA)

        # Calculate overall game leader
        leader = "N/A"
        max_ttl = -1
        for p, pdata in scoreboard_state.items():
            try:
                ttl_val = int(pdata["ttl"]) if str(pdata["ttl"]).isdigit() else 0
                if ttl_val > max_ttl:
                    max_ttl = ttl_val
                    leader = p
            except (ValueError, KeyError):
                pass
        cv2.putText(hud_bg, f"Leader: {leader} ({max_ttl if max_ttl >= 0 else 'N/A'})", (15, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 200, 0), 1, cv2.LINE_AA)

        # Composite HUD onto frame
        annotated[hud_y:hud_y+150, hud_x:hud_x+450] = cv2.addWeighted(
            annotated[hud_y:hud_y+150, hud_x:hud_x+450],
            0.3,
            hud_bg,
            0.7,
            0
        )

        # 3. Underline Active Row directly on the scoreboard area
        if active_player and active_player in self.config.player_rows:
            y_start, y_end = self.config.player_rows[active_player]
            cv2.rectangle(
                annotated,
                (260, y_start + 10),
                (1750, y_end - 10),
                (0, 255, 255),
                2
            )
            cv2.putText(
                annotated,
                "ACTIVE",
                (1760, y_start + 90),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (0, 255, 255),
                2,
                cv2.LINE_AA
            )

        return annotated
