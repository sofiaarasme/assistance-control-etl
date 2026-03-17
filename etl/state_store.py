from __future__ import annotations

import json
from pathlib import Path


def load_processed_ids(state_file: Path) -> set[str]:
    if not state_file.exists():
        return set()

    with open(state_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    ids = data.get("processed_file_ids", [])
    return set(ids)


def save_processed_ids(state_file: Path, file_ids: set[str]) -> None:
    state_file.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "processed_file_ids": sorted(file_ids),
    }
    with open(state_file, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
