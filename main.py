import argparse
import os
import sys

# Ensure package is on sys.path
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "src"))

from scoreboard_extractor.config import load_config
from scoreboard_extractor.video_processor import VideoProcessor


def main():
    parser = argparse.ArgumentParser(description="FOG Scoreboard Data Extraction CLI")
    parser.add_argument(
        "--input",
        type=str,
        required=True,
        help="Path to the input video file (e.g. bowling_scoreboard.mp4)"
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

    # 1. Verify files exist
    if not os.path.exists(args.input):
        print(f"Error: Input video file not found at: {args.input}", file=sys.stderr)
        sys.exit(1)

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
    metadata = processor.inspect_video(args.input)
    print("Video Metadata:")
    print(f"  - Resolution: {metadata['resolution']}")
    print(f"  - FPS: {metadata['fps']:.2f}")
    print(f"  - Total Frames: {metadata['total_frames']}")
    print(f"  - Duration: {metadata['duration_seconds']:.2f} seconds")

    try:
        video_out, csv_out, json_out = processor.process(
            video_path=args.input,
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
