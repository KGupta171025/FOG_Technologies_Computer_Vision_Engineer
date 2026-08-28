# FOG Scoreboard Data Extraction

An automated, production-quality Computer Vision (CV) pipeline to detect and extract player names, active turns, roll scores, and cumulative frames from a bowling scoreboard video feed.

This repository also contains a fully responsive, interactive web dashboard deployable to **GitHub Pages** to visualize the extracted game data and statistics in real-time.

---

## 🌟 Solution Architecture

```
                       [ Input Video Frame ]
                                 │
                                 ▼
                     [ Scoreboard Visibility ]  ──(Hidden)──► [ Skip Frame ]
                                 │
                             (Visible)
                                 ▼
                    [ Active Row Segmentation ] ──► [ Invert Crop if Active ]
                                 │
                                 ▼
                      [ Grayscale Binarization ]
                                 │
                                 ▼
                    [ Size Heuristics Filter ]  ──► [ '-' Gutter & '1' Digit ]
                                 │
                           (Other Digits)
                                 ▼
                      [ Template Matching NCC ] ──► [ Strikes, Spares, 3-9 ]
                                 │
                                 ▼
                   [ Temporal Majority Voting ] ──► [ Commits & Score Updates ]
```

---

## 🛠️ Project Structure

```
├── config/
│   └── config.yaml            # Pipeline parameters (RGB, NCC thresholds, crop offsets)
├── src/
│   └── scoreboard_extractor/  # Core package source
│       ├── __init__.py
│       ├── config.py          # Pydantic configuration loader
│       ├── video_processor.py # Frame looping orchestrator
│       ├── scoreboard_detector.py # Visibility and active player checks
│       ├── image_preprocessor.py # Gray, threshold, resize, and crop tools
│       ├── ocr_engine.py      # Custom Template Matching + EasyOCR fallback
│       ├── data_parser.py     # Scores calculator and error normalizer
│       ├── temporal_validator.py # Stable majority voter per scoreboard cell
│       ├── annotator.py       # HUD overlay drawing functions
│       └── models.py          # Frame record and scoreboard state models
├── tests/                     # Automated unit testing suite
│   ├── test_data_parser.py
│   └── test_temporal_validator.py
├── output/                    # Local CLI output files (CSV, JSON, MP4)
├── docs/                      # Presentation and technical documentation
│   ├── technical_report.md
│   ├── demo_script.md
│   └── submission_checklist.md
├── index.html                 # Interactive Web Dashboard
├── app.js                     # Dashboard script and Chart.js integration
├── main.py                    # Command-line interface entry orchestrator
├── pyproject.toml             # uv package dependencies
└── README.md                  # This file
```

---

## 🚀 Setup & Installation

### 1. Synchronize Dependencies
Ensure you have `uv` installed, then run the environment synchronizer:
```bash
uv sync
```
*This command automatically initializes a local `.venv` environment and installs all dependencies (`opencv-python`, `numpy`, `easyocr`, `pandas`, `pyyaml`, `pydantic`, `pytest`, `ruff`).*

### 2. Verify with Unit Tests
Execute the unit testing suite:
```bash
uv run pytest
```

---

## 🏃 How to Run the Pipeline

Run the main orchestrator script using the command-line interface:
```bash
uv run python main.py --input bowling_scoreboard.mp4 --frame-interval 5 --debug
```

### Supported CLI Arguments:
- `--input` (required): Path to the input video file (e.g. `bowling_scoreboard.mp4`).
- `--output-dir` (optional): Path to the output directory (default: `output`).
- `--frame-interval` (optional): Skip interval for frame processing (default: `5`).
- `--confidence-threshold` (optional): OCR confidence filter (default: `0.60`).
- `--debug` (optional): Enables saving preprocessed debug frames to `output/debug_frames/`.

---

## 🌐 GitHub Pages Dashboard Deployment

The repository is built to work immediately on GitHub Pages!

1. Go to your repository settings on GitHub (**Settings** -> **Pages**).
2. Under **Build and deployment**, select **Deploy from a branch**.
3. Choose the `main` branch (root folder) and click **Save**.
4. Your interactive scoreboard will be live at `https://<your-username>.github.io/FOG_Technologies_Computer_Vision_Engineer/`.

> **Note on Local Execution:** Due to browser security restrictions (CORS), browsers block loading local JSON files via `fetch()` when opening `index.html` directly via `file://`. The webpage includes an automatic fallback that displays pre-populated mock data for demonstration if opened locally, along with instructions on running a quick local server:
> ```bash
> python -m http.server 8000
> ```

---

## 🛡️ Preprocessing and Character Normalization
- **Preprocess**: Each roll box is cropped relative to its column start using sub-pixel Y boundaries (`20:43`). The crop is grayscaled and thresholded at `150` to isolate symbols.
- **Normalization**: The data parser translates common OCR errors depending on the slot context (e.g., converting `O` to `-` or `0` depending on the roll position).
- **Assumptions**: The scoreboard remains stationary within the video frame and has a fixed layout.
- **Known Limitations**: If the camera shifts heavily or the scoreboard layout is modified, the ROIs must be updated inside `config/config.yaml`.
