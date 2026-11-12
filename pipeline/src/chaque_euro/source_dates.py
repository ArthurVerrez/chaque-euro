import json
import re
import zipfile
from datetime import date, datetime
from email.utils import parsedate_to_datetime
from pathlib import Path

from .fetch import FetchRecord
from .registry import Source


def source_data_date(source: Source, record: FetchRecord | None) -> str | None:
    if source.data_date or record is None:
        return source.data_date
    path = Path(record.path)
    if source.id in {"an-members", "an-history"}:
        with zipfile.ZipFile(path) as archive:
            dates = [
                date(*entry.date_time[:3])
                for entry in archive.infolist()
                if entry.filename.startswith("json/") and not entry.is_dir()
            ]
        return max(dates).isoformat() if dates else None
    if source.id == "senat-members":
        dates = []
        for filename in source.files:
            sidecar = path / f"{filename}.fetch.json"
            if not sidecar.exists():
                return None
            modified = json.loads(sidecar.read_text()).get("published_at")
            if not modified:
                return None
            dates.append(parsedate_to_datetime(modified).date())
        return min(dates).isoformat() if dates else None
    if source.id == "cnccfp-status":
        match = re.search(r"Dernière mise à jour le (\d{2}/\d{2}/\d{4})", path.read_text())
        return datetime.strptime(match[1], "%d/%m/%Y").date().isoformat() if match else None
    if source.id == "cnccfp-mun2026":
        return datetime.fromisoformat(record.retrieved_at).date().isoformat()
    if source.id == "competition-sanctions" and record.published_at:
        return parsedate_to_datetime(record.published_at).date().isoformat()
    return None
