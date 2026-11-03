import argparse
import json
from dataclasses import asdict
from pathlib import Path

from .build import build
from .fetch import FetchRecord, fetch
from .registry import load_registry

REPO_ROOT = Path(__file__).resolve().parents[3]


def _fetch_all(raw_dir: Path, refresh: bool, only: set[str]) -> dict[str, FetchRecord]:
    records: dict[str, FetchRecord] = {}
    for source in load_registry():
        if only and source.id not in only:
            continue
        print(f"fetch {source.id}", flush=True)
        if record := fetch(source, raw_dir, refresh):
            records[source.id] = record
    return records


def main() -> None:
    parser = argparse.ArgumentParser(prog="chaque-euro")
    parser.add_argument("command", choices=["fetch", "run"])
    parser.add_argument("--raw-dir", type=Path, default=REPO_ROOT / "data" / "raw")
    parser.add_argument("--build-dir", type=Path, default=REPO_ROOT / "data" / "build")
    parser.add_argument("--refresh", action="store_true", help="download again even if cached")
    parser.add_argument("--only", nargs="*", default=[], help="source ids to fetch")
    args = parser.parse_args()

    raw_dir: Path = args.raw_dir.resolve()
    build_dir: Path = args.build_dir.resolve()
    records = _fetch_all(raw_dir, args.refresh, set(args.only))
    if args.command == "fetch":
        print(json.dumps({key: asdict(value) for key, value in records.items()}, indent=2))
        return
    build(records, build_dir)


if __name__ == "__main__":
    main()
