# FOG Scoreboard Data Extraction - Submission Checklist

Use this checklist to verify that all functional and engineering criteria are met.

- [x] **Video Inspection**: Report video metadata and extract debug frames to directory.
- [x] **Scoreboard Detection**: Bounding boxes drawn on frames, with coordinates configurable in `config.yaml`.
- [x] **Preprocessing**: Implement grayscaling, thresholding, and size filters.
- [x] **OCR Engine**: Standard template matcher matching symbols (X, /, -, 3-9) with confidence values, plus easyocr reader fallback support.
- [x] **Structured Data**: JSON and CSV output files generated under `output/`.
- [x] **Temporal Validation**: Global majority voting (min 5 votes) used to stabilize symbols and block flickering.
- [x] **CLI Options**: Support `--input`, `--output-dir`, `--frame-interval`, `--confidence-threshold`, and `--debug` flags.
- [x] **Engineering Hygiene**: virtual envs, python caches, and raw videos gitignored. No credentials committed.
- [x] **Quality Control**: Formatting, linting (`ruff`), and unit test suite (`pytest`) fully passing.
