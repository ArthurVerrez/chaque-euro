import tomllib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

REGISTRY_PATH = Path(__file__).resolve().parents[2] / "sources.toml"


@dataclass(frozen=True)
class Licence:
    name: str
    url: str


@dataclass(frozen=True)
class Source:
    id: str
    short_name: str
    name: str
    publisher: str
    page_url: str
    licence: Licence
    frequency: str
    kind: str
    usage: str
    limits: list[str]
    file_url: str | None = None
    record_url: str | None = None
    code_url: str | None = None
    filename: str | None = None
    data_date: str | None = None
    freshness_retrieval_days: int = 0
    freshness_data_days: int = 0
    vintage: str | None = None
    value: float | None = None
    files: dict[str, str] = field(default_factory=dict)
    delivery_pattern: str | None = None
    rolling_days: int = 0
    years: list[int] = field(default_factory=list)
    aggregates: list[str] = field(default_factory=list)

    @property
    def download_expected(self) -> bool:
        return self.kind not in {"reference", "constant"} or (
            self.kind == "reference" and self.file_url is not None
        )

    @property
    def max_age_days(self) -> int:
        frequency = self.frequency.lower()
        if frequency.startswith("quotidienne") or "flux actualisé quotidiennement" in frequency:
            return 1
        if frequency.startswith("hebdomadaire"):
            return 7
        return 30


def load_registry(path: Path = REGISTRY_PATH) -> list[Source]:
    raw: dict[str, Any] = tomllib.loads(path.read_text(encoding="utf-8"))
    licences = {key: Licence(**value) for key, value in raw["licences"].items()}
    sources = []
    for entry in raw["sources"]:
        urls = [
            entry.get("page_url", ""),
            entry.get("file_url") or "",
            *entry.get("files", {}).values(),
        ]
        if any("francetransparence.fr" in url for url in urls):
            raise ValueError(f"{entry['id']}: data must come from its original publisher")
        frequency = entry["frequency"].lower()
        key = next(
            (
                key
                for prefix, key in (
                    ("quotidienne", "daily"),
                    ("mensuelle", "monthly"),
                    ("trimestrielle", "quarterly"),
                    ("annuelle", "annual"),
                )
                if frequency.startswith(prefix)
            ),
            "occasional",
        )
        policy = raw["freshness"][key]
        sources.append(
            Source(
                **{
                    **entry,
                    "licence": licences[entry["licence"]],
                    "freshness_retrieval_days": policy["retrieval_days"],
                    "freshness_data_days": policy["data_days"],
                }
            )
        )
    return sources
