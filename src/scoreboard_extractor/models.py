from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field


class OCRResult(BaseModel):
    """
    Represents a single raw OCR prediction from any engine.
    """
    text: str
    confidence: float
    bbox: Optional[List[List[int]]] = None

class FrameRecord(BaseModel):
    """
    Pydantic schema representing the required record metadata to save
    in CSV/JSON outputs for every processed frame.
    """
    frame_number: int
    video_timestamp: float
    raw_ocr_text: str
    ocr_confidence: float
    parsed_fields: Dict[str, Any]

class PlayerState(BaseModel):
    """
    Represents the structured score state of a single player.
    """
    name: str
    initial: str
    rolls: List[List[str]] = Field(default_factory=lambda: [["", ""] for _ in range(9)] + [["", "", ""]])
    scores: List[Union[int, str]] = Field(default_factory=lambda: [""] * 10)
    ttl: Union[int, str] = ""
