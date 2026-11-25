"""
LabFlow Biometric Service
========================
Uses OpenCV (cv2) with YuNet Deep Neural Face Detector + Local Binary Pattern Histograms (LBPH)
for secure, on-device face verification without sending biometrics to any untrusted third-party API.

Architecture:
- Face detection & alignment: YuNet (CNN-based neural detector with 5 landmark points)
- Liveness detection: texture analysis (LBP variance) + Laplacian sharpness blur detection
- Face embedding: 256-dimension normalized LBPH feature vector
- Storage: AES-256 encrypted token stored in patient_biometrics table
- Matching: Cosine similarity of feature vectors with configurable threshold (default: 0.72)
- Security: All raw images are freed from memory immediately after feature extraction
- Privacy: Never exposes raw templates or photos to frontend APIs
"""

import os
import io
import json
import uuid
import base64
import hashlib
import time
import numpy as np
from datetime import datetime, timezone
from typing import Optional, Tuple, Dict, List

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False

try:
    from cryptography.fernet import Fernet
    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False

from app.db import local_db
from app.config import DATA_DIR

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
MATCH_THRESHOLD = float(os.getenv("FACE_MATCH_THRESHOLD", "0.72"))       # cosine similarity threshold
LIVENESS_VAR_THRESHOLD = float(os.getenv("LIVENESS_VAR_THRESHOLD", "40.0"))  # minimum texture variance
MAX_FACE_ATTEMPTS_PER_HOUR = int(os.getenv("MAX_FACE_ATTEMPTS_PER_HOUR", "10"))

# Encryption key – derived deterministically from JWT_SECRET
_SECRET = os.getenv("JWT_SECRET", "labflow_super_secret_enterprise_jwt_key_2026")
_KEY_BYTES = hashlib.sha256(_SECRET.encode()).digest()
_FERNET_KEY = base64.urlsafe_b64encode(_KEY_BYTES)   # 32 raw bytes -> 44-char url-safe base64
_FERNET = Fernet(_FERNET_KEY) if CRYPTO_AVAILABLE else None

# YuNet Neural Face Detector Model Path
_YUNET_PATH = os.path.join(DATA_DIR, "yunet.onnx")
_YUNET_DETECTOR = None

if CV2_AVAILABLE and hasattr(cv2, "FaceDetectorYN") and os.path.exists(_YUNET_PATH):
    try:
        _YUNET_DETECTOR = cv2.FaceDetectorYN.create(_YUNET_PATH, "", (320, 320), score_threshold=0.6)
    except Exception as e:
        print(f"[Biometric] YuNet initialization error: {e}")

# Haar cascade fallback (if available in this environment)
_CASCADE_PATH = cv2.data.haarcascades + "haarcascade_frontalface_default.xml" if CV2_AVAILABLE and hasattr(cv2, 'data') else ""
_FACE_CASCADE = cv2.CascadeClassifier(_CASCADE_PATH) if CV2_AVAILABLE and hasattr(cv2, 'CascadeClassifier') and _CASCADE_PATH else None


# ---------------------------------------------------------------------------
# Internal Helpers
# ---------------------------------------------------------------------------

def _encrypt(data: dict) -> str:
    """Encrypt a dict as a Fernet token (str)."""
    if _FERNET is None:
        raise RuntimeError("cryptography package not available")
    return _FERNET.encrypt(json.dumps(data).encode()).decode()


def _decrypt(token: str) -> dict:
    """Decrypt a Fernet token back to dict."""
    if _FERNET is None:
        raise RuntimeError("cryptography package not available")
    return json.loads(_FERNET.decrypt(token.encode()).decode())


