import argparse
import os
import sys

# Ensure package is on sys.path
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "src"))

from scoreboard_extractor.config import load_config
from scoreboard_extractor.video_processor import VideoProcessor


def select_video_file_gui() -> str:
    """Opens a native GUI file selector dialog to choose a video file."""
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        file_path = filedialog.askopenfilename(
            title="Select Bowling Video File",
            filetypes=[("Video Files", "*.mp4 *.webm *.mov *.avi"), ("All Files", "*.*")]
        )
        root.destroy()
        return file_path
    except Exception:
        return ""


def main():
    parser = argparse.ArgumentParser(description="FOG Scoreboard Data Extraction CLI")
    parser.add_argument(
        "--input",
        type=str,
        default=None,
        help="Path to the input video file (default: bowling_scoreboard.mp4 or input_compressed.mp4)"
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="output",
        help="Path to the output directory (default: output)"
    )
    parser.add_argument(
        "--frame-interval",
        type=int,
        default=5,
        help="Frame-processing interval (default: 5)"
    )
    parser.add_argument(
        "--confidence-threshold",
        type=float,
        default=0.60,
        help="OCR confidence filter threshold (default: 0.60)"
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug mode (saves raw intermediate frames)"
    )

    args = parser.parse_args()

    # 1. Resolve video input file
    input_path = args.input
    if not input_path:
        # Check standard default filenames
        if os.path.exists("bowling_scoreboard.mp4"):
            input_path = "bowling_scoreboard.mp4"
        elif os.path.exists("input_compressed.mp4"):
            input_path = "input_compressed.mp4"
        else:
            print("No input video specified. Opening file selector dialog...")
            input_path = select_video_file_gui()

    if not input_path or not os.path.exists(input_path):
        print(f"Error: Input video file not found at: '{input_path}'", file=sys.stderr)
        print("Please provide a valid video file with --input <path_to_video>", file=sys.stderr)
        sys.exit(1)

    print(f"Input Video Selected: {input_path}")
    print("Loading configuration config/config.yaml...")
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config", "config.yaml")
    try:
        config = load_config(config_path)
    except Exception as e:
        print(f"Error: Failed to parse configuration: {e}", file=sys.stderr)
        sys.exit(1)

    template_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates", "template_lane.png")
    templates_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates")

    # Reconfigure stdout to utf-8 if possible
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

    # 2. Instantiate and execute the pipeline
    processor = VideoProcessor(config, template_path, templates_dir)

    print("\n" + "=" * 65)
    print("  FOG TECHNOLOGIES - BOWLING SCOREBOARD EXTRACTION PIPELINE")
    print("=" * 65)
    print("Pipeline Workflow:")
    print("  [1] Open Video & Inspect Stream Headers")
    print("  [2] Read Video Frame-by-Frame (Interval Sampling)")
    print("  [3] Locate Scoreboard Region via NCC Landmark Matching")
    print("  [4] Preprocess Scoreboard ROI & Invert Active Player Rows")
    print("  [5] OCR Symbol Recognition & Character Classification")
    print("  [6] Clean, Validate, and Structure 10-Frame Bowling Scoreboard")
    print("=" * 65)

    print("\n[Step 1/6] Opening video & inspecting stream...")
    metadata = processor.inspect_video(input_path)
    print(f"  [+] Video Resolution : {metadata['resolution']}")
    print(f"  [+] Stream Framerate  : {metadata['fps']:.2f} FPS")
    print(f"  [+] Total Frame Count : {metadata['total_frames']} frames")
    print(f"  [+] Video Duration    : {metadata['duration_seconds']:.2f} seconds")

    print("\n[Step 2-5/6] Processing frames, locating scoreboard, OCR extraction & temporal voting...")
    try:
        video_out, csv_out, json_out = processor.process(
            video_path=input_path,
            output_dir=args.output_dir,
            frame_interval=args.frame_interval,
            confidence_threshold=args.confidence_threshold,
            debug=args.debug
        )
        print("\n[Step 6/6] Pipeline Execution Completed Successfully!")
        print("\n" + "=" * 65)
        print("  EXTRACTED FINAL SCOREBOARD DATA")
        print("=" * 65)

        # Print formatted terminal scoreboard table
        import json
        if os.path.exists(json_out):
            with open(json_out, "r", encoding="utf-8") as f:
                sb_data = json.load(f)

            header = f"{'PLAYER':<10} | " + " | ".join([f"F{i+1:>2}" for i in range(10)]) + " | TTL"
            print(header)
            print("-" * len(header))
            for player, pdata in sb_data.items():
                rolls_str = []
                for f_idx, frame_rolls in enumerate(pdata.get("rolls", [])):
                    r_str = "".join([r if r else " " for r in frame_rolls])
                    rolls_str.append(f"{r_str:^3}")
                ttl_val = pdata.get("ttl", "-")
                row_str = f"{player:<10} | " + " | ".join(rolls_str) + f" | {ttl_val:>3}"
                print(row_str)
            print("-" * len(header))

        print("\nGenerated Artifacts & Export Files:")
        print(f"  [OK] Annotated Video Output : {video_out}")
        print(f"  [OK] CSV Frame Audit Log    : {csv_out}")
        print(f"  [OK] JSON Structured Data   : {json_out}")
        print("=" * 65 + "\n")

    except Exception as e:
        print(f"\n[ERR] Pipeline error occurred: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
