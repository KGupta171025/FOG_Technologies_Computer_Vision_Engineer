import os
from typing import Dict, Tuple

import yaml
from pydantic import BaseModel


class ScoreboardConfig(BaseModel):
    lane_template_roi: Tuple[int, int, int, int]
    lane_ncc_threshold: float

class GridConfig(BaseModel):
    col_start_x: int
    col_width: int
    crop_y_start: int
    crop_y_end: int
    roll1_roi_x: Tuple[int, int]
    roll2_roi_x: Tuple[int, int]
    roll1_f10_x: Tuple[int, int]
    roll2_f10_x: Tuple[int, int]
    roll3_f10_x: Tuple[int, int]

class OcrConfig(BaseModel):
    mode: str
    binary_threshold: int
    confidence_threshold: float
    min_required_votes: int
    active_row_threshold_red: int
    active_row_threshold_blue: int

class AppConfig(BaseModel):
    scoreboard: ScoreboardConfig
    player_rows: Dict[str, Tuple[int, int]]
    player_names: Dict[str, str]
    grid: GridConfig
    ocr: OcrConfig

def load_config(config_path: str = None) -> AppConfig:
    """
    Loads and validates the configuration from YAML.
    """
    if config_path is None:
        # Fallback relative to project root
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        config_path = os.path.join(base_dir, "config", "config.yaml")

    if not os.path.exists(config_path):
        raise FileNotFoundError(f"Configuration file not found at: {config_path}")

    with open(config_path, "r") as f:
        config_data = yaml.safe_load(f)

    return AppConfig(**config_data)
