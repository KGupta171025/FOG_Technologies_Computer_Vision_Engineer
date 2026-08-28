# FOG Scoreboard Data Extraction - Demo Script

This guide outlines the step-by-step procedure to demonstrate the scoreboard extractor.

---

## Step 1: Virtual Environment Synchronization
First, build the virtual environment and synchronize dependencies:
```bash
uv sync
```
*Observe that `uv` creates a local `.venv` environment and installs PyYAML, OpenCV, NumPy, Pydantic, Pandas, Ruff, and Pytest.*

---

## Step 2: Running Unit Tests
Confirm code correctness and parser rules:
```bash
uv run pytest
```
*Observe that all unit tests for character normalization and bowling frame scores pass in milliseconds.*

---

## Step 3: Run the Main Video Processor CLI
Process the video with a frame-processing interval of `5` (runs extraction every 5th frame for speed):
```bash
uv run python main.py --input bowling_scoreboard.mp4 --frame-interval 5 --debug
```
*Observe the terminal output displaying video resolution (1920x1080), total frames (1735), and progress.*

---

## Step 4: Verify the Extracted Outputs
1. **JSON Data File**:
   View `output/scoreboard_data.json` to verify the parsed player rolls and cumulative scores.
2. **CSV Audit Trails**:
   View `output/scoreboard_data.csv` to see the frame-by-frame timestamp and raw OCR logs.
3. **Annotated Demo Video**:
   Play `output/annotated_video.mp4` to see the bounding boxes, active turn underline, and overlays.
4. **Intermediate Preprocessing**:
   Browse `output/debug_frames/` to inspect saved intermediate preprocessed crops.
