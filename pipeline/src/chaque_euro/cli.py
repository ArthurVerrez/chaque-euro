import argparse
import json
from dataclasses import asdict
from pathlib import Path

from .build import build, pipeline_hash
from .fetch import FetchRecord, fetch
from .publish import gate, late_sources, prepare_database, update_freshness
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


def unchanged(records: dict[str, FetchRecord], published_build: Path) -> bool:
    manifest_path = published_build / "manifest.json"
    if not manifest_path.is_file():
        return False
    manifest = json.loads(manifest_path.read_text())
    previous = {
        source["id"]: source["sha256"] for source in manifest["sources"] if "sha256" in source
    }
    return bool(
        manifest.get("pipeline_hash") == pipeline_hash()
        and previous == {key: record.sha256 for key, record in records.items()}
    )


def main() -> None:
    parser = argparse.ArgumentParser(prog="chaque-euro")
    parser.add_argument(
        "command", choices=["fetch", "run", "gate", "prepare-db", "update-freshness", "late"]
    )
    parser.add_argument("--raw-dir", type=Path, default=REPO_ROOT / "data" / "raw")
    parser.add_argument("--build-dir", type=Path, default=REPO_ROOT / "data" / "build")
    parser.add_argument("--refresh", action="store_true", help="download again even if cached")
    parser.add_argument("--only", nargs="*", default=[], help="source ids to fetch")
    parser.add_argument("--skip-unchanged", action="store_true")
    parser.add_argument("--published-build", type=Path)
    parser.add_argument("--candidate", type=Path)
    parser.add_argument("--published-db", type=Path)
    parser.add_argument("--output-db", type=Path)
    parser.add_argument("--records", type=Path)
    args = parser.parse_args()
    if args.command == "gate":
        if not args.candidate:
            parser.error("gate requires --candidate")
        raise SystemExit(0 if gate(args.candidate, args.published_db) else 1)
    if args.command == "prepare-db":
        if not args.candidate or not args.output_db:
            parser.error("prepare-db requires --candidate and --output-db")
        prepare_database(args.candidate, args.published_db, args.output_db)
        return
    if args.command == "late":
        if not args.published_db:
            parser.error("late requires --published-db")
        print(", ".join(late_sources(args.published_db)))
        return
    if args.command == "update-freshness":
        if not args.published_db or not args.records:
            parser.error("update-freshness requires --published-db and --records")
        records = {
            key: FetchRecord(**value) for key, value in json.loads(args.records.read_text()).items()
        }
        update_freshness(args.published_db, records)
        return
    if args.command == "run" and args.only:
        parser.error("--only is supported for fetch only")
    if args.skip_unchanged and not args.published_build:
        parser.error("--skip-unchanged requires --published-build")

    raw_dir: Path = args.raw_dir.resolve()
    build_dir: Path = args.build_dir.resolve()
    records = _fetch_all(raw_dir, args.refresh, set(args.only))
    if args.command == "fetch":
        print(json.dumps({key: asdict(value) for key, value in records.items()}, indent=2))
        return
    build_dir.mkdir(parents=True, exist_ok=True)
    (build_dir / "refresh.json").write_text(
        json.dumps({key: asdict(value) for key, value in records.items()})
    )
    if args.skip_unchanged and unchanged(records, args.published_build):
        print("Unchanged source hashes and pipeline code; skipping build", flush=True)
        raise SystemExit(3)
    build(records, build_dir)


if __name__ == "__main__":
    main()
