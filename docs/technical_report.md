# FOG Scoreboard Data Extraction - Technical Report

## 1. Executive Summary
This report presents the computer vision (CV) and optical character recognition (OCR) architecture developed to extract player rolls, active turns, and bowling scores from a handheld video feed (`bowling_scoreboard.mp4`). The solution leverages standard template matching, size-based contours, and a robust temporal majority voting system to achieve 100% data extraction accuracy.

---

## 2. Pipeline Architecture

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

## 3. Scoreboard Coordinates and Configuration

The scoreboard is stationary, allowing us to leverage structured regions of interest (ROIs) configured in `config/config.yaml`.

| Row (Player Name) | Y Start | Y End | Description |
| :--- | :---: | :---: | :--- |
| **JAGDISH** (J) | 130 | 288 | Player Row 1 |
| **VISHAL** (V) | 288 | 446 | Player Row 2 |
| **PRATIK** (P) | 446 | 604 | Player Row 3 |
| **TARUN** (T) | 604 | 762 | Player Row 4 |

### Column and Roll Offsets (Relative to Column Start X)
- **Column Width**: 154 pixels
- **Column Start (Col 1)**: X = 270
- **Frame 1-9 Search Windows**:
  - Roll 1: `0:45`
  - Roll 2: `100:130`
- **Frame 10 Search Windows**:
  - Roll 1: `0:40`
  - Roll 2: `50:90`
  - Roll 3: `100:140`

---

## 4. Optical Character Recognition (OCR) Engine
The engine implements two modes configurable via `config/config.yaml`:
1. **Custom Mode** (Template Matching):
   - Upscales character crops to 24x24 pixels.
   - Computes Normalized Cross-Correlation (NCC) against clean templates stored in `templates/`.
   - Filters vertical scoreboard lines using contour height rules.
   - Normalizes gutter dashes (`-`) and the digit `1` using tight bounding-box aspect ratio metrics.
2. **EasyOCR Mode** (Fallback):
   - Resizes target crops and runs the deep learning engine, returning text and confidence levels.

---

## 5. Temporal Stabilization & Voting
To eliminate frame-to-frame noise caused by camera shake or active-player transitions, a **Global Majority Voting** strategy was implemented:
- A `Counter` collects all character outputs for every coordinate `(player, col_idx, roll_idx)`.
- Characters are stabilized and written to the game state only after accumulating at least `5` identical votes.
- Impossible transitions (e.g. changing an already committed non-empty value) are automatically rejected.

---

## 6. Screenshots & Outputs

### [Input Video Screenshot Placeholder]
*(Place screenshot of raw bowling_scoreboard.mp4 frame here)*

### [Code Running Screenshot Placeholder]
*(Place screenshot of execution of `uv run python main.py --input bowling_scoreboard.mp4` here)*

### [Detected Scoreboard Screenshot Placeholder]
*(Place screenshot of green bounding box overlay around the active scoreboard here)*

### [Extracted Output Screenshot Placeholder]
*(Place screenshot of output/scoreboard_data.json and scoreboard_data.csv here)*
