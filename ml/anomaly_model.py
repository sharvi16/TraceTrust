"""Isolation Forest anomaly model for TraceTrust.

One model is trained and persisted per NGO, stored as:
  ml/models/<ngo_id>_model.pkl

Public API
----------
get_features(expense)            -> list[float]
train_model(ngo_id, expenses)    -> None
predict_anomaly(ngo_id, expense) -> bool
"""
from pathlib import Path

import joblib
from sklearn.ensemble import IsolationForest

_MODELS_DIR = Path(__file__).resolve().parent / "models"
_MODELS_DIR.mkdir(parents=True, exist_ok=True)

_MIN_SAMPLES = 20  # minimum expenses needed before training is worthwhile

_CATEGORY_MAP: dict[str, int] = {
    "food": 0,
    "medicine": 1,
    "education": 2,
    "salary": 3,
    "admin": 4,
    "other": 5,
}


def get_features(expense) -> list[float]:
    """Extract a numeric feature vector from an Expense ORM object.

    Features: [amount, hour_of_day, day_of_week, category_encoded]
    """
    ts = expense.timestamp
    hour = ts.hour if ts else 12
    dow = ts.weekday() if ts else 0  # Monday=0, Sunday=6
    cat = _CATEGORY_MAP.get(expense.category, 5)
    return [float(expense.amount), float(hour), float(dow), float(cat)]


def train_model(ngo_id: str, expenses: list) -> None:
    """Train an IsolationForest on *expenses* and save the artifact.

    No-ops silently when fewer than *_MIN_SAMPLES* expenses are available.
    """
    if len(expenses) < _MIN_SAMPLES:
        return

    import numpy as np

    X = np.array([get_features(e) for e in expenses])
    model = IsolationForest(contamination=0.05, random_state=42)
    model.fit(X)

    model_path = _MODELS_DIR / f"{ngo_id}_model.pkl"
    joblib.dump(model, model_path)
    print(f"Model trained for NGO {ngo_id} on {len(expenses)} samples")


def predict_anomaly(ngo_id: str, expense) -> bool:
    """Return True if *expense* is flagged as anomalous by the saved model.

    Returns False (safe default) when no model file exists for *ngo_id*.
    """
    model_path = _MODELS_DIR / f"{ngo_id}_model.pkl"
    if not model_path.exists():
        return False

    import numpy as np

    model = joblib.load(model_path)
    features = np.array([get_features(expense)])
    prediction = model.predict(features)  # -1 = anomaly, 1 = normal
    return bool(prediction[0] == -1)
