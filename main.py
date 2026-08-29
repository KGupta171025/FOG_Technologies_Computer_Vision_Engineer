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

    # 2. Instantiate and execute the pipeline
    processor = VideoProcessor(config, template_path, templates_dir)

    print("Running video inspection...")
    metadata = processor.inspect_video(input_path)
    print("Video Metadata:")
    print(f"  - Resolution: {metadata['resolution']}")
    print(f"  - FPS: {metadata['fps']:.2f}")
    print(f"  - Total Frames: {metadata['total_frames']}")
    print(f"  - Duration: {metadata['duration_seconds']:.2f} seconds")

    try:
        video_out, csv_out, json_out = processor.process(
            video_path=input_path,
            output_dir=args.output_dir,
            frame_interval=args.frame_interval,
            confidence_threshold=args.confidence_threshold,
            debug=args.debug
        )
        print("\nProcessing completed successfully!")
        print("Outputs generated:")
        print(f"  - Annotated Video: {video_out}")
        print(f"  - CSV Audit Data: {csv_out}")
        print(f"  - JSON Scoreboard: {json_out}")
    except Exception as e:
        print(f"Pipeline error occurred: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
