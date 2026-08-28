import os

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")

# Video Settings
VIDEO_PATH = os.path.join(BASE_DIR, "bowling_scoreboard.mp4")
OUTPUT_VIDEO_PATH = os.path.join(BASE_DIR, "output_demo.mp4")
OUTPUT_JSON_PATH = os.path.join(BASE_DIR, "scoreboard_data.json")

# Dimensions & Grid Coordinates
FRAME_WIDTH = 1920
FRAME_HEIGHT = 1080

# Lane template bounding box (x_start, y_start, width, height)
LANE_TEMPLATE_ROI = (30, 20, 105, 100)

# Active player name ROI
NAME_ROI = (280, 30, 620, 50)

# Player Rows Y coordinates
PLAYER_ROWS = {
    'J': (130, 288),
    'V': (288, 446),
    'P': (446, 604),
    'T': (604, 762)
}

# Player Full Names mapping
PLAYER_NAMES = {
    'J': 'JAGDISH',
    'V': 'VISHAL',
    'P': 'PRATIK',
    'T': 'TARUN'
}

# Score Grid Columns (X coordinates)
COL_START_X = 270
COL_WIDTH = 154
NUM_FRAMES = 10

# Finalized Y range to keep minus character and exclude cumulative scores
CROP_Y_START = 20
CROP_Y_END = 43

# Left-aligned character search windows to avoid vertical and horizontal noise
ROLL1_ROI_X = (0, 45)
ROLL2_ROI_X = (100, 130)

# Frame 10 rolls (three boxes, left-aligned)
ROLL1_F10_X = (0, 40)
ROLL2_F10_X = (50, 90)
ROLL3_F10_X = (100, 140)

# Bounding Box for Total Score (TTL) column
TTL_COL_X = (1810, 1915)

# Color thresholds for detecting yellow row highlights (Active player check)
ACTIVE_ROW_THRESHOLD_RED = 180
ACTIVE_ROW_THRESHOLD_BLUE = 100
