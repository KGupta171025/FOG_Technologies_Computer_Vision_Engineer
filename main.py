import cv2
import json
import os
import numpy as np
import config
from collections import Counter
from scoreboard_detector import ScoreboardDetector
from extractor import ScoreExtractor
from utils import calculate_bowling_scores, draw_overlay

def main():
    print("Initializing Bowling Scoreboard Data Extraction Pipeline (v2)...")
    
    # Verify templates directory has templates
    template_lane_path = os.path.join(config.TEMPLATES_DIR, "template_lane.png")
    if not os.path.exists(template_lane_path):
        print(f"Error: Lane template not found at {template_lane_path}")
        return
        
    detector = ScoreboardDetector(template_lane_path)
    extractor = ScoreExtractor(config.TEMPLATES_DIR)
    
    # Open Video
    cap = cv2.VideoCapture(config.VIDEO_PATH)
    if not cap.isOpened():
        print(f"Error: Could not open video file {config.VIDEO_PATH}")
        return
        
    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    print(f"Input Video: {config.VIDEO_PATH}")
    print(f"Resolution: {width}x{height} | FPS: {fps} | Total Frames: {total_frames}")
    
    # Initialize Output Video Writer
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(config.OUTPUT_VIDEO_PATH, fourcc, fps, (width, height))
    
    # Stable committed scoreboard state
    scoreboard_state = {}
    for p in config.PLAYER_ROWS.keys():
        player_rolls = [[None, None] for _ in range(9)] + [[None, None, None]]
        scoreboard_state[p] = {
            "name": config.PLAYER_NAMES[p],
            "rolls": player_rolls,
            "scores": [""] * 10,
            "ttl": ""
        }
        
    # Global voting database: (player, col_idx, roll_idx) -> Counter of detections
    global_votes = {}
    MIN_REQUIRED_VOTES = 5
    
    frame_count = 0
    print("Processing video frames...")
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
            
        frame_count += 1
        if frame_count % 100 == 0:
            print(f"Processed {frame_count}/{total_frames} frames...")
            
        # 1. Detect if scoreboard is visible
        visible, ncc_score = detector.is_scoreboard_visible(frame)
        active_player = None
        
        if visible:
            # 2. Get active player row
            active_player = detector.get_active_player(frame)
            
            # 3. Process scoreboard columns (Frames 1 to 10)
            for player in config.PLAYER_ROWS.keys():
                is_active = (player == active_player)
                for col_idx in range(10):
                    # Extract rolls from frame crop
                    detected_rolls = extractor.extract_rolls_from_frame(frame, player, col_idx, is_active)
                    
                    for roll_idx, char in enumerate(detected_rolls):
                        if char is not None:
                            buf_key = (player, col_idx, roll_idx)
                            if buf_key not in global_votes:
                                global_votes[buf_key] = Counter()
                            global_votes[buf_key][char] += 1
                            
            # Update scoreboard state based on current majority votes
            for (player, col_idx, roll_idx), counter in global_votes.items():
                if counter:
                    most_common_char, votes = counter.most_common(1)[0]
                    if votes >= MIN_REQUIRED_VOTES:
                        scoreboard_state[player]["rolls"][col_idx][roll_idx] = most_common_char
                        
            # Recalculate scores dynamically for active overlay drawing
            for player in config.PLAYER_ROWS.keys():
                scores = calculate_bowling_scores(scoreboard_state[player]["rolls"])
                scoreboard_state[player]["scores"] = scores
                
                # TTL calculation
                non_empty_scores = [s for s in scores if s != ""]
                scoreboard_state[player]["ttl"] = non_empty_scores[-1] if non_empty_scores else ""
                
        # Draw computer vision overlay
        annotated_frame = draw_overlay(frame.copy(), scoreboard_state, active_player, ncc_score, visible)
        
        # Write to demo video file
        out.write(annotated_frame)
        
    cap.release()
    out.release()
    print("Video processing completed successfully!")
    print(f"Output Demo Video saved to: {config.OUTPUT_VIDEO_PATH}")
    
    # Resolve final scoreboard state via global majority vote
    final_scoreboard = {}
    for p in config.PLAYER_ROWS.keys():
        final_rolls = [[None, None] for _ in range(9)] + [[None, None, None]]
        for col_idx in range(10):
            num_rolls = 3 if col_idx == 9 else 2
            for roll_idx in range(num_rolls):
                buf_key = (p, col_idx, roll_idx)
                if buf_key in global_votes and global_votes[buf_key]:
                    char, votes = global_votes[buf_key].most_common(1)[0]
                    if votes >= MIN_REQUIRED_VOTES:
                        final_rolls[col_idx][roll_idx] = char
                        
        # Calculate final scoring
        final_scores = calculate_bowling_scores(final_rolls)
        non_empty = [s for s in final_scores if s != ""]
        final_ttl = non_empty[-1] if non_empty else ""
        
        player_name = config.PLAYER_NAMES[p]
        final_scoreboard[player_name] = {
            "initial": p,
            "rolls": [[r if r is not None else "" for r in frame] for frame in final_rolls],
            "scores": [s if s is not None else "" for s in final_scores],
            "ttl": final_ttl
        }
        
    with open(config.OUTPUT_JSON_PATH, "w") as f:
        json.dump(final_scoreboard, f, indent=4)
    print(f"Extracted scoreboard data saved to: {config.OUTPUT_JSON_PATH}")
    print(json.dumps(final_scoreboard, indent=4))

if __name__ == "__main__":
    main()