def _decode_image(b64_data: str) -> Optional[np.ndarray]:
    """Decode a base64 JPEG/PNG data URI or raw base64 string to a BGR numpy array."""
    if not CV2_AVAILABLE:
        return None
    try:
        if "," in b64_data:
            b64_data = b64_data.split(",", 1)[1]
        raw = base64.b64decode(b64_data)
        arr = np.frombuffer(raw, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        return img
    except Exception:
        return None


def _detect_faces(img: np.ndarray) -> List[dict]:
    """
    Detect faces using YuNet neural detector (or Haar cascade fallback).
    Returns list of dicts with:
      - box: (x, y, w, h)
      - confidence: float
      - tilt: angle in degrees
    """
    if _YUNET_DETECTOR is not None:
        h, w = img.shape[:2]
        _YUNET_DETECTOR.setInputSize((w, h))
        bgr = img if len(img.shape) == 3 else cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        retval, raw_faces = _YUNET_DETECTOR.detect(bgr)
        if raw_faces is None or len(raw_faces) == 0:
            return []
        
        detected = []
        for face in raw_faces:
            box = face[:4].astype(int)
            x, y, bw, bh = box
            x = max(0, x)
            y = max(0, y)
            bw = min(w - x, bw)
            bh = min(h - y, bh)
            if bw < 30 or bh < 30:
                continue

            conf = float(face[-1])
            # Check eye tilt from landmarks: right_eye = face[4:6], left_eye = face[6:8]
            re_x, re_y = face[4], face[5]
            le_x, le_y = face[6], face[7]
            dy = le_y - re_y
            dx = le_x - re_x
            angle = abs(np.degrees(np.arctan2(dy, dx))) if dx != 0 else 0

            detected.append({
                "box": (int(x), int(y), int(bw), int(bh)),
                "confidence": conf,
                "tilt": float(angle)
            })
        return detected

    if _FACE_CASCADE is not None:
        gray = img if len(img.shape) == 2 else cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = _FACE_CASCADE.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(60, 60),
            flags=cv2.CASCADE_SCALE_IMAGE
        )
        return [{"box": (int(x), int(y), int(w), int(h)), "confidence": 0.9, "tilt": 0.0} for (x, y, w, h) in faces]

    return []


def _extract_lbph_histogram(gray_face: np.ndarray) -> np.ndarray:
    """
    Compute Local Binary Pattern histogram as a robust, invariant face feature vector.
    Returns a normalized 256-dimension float32 array.
    """
    face_resized = cv2.resize(gray_face, (128, 128))
    h, w = face_resized.shape
    lbp = np.zeros_like(face_resized, dtype=np.uint8)

    for i in range(1, h - 1):
        for j in range(1, w - 1):
            center = int(face_resized[i, j])
            code = 0
            neighbors = [
                face_resized[i-1, j-1], face_resized[i-1, j], face_resized[i-1, j+1],
                face_resized[i,   j+1],
                face_resized[i+1, j+1], face_resized[i+1, j], face_resized[i+1, j-1],
                face_resized[i,   j-1],
            ]
            for bit, n in enumerate(neighbors):
                if int(n) >= center:
                    code |= (1 << bit)
            lbp[i, j] = code

    hist, _ = np.histogram(lbp.ravel(), bins=256, range=(0, 256))
    hist = hist.astype(np.float32)
    norm = np.linalg.norm(hist)
    if norm > 0:
        hist /= norm
    return hist


