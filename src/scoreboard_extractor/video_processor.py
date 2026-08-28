import json
import os
from typing import Any, Dict

import cv2
import numpy as np
import pandas as pd

from .annotator import Annotator
from .config import AppConfig
from .data_parser import DataParser
from .image_preprocessor import ImagePreprocessor
from .models import FrameRecord, PlayerState
from .ocr_engine import OCREngine
from .scoreboard_detector import ScoreboardDetector
from .temporal_validator import TemporalValidator


class VideoProcessor:
    def __init__(self, config: AppConfig, template_path: str, templates_dir: str):
        self.config = config
        self.detector = ScoreboardDetector(template_path, self.config)
        self.ocr_engine = OCREngine(templates_dir, self.config)
        self.validator = TemporalValidator(self.config.ocr.min_required_votes)
        self.annotator = Annotator(self.config)
        self.metadata = {}

    def inspect_video(self, video_path: str) -> Dict[str, Any]:
        """
        Inspects the input video file and returns metadata.
        """
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise FileNotFoundError(f"Could not open input video file: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_frames / fps if fps > 0 else 0.0

        cap.release()

        self.metadata = {
            "resolution": f"{width}x{height}",
            "fps": fps,
            "total_frames": total_frames,
            "duration_seconds": duration
        }
        return self.metadata

    def process(
        self,
        video_path: str,
        output_dir: str,
        frame_interval: int = 5,
        confidence_threshold: float = 0.60,
        debug: bool = False
    ) -> tuple[str, str, str]:
        """
        Main pipeline orchestrator. Runs frame detection, OCR extraction,
        temporal validation, and saves CSV, JSON, and annotated video.
        """
        if not self.metadata:
            self.inspect_video(video_path)

        cap = cv2.VideoCapture(video_path)
        fps = self.metadata["fps"]
        int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        # Output paths
        os.makedirs(output_dir, exist_ok=True)
        video_out_path = os.path.join(output_dir, "annotated_video.mp4")
        csv_out_path = os.path.join(output_dir, "scoreboard_data.csv")
        json_out_path = os.path.join(output_dir, "scoreboard_data.json")
        sample_frame_path = os.path.join(output_dir, "sample_detected_frame.jpg")

        # OpenCV VideoWriter (compress to 10 FPS to save space and match GitHub Page constraints)
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out_writer = cv2.VideoWriter(video_out_path, fourcc, 10.0, (1280, 720))

        # Initialize scoreboard states
        scoreboard_state = {}
        for p, name in self.config.player_names.items():
            scoreboard_state[p] = PlayerState(name=name, initial=p)

        frame_records = []
        frame_idx = 0
        saved_sample_frame = False

        print("Processing video frames and running extraction...")

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            frame_idx += 1
            timestamp = frame_idx / fps

            # 1. Check Scoreboard Visibility
            visible, ncc_score = self.detector.is_scoreboard_visible(frame)
            active_player = None

            if visible:
                active_player = self.detector.get_active_player(frame)

                # Run character extraction on visible frames at intervals
                if frame_idx % frame_interval == 0:
                    raw_texts = []
                    confidences = []

                    for p in self.config.player_rows.keys():
                        is_active = (p == active_player)
                        y_start = self.config.player_rows[p][0]
                        y1 = y_start + self.config.grid.crop_y_start
                        y2 = y_start + self.config.grid.crop_y_end

                        # Process 10 frames
                        for col_idx in range(10):
                            x_col = self.config.grid.col_start_x + col_idx * self.config.grid.col_width
                            num_rolls = 3 if col_idx == 9 else 2

                            # Select ROI search windows
                            if col_idx == 9:
                                windows = [
                                    self.config.grid.roll1_f10_x,
                                    self.config.grid.roll2_f10_x,
                                    self.config.grid.roll3_f10_x
                                ]
                            else:
                                windows = [
                                    self.config.grid.roll1_roi_x,
                                    self.config.grid.roll2_roi_x
                                ]

                            for roll_idx in range(num_rolls):
                                wx_start, wx_end = windows[roll_idx]
                                roi = frame[y1:y2, x_col + wx_start : x_col + wx_end]

                                # Gray and clean crop
                                gray_roi = ImagePreprocessor.to_grayscale(roi)
                                res = self.ocr_engine.recognize_character(gray_roi, is_active)

                                if res.text:
                                    norm_char = DataParser.normalize_roll(
                                        res.text,
                                        roll_idx,
                                        scoreboard_state[p].rolls[col_idx][roll_idx-1] if roll_idx > 0 else ""
                                    )
                                    if norm_char and res.confidence >= confidence_threshold:
                                        self.validator.add_vote(p, col_idx, roll_idx, norm_char)
                                        raw_texts.append(norm_char)
                                        confidences.append(res.confidence)

                    # Apply voting stabilization
                    for p in self.config.player_rows.keys():
                        for col_idx in range(10):
                            num_rolls = 3 if col_idx == 9 else 2
                            for roll_idx in range(num_rolls):
                                current_char = scoreboard_state[p].rolls[col_idx][roll_idx]
                                stabilized_char, changed = self.validator.get_stabilized_character(
                                    p, col_idx, roll_idx, current_char
                                )
                                scoreboard_state[p].rolls[col_idx][roll_idx] = stabilized_char

                        # Recalculate bowling scores
                        scores = DataParser.calculate_bowling_scores(scoreboard_state[p].rolls)
                        scoreboard_state[p].scores = scores

                        # Update Total
                        non_empty = [s for s in scores if s != ""]
                        scoreboard_state[p].ttl = non_empty[-1] if non_empty else ""

                    # Save audit log record
                    avg_conf = np.mean(confidences) if confidences else 0.0
                    parsed_fields_dict = {}
                    for p, pstate in scoreboard_state.items():
                        parsed_fields_dict[pstate.name] = {
                            "rolls": [[r for r in f] for f in pstate.rolls],
                            "scores": list(pstate.scores),
                            "ttl": pstate.ttl
                        }

                    record = FrameRecord(
                        frame_number=frame_idx,
                        video_timestamp=timestamp,
                        raw_ocr_text=",".join(raw_texts),
                        ocr_confidence=float(avg_conf),
                        parsed_fields=parsed_fields_dict
                    )
                    frame_records.append(record)

                    if debug:
                        debug_dir = os.path.join(output_dir, "debug_frames")
                        ImagePreprocessor.save_debug_image(
                            frame,
                            f"frame_{frame_idx:05d}_raw.jpg",
                            debug_dir
                        )

            # Write annotated frame to demo video
            current_state_dict = {pstate.name: {"rolls": pstate.rolls, "scores": pstate.scores, "ttl": pstate.ttl} for pstate in scoreboard_state.values()}
            annotated_frame = self.annotator.annotate_frame(
                frame,
                current_state_dict,
                active_player,
                ncc_score,
                visible,
                timestamp
            )

            # Save a sample detected frame
            if visible and not saved_sample_frame:
                cv2.imwrite(sample_frame_path, annotated_frame)
                saved_sample_frame = True

            # Resize and write to video output
            resized_annotated = cv2.resize(annotated_frame, (1280, 720))
            # Write every 3rd frame to enforce 10 FPS limit (assuming input was 30 FPS)
            if frame_idx % 3 == 0:
                out_writer.write(resized_annotated)

        cap.release()
        out_writer.release()

        # Save structured outputs
        # 1. JSON
        final_json_data = {}
        for pstate in scoreboard_state.values():
            final_json_data[pstate.name] = {
                "initial": pstate.initial,
                "rolls": [[r for r in f] for f in pstate.rolls],
                "scores": list(pstate.scores),
                "ttl": pstate.ttl
            }
        with open(json_out_path, "w") as f:
            json.dump(final_json_data, f, indent=4)

        # 2. CSV Audit Logs
        csv_rows = []
        for r in frame_records:
            row_dict = {
                "frame_number": r.frame_number,
                "video_timestamp": r.video_timestamp,
                "raw_ocr_text": r.raw_ocr_text,
                "ocr_confidence": r.ocr_confidence,
            }
            # Flatten parsed fields for CSV table formatting
            for name, details in r.parsed_fields.items():
                row_dict[f"{name}_ttl"] = details["ttl"]
            csv_rows.append(row_dict)

        df = pd.DataFrame(csv_rows)
        df.to_csv(csv_out_path, index=False)

        return video_out_path, csv_out_path, json_out_path
