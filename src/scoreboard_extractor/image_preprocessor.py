import os

import cv2
import numpy as np


class ImagePreprocessor:
    @staticmethod
    def to_grayscale(image: np.ndarray) -> np.ndarray:
        """Converts BGR image to grayscale."""
        if len(image.shape) == 3:
            return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        return image

    @staticmethod
    def crop(image: np.ndarray, x: int, y: int, w: int, h: int) -> np.ndarray:
        """Crops the image to specified ROI."""
        return image[y:y+h, x:x+w]

    @staticmethod
    def resize(image: np.ndarray, target_w: int, target_h: int) -> np.ndarray:
        """Resizes/upscales image to target dimensions."""
        return cv2.resize(image, (target_w, target_h), interpolation=cv2.INTER_CUBIC)

    @staticmethod
    def enhance_contrast(image: np.ndarray) -> np.ndarray:
        """Applies CLAHE (Contrast Limited Adaptive Histogram Equalization)."""
        gray = ImagePreprocessor.to_grayscale(image)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        return clahe.apply(gray)

    @staticmethod
    def reduce_noise(image: np.ndarray) -> np.ndarray:
        """Applies bilateral filter for noise reduction while preserving edges."""
        return cv2.bilateralFilter(image, 5, 75, 75)

    @staticmethod
    def threshold(image: np.ndarray, thresh_val: int = 150) -> np.ndarray:
        """Binarizes the image using thresholding."""
        gray = ImagePreprocessor.to_grayscale(image)
        _, th = cv2.threshold(gray, thresh_val, 255, cv2.THRESH_BINARY)
        return th

    @staticmethod
    def sharpen(image: np.ndarray) -> np.ndarray:
        """Applies a sharpening filter kernel."""
        kernel = np.array([[-1, -1, -1],
                           [-1,  9, -1],
                           [-1, -1, -1]])
        return cv2.filter2D(image, -1, kernel)

    @staticmethod
    def save_debug_image(image: np.ndarray, filename: str, debug_dir: str):
        """Saves a preprocessing intermediate image in debug mode."""
        if not os.path.exists(debug_dir):
            os.makedirs(debug_dir, exist_ok=True)
        out_path = os.path.join(debug_dir, filename)
        cv2.imwrite(out_path, image)