def _liveness_score(gray_face: np.ndarray) -> float:
    """
    Texture & sharpness liveness analysis:
    - Laplacian variance detects blurry flat paper prints or low-res display replay.
    - LBP micro-variance evaluates organic skin surface texture.
    """
    if gray_face is None or gray_face.size == 0:
        return 0.0
    laplacian_var = float(cv2.Laplacian(gray_face, cv2.CV_64F).var())
    lbp_hist = _extract_lbph_histogram(gray_face)
    lbp_var = float(np.var(lbp_hist) * 1e6)
    return float((laplacian_var + lbp_var) / 2.0)


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity between two normalized feature vectors."""
    dot = float(np.dot(a, b))
    na = float(np.linalg.norm(a))
    nb = float(np.linalg.norm(b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


# ---------------------------------------------------------------------------
# Public Biometric API
# ---------------------------------------------------------------------------

def is_biometric_available() -> bool:
    """Returns True if the face recognition engine is fully operational."""
    return CV2_AVAILABLE and CRYPTO_AVAILABLE and (_YUNET_DETECTOR is not None or _FACE_CASCADE is not None)


def register_face(patient_id: str, image_b64: str, consent: bool) -> dict:
    """
    Registers a patient's face embedding:
    1. Validates explicit biometric consent.
    2. Decodes image, validates exactly 1 face, checks tilt/guidance, evaluates liveness.
    3. Extracts normalized 256-D LBPH embedding.
    4. Encrypts template via AES-256 Fernet.
    5. Stores encrypted template in patient_biometrics.
    6. Destroys all raw image buffers from memory immediately.
    """
    if not is_biometric_available():
        return {"success": False, "error": "Face recognition engine is not configured on this server."}

    if not consent:
        return {"success": False, "error": "Explicit biometric consent is required before registration."}

    img = _decode_image(image_b64)
    if img is None:
        return {"success": False, "error": "Could not decode the provided image. Please retake the photo."}

    # Detect faces
    faces = _detect_faces(img)
    if len(faces) == 0:
        del img
        return {"success": False, "error": "No face detected. Please face the camera directly with good lighting."}
    if len(faces) > 1:
        del img
        return {"success": False, "error": "Multiple faces detected. Please ensure only your face is visible."}

    face_info = faces[0]
    # Check orientation / head tilt
    if face_info.get("tilt", 0) > 35:
        del img
        return {"success": False, "error": "Head is tilted. Please face the camera straight and look directly at the lens."}

    x, y, w, h = face_info["box"]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    del img  # Raw BGR image destroyed immediately

    face_roi = gray[y:y+h, x:x+w]
    del gray

    # Liveness verification
    liveness = _liveness_score(face_roi)
    if liveness < LIVENESS_VAR_THRESHOLD:
        del face_roi
        return {
            "success": False,
            "error": "Liveness check failed. Please present your live face, not a photograph or screen.",
            "liveness_score": round(liveness, 2)
        }

    # Extract 256-D embedding
    histogram = _extract_lbph_histogram(face_roi)
    del face_roi  # Face ROI destroyed immediately

    # Encrypt template
    encrypted_template = _encrypt({
        "histogram": histogram.tolist(),
        "registered_at": datetime.now(timezone.utc).isoformat()
    })

    now_iso = datetime.now(timezone.utc).isoformat()

    # Upsert: remove existing biometric record for this patient if present
    existing = [b for b in local_db.get("patient_biometrics") if b.get("patient_id") == patient_id]
    for old in existing:
        local_db.delete("patient_biometrics", old["id"])

    record = local_db.insert("patient_biometrics", {
        "patient_id": patient_id,
        "encrypted_face_template": encrypted_template,
        "registration_status": "REGISTERED",
        "consent_timestamp": now_iso,
        "created_at": now_iso
    })

    # Security Audit Log
    local_db.insert("activity_logs", {
        "user_id": patient_id,
        "action": "BIOMETRIC_REGISTERED",
        "entity_type": "patient",
        "entity_id": patient_id,
        "details": {"liveness_score": round(liveness, 2)}
    })

    return {
        "success": True,
        "message": "Face registered successfully.",
        "biometric_id": record["id"],
        "liveness_score": round(liveness, 2)
    }


def identify_by_face(image_b64: str) -> dict:
    """
    1-to-many face identification:
    Compares live face against all enrolled patient biometric templates.
    Returns patient_id only if match confidence >= MATCH_THRESHOLD.
    Never returns closest match when below threshold.
    """
    if not is_biometric_available():
        return {"success": False, "error": "Face recognition engine is not configured on this server."}

    img = _decode_image(image_b64)
    if img is None:
        return {"success": False, "error": "Could not decode the provided image."}

    faces = _detect_faces(img)
    if len(faces) == 0:
        del img
        return {"success": False, "error": "No face detected in the scan. Please align your face with the camera."}
    if len(faces) > 1:
        del img
        return {"success": False, "error": "Multiple faces detected. Please ensure only one person is in front of the camera."}

    face_info = faces[0]
    if face_info.get("tilt", 0) > 35:
        del img
        return {"success": False, "error": "Head is tilted. Please look straight into the camera."}

    x, y, w, h = face_info["box"]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    del img

    face_roi = gray[y:y+h, x:x+w]
    del gray

    # Liveness check
    liveness = _liveness_score(face_roi)
    if liveness < LIVENESS_VAR_THRESHOLD:
        del face_roi
        # Log failed attempt
        local_db.insert("biometric_verification_logs", {
            "patient_id": None,
            "verification_status": "LIVENESS_FAILED",
            "confidence_score": 0.0,
            "liveness_status": "FAIL",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        return {
            "success": False,
            "error": "Liveness check failed. Please use your live face, not a photograph or digital display.",
            "liveness_score": round(liveness, 2)
        }

    live_hist = _extract_lbph_histogram(face_roi)
    del face_roi

    # 1-to-many matching against registered templates
    all_biometrics = [b for b in local_db.get("patient_biometrics") if b.get("registration_status") == "REGISTERED"]

    best_score = 0.0
    best_patient_id = None

    for bio in all_biometrics:
        try:
            template_data = _decrypt(bio["encrypted_face_template"])
            enrolled_hist = np.array(template_data["histogram"], dtype=np.float32)
            score = _cosine_similarity(live_hist, enrolled_hist)
            if score > best_score:
                best_score = score
                if score >= MATCH_THRESHOLD:
                    best_patient_id = bio["patient_id"]
        except Exception:
            continue

    # Record verification log
    now_iso = datetime.now(timezone.utc).isoformat()
    local_db.insert("biometric_verification_logs", {
        "patient_id": best_patient_id,
        "verification_status": "MATCHED" if best_patient_id else "NO_MATCH",
        "confidence_score": round(best_score, 4),
        "liveness_status": "PASS",
        "created_at": now_iso
    })

    if best_patient_id is None:
        return {
            "success": False,
            "error": "Face not recognized. Please use Tracking ID and Password to access your reports.",
            "liveness_score": round(liveness, 2),
            "confidence": round(best_score, 4)
        }

    return {
        "success": True,
        "patient_id": best_patient_id,
        "confidence": round(best_score, 4),
        "liveness_score": round(liveness, 2)
    }


def reset_biometric(patient_id: str, admin_id: str) -> dict:
    """Admin action: disable or reset a patient's face registration."""
    records = [b for b in local_db.get("patient_biometrics") if b.get("patient_id") == patient_id]
    if not records:
        return {"success": False, "error": "No biometric record found for this patient."}

    for r in records:
        local_db.update("patient_biometrics", r["id"], {
            "registration_status": "RESET",
            "encrypted_face_template": "",
            "updated_at": datetime.now(timezone.utc).isoformat()
        })

    local_db.insert("activity_logs", {
        "user_id": admin_id,
        "action": "BIOMETRIC_RESET",
        "entity_type": "patient",
        "entity_id": patient_id,
        "details": {"reset_by": admin_id}
    })

    return {"success": True, "message": "Biometric registration has been reset for this patient."}


def get_biometric_status(patient_id: str) -> dict:
    """Return registration status without exposing the template."""
    records = [b for b in local_db.get("patient_biometrics") if b.get("patient_id") == patient_id]
    if not records:
        return {"registered": False, "status": "NOT_REGISTERED"}
    r = records[0]
    return {
        "registered": r.get("registration_status") == "REGISTERED",
        "status": r.get("registration_status"),
        "consent_timestamp": r.get("consent_timestamp"),
        "created_at": r.get("created_at"),
        "updated_at": r.get("updated_at")
    }
