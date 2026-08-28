# FOG Technologies Computer Vision Scoreboard Data Extractor

An automated, pixel-perfect Computer Vision pipeline to detect and extract player names, active turns, roll scores, and cumulative frames from a bowling scoreboard video feed.

This repository also contains a fully responsive, interactive web dashboard deployable to **GitHub Pages** to visualize the extracted game data and statistics in real-time.

---

## 🌟 Features

1. **Scoreboard Visibility Detection**: Bypasses full-screen transitions, pin-deck views, and cartoon animations using Normalized Cross-Correlation (NCC) template matching on the lane number indicator.
2. **Active Player Turn Detection**: Identifies the highlighted active player row using HSV/RGB color segmentation.
3. **Robust Character Recognition (OCR)**: Uses shift-invariant sliding template matching to decode rolls (`X`, `/`, `-`, `1`-`9`) across active (dark on yellow) and inactive (white on blue) rows.
4. **Temporal Noise Filtering**: Requires character detections to be stable for 5 consecutive frames before committing, preventing single-frame transition glitches from polluting the data.
5. **Mathematical Validation**: Automatically calculates cumulative frame scores and totals using standard bowling rules, guaranteeing 100% data integrity.
6. **Live Interactive Dashboard**: A GitHub Pages ready static web app that displays scores, counts strikes and spares, and plots performance metrics using Chart.js.

---

## 🛠️ Tech Stack

- **Backend / CV Pipeline**: Python 3.14+, OpenCV (`opencv-python`), Numpy
- **Web Dashboard**: HTML5, CSS3, JavaScript (Tailwind CSS, Chart.js, FontAwesome)
- **Deployment**: GitHub Pages (fully static, zero-configuration)

---

## 📦 Project Structure

```
├── templates/                 # Reference templates for OCR matching
│   ├── template_lane.png      # Scoreboard lane indicator template
│   ├── X.png, spare.png, ...  # Tightly cropped roll symbol templates
├── config.py                  # Scoreboard pixel coordinate configurations
├── scoreboard_detector.py     # Scoreboard visibility and active row detection
├── extractor.py               # Slide-invariant character extraction
├── utils.py                   # Score calculator and OpenCV frame drawer
├── main.py                    # Main pipeline entry orchestrator
├── index.html                 # GitHub Pages landing page
├── style.css                  # Scoreboard specific styles
├── app.js                     # Scoreboard dynamic renderer and Chart.js code
├── scoreboard_data.json       # Live extracted JSON data output
└── README.md                  # Project documentation (this file)
```

---

## 🚀 Setup & Installation

### 1. Clone the Repository
```bash
git clone https://github.com/KGupta171025/FOG_Technologies_Computer_Vision_Engineer.git
cd FOG_Technologies_Computer_Vision_Engineer
```

### 2. Install Python Dependencies
Ensure you have Python 3.8+ installed, then install the required packages:
```bash
pip install opencv-python numpy
```

### 3. Place Input Video
Ensure the video file is named `bowling_scoreboard.mp4` and placed in the project root directory.

---

## 🏃 How to Run the Pipeline

Run the main orchestrator script:
```bash
python main.py
```

### Output Outputs:
1. `output_demo.mp4`: A fully annotated video showing the scoreboard bounding boxes, lane tracking status, active player, and extracted rolls/frame scores overlaid in real-time.
2. `scoreboard_data.json`: The final extracted scores saved as structured JSON.

---

## 🌐 GitHub Pages Deployment

The repository is built to work immediately on GitHub Pages!

1. Commit and push all files to your GitHub repository:
   ```bash
   git add .
   git commit -m "Implement CV pipeline and interactive web dashboard"
   git push origin main
   ```
2. In your GitHub Repository:
   - Go to **Settings** -> **Pages**.
   - Under **Build and deployment**, select **Deploy from a branch**.
   - Choose the `main` branch (root folder) and click **Save**.
3. Your interactive scoreboard will be live at `https://<your-username>.github.io/FOG_Technologies_Computer_Vision_Engineer/`.

> **Note on Local Execution:** Due to browser security restrictions (CORS), browsers block loading local JSON files via `fetch()` when opening `index.html` directly via `file://`. The webpage includes an automatic fallback that displays pre-populated mock data for demonstration if opened locally, along with instructions on running a quick local server:
> ```bash
> python -m http.server 8000
> ```

---

## 📈 Extracted JSON Data Schema

The extracted `scoreboard_data.json` format:
```json
{
    "JAGDISH": {
        "initial": "J",
        "rolls": [
            ["X", ""],
            ["5", "-"],
            ["-", "7"],
            ["4", ""],
            ["X", ""],
            ["", ""],
            ["", ""],
            ["", ""],
            ["", ""],
            ["", "", ""]
        ],
        "scores": [15, 20, 27, 31, 41, "", "", "", "", ""],
        "ttl": 41
    },
    ...
}
```
