import cv2
import numpy as np
import config

def parse_roll_val(val, prev_val=0):
    if val is None or val == "" or val == " ":
        return None
    if val == "X":
        return 10
    if val == "/":
        return 10 - prev_val
    if val == "-":
        return 0
    try:
        return int(val)
    except ValueError:
        return None

def calculate_bowling_scores(player_frames):
    """
    Calculates cumulative scores for a player given their 10 frames of rolls.
    player_frames is a list of 10 lists:
      - frames 1-9: [roll_1, roll_2]
      - frame 10: [roll_1, roll_2, roll_3]
    Returns a list of 10 cumulative scores (integers or None).
    """
    # Build a flat list of rolls that were actually thrown
    flat_rolls = []
    # Store tuples of (frame_idx, roll_idx, symbol, numeric_value)
    for f_idx, frame in enumerate(player_frames):
        for r_idx, roll in enumerate(frame):
            if roll is None or roll == "" or roll == " ":
                # Do not count empty rolls in strikes or non-thrown yet
                continue
                
            prev_num_val = 0
            if r_idx == 1 and len(flat_rolls) > 0:
                last_roll = flat_rolls[-1]
                if last_roll[0] == f_idx and last_roll[3] is not None:
                    prev_num_val = last_roll[3]
                    
            num_val = parse_roll_val(roll, prev_num_val)
            flat_rolls.append((f_idx, r_idx, roll, num_val))
            
    cumulative_scores = [""] * 10
    current_sum = 0
    
    for f_idx in range(10):
        # Gather all rolls belonging to this frame
        frame_rolls = [r for r in flat_rolls if r[0] == f_idx]
        
        if not frame_rolls:
            break
            
        is_strike = frame_rolls[0][2] == 'X'
        is_spare = f_idx < 9 and len(frame_rolls) > 1 and frame_rolls[1][2] == '/'
        
        if f_idx < 9:
            if is_strike:
                # Need 2 more rolls after this strike
                strike_idx = next(i for i, r in enumerate(flat_rolls) if r[0] == f_idx and r[1] == 0)
                next_rolls = flat_rolls[strike_idx+1:]
                if len(next_rolls) >= 2:
                    val1 = next_rolls[0][3]
                    val2 = next_rolls[1][3]
                    if val1 is not None and val2 is not None:
                        current_sum += 10 + val1 + val2
                        cumulative_scores[f_idx] = current_sum
                    else:
                        break
                else:
                    break
            elif is_spare:
                # Need 1 more roll after this spare
                spare_idx = next(i for i, r in enumerate(flat_rolls) if r[0] == f_idx and r[1] == 1)
                next_rolls = flat_rolls[spare_idx+1:]
                if len(next_rolls) >= 1:
                    val1 = next_rolls[0][3]
                    if val1 is not None:
                        current_sum += 10 + val1
                        cumulative_scores[f_idx] = current_sum
                    else:
                        break
                else:
                    break
            else:
                # Open frame. Must have exactly 2 rolls recorded
                if len(frame_rolls) == 2:
                    val1 = frame_rolls[0][3]
                    val2 = frame_rolls[1][3]
                    if val1 is not None and val2 is not None:
                        current_sum += val1 + val2
                        cumulative_scores[f_idx] = current_sum
                    else:
                        break
                else:
                    break
        else:
            # Frame 10:
            val1 = frame_rolls[0][3] if len(frame_rolls) > 0 else None
            val2 = frame_rolls[1][3] if len(frame_rolls) > 1 else None
            val3 = frame_rolls[2][3] if len(frame_rolls) > 2 else None
            
            if val1 is None:
                break
                
            is_f10_strike = frame_rolls[0][2] == 'X'
            is_f10_spare = len(frame_rolls) > 1 and frame_rolls[1][2] == '/'
            
            if is_f10_strike or is_f10_spare:
                if val1 is not None and val2 is not None and val3 is not None:
                    current_sum += val1 + val2 + val3
                    cumulative_scores[f_idx] = current_sum
                else:
                    break
            else:
                if val1 is not None and val2 is not None:
                    current_sum += val1 + val2
                    cumulative_scores[f_idx] = current_sum
                else:
                    break
                    
    return cumulative_scores

def draw_overlay(frame, scoreboard_state, active_player, ncc_score, scoreboard_visible):
    """
    Draws the real-time computer vision annotations on the video frame.
    """
    h, w, c = frame.shape
    
    # 1. Draw top status bar showing scoreboard visibility and active player
    cv2.rectangle(frame, (0, 0), (w, 60), (0, 0, 0), -1)
    status_text = f"SCOREBOARD: {'VISIBLE' if scoreboard_visible else 'HIDDEN'} (NCC: {ncc_score:.3f})"
    color_status = (0, 255, 0) if scoreboard_visible else (0, 0, 255)
    cv2.putText(frame, status_text, (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color_status, 2)
    
    if scoreboard_visible:
        active_name = config.PLAYER_NAMES.get(active_player, "NONE")
        cv2.putText(frame, f"ACTIVE PLAYER: {active_name}", (800, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
        
        # Draw bounding box around Lane number ROI
        lx, ly, lw, lh = config.LANE_TEMPLATE_ROI
        cv2.rectangle(frame, (lx, ly), (lx+lw, ly+lh), (0, 255, 0), 2)
        cv2.putText(frame, "LANE 6 DETECTED", (lx, ly - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 0), 1)
        
        # 2. Highlight grid rows and draw extracted data overlay
        for player, (y_start, y_end) in config.PLAYER_ROWS.items():
            is_active = (player == active_player)
            # Row border color
            border_color = (0, 255, 255) if is_active else (255, 0, 0)
            thickness = 3 if is_active else 1
            
            # Draw row rectangle
            cv2.rectangle(frame, (45, y_start), (1915, y_end), border_color, thickness)
            
            # Label player name on the row
            player_name = config.PLAYER_NAMES[player]
            cv2.putText(frame, f"{player_name}", (50, y_start + 40), cv2.FONT_HERSHEY_SIMPLEX, 0.5, border_color, 1)
            
            # Display current total score on the overlay
            player_data = scoreboard_state.get(player, {})
            final_ttl = player_data.get("ttl", 0)
            cv2.putText(frame, f"TTL: {final_ttl}", (1820, y_start + 140), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            
            # Loop over columns and draw overlays
            col_width = config.COL_WIDTH
            for i in range(10):
                x_col = config.COL_START_X + i * col_width
                
                # Draw column borders
                cv2.rectangle(frame, (x_col, y_start), (x_col + col_width, y_end), (200, 200, 200), 1)
                
                # Overlay extracted rolls
                rolls = player_data.get("rolls", [None]*10)
                if i < len(rolls) and rolls[i] is not None:
                    # Roll symbols
                    roll_syms = [s if s is not None else " " for s in rolls[i]]
                    roll_text = " ".join(roll_syms)
                    cv2.putText(frame, roll_text, (x_col + 30, y_start + 45), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
                
                # Overlay calculated frame scores
                scores = player_data.get("scores", [None]*10)
                if i < len(scores) and scores[i] is not None:
                    cv2.putText(frame, str(scores[i]), (x_col + 50, y_start + 140), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                    
    return frame
