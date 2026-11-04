import sqlite3
from pathlib import Path

from .fetch import FetchRecord


def _read(path: Path) -> sqlite3.Connection:
    return sqlite3.connect(f"{path.resolve().as_uri()}?mode=ro", uri=True)


def _tables(db: sqlite3.Connection) -> set[str]:
    return {
        row[0]
        for row in db.execute("select name from sqlite_master where type='table'")
        if not row[0].startswith(("sqlite_", "_cf_"))
    }


def _count(db: sqlite3.Connection, table: str) -> int:
    quoted = table.replace('"', '""')
    return int(db.execute(f'select count(*) from "{quoted}"').fetchone()[0])


def gate(candidate: Path, published: Path | None) -> bool:
    with _read(candidate) as new:
        if new.execute("pragma quick_check").fetchone()[0] != "ok":
            print("FAIL: candidate SQLite integrity check")
            return False
        tables = _tables(new)
        if not tables:
            print("FAIL: candidate has no data tables")
            return False
        if published is None:
            print(f"PASS: first publication, {len(tables)} tables")
            return True
        passed = True
        with _read(published) as old:
            for table in sorted(_tables(old)):
                before = _count(old, table)
                after = _count(new, table) if table in tables else None
                valid = after is not None and after > 0 and after >= before * 0.8
                print(f"{'PASS' if valid else 'FAIL'}: {table}: {before} -> {after}")
                passed = passed and valid
        return passed


def prepare_database(candidate: Path, published: Path | None, output: Path) -> None:
    if output.exists():
        raise FileExistsError(output)
    with _read(candidate) as source, sqlite3.connect(output) as destination:
        source.backup(destination)
        if published is not None:
            with _read(published) as current:
                schema = current.execute(
                    "select sql from sqlite_master where name='_cf_METADATA'"
                ).fetchone()
                if schema:
                    destination.execute("drop table if exists _cf_METADATA")
                    destination.execute(schema[0])
                    destination.executemany(
                        "insert into _cf_METADATA values (?, ?)",
                        current.execute("select * from _cf_METADATA"),
                    )
        destination.commit()
        destination.execute("pragma journal_mode=delete")


def update_freshness(database: Path, records: dict[str, FetchRecord]) -> None:
    if not database.is_file():
        raise FileNotFoundError(database)
    with sqlite3.connect(database, timeout=60) as db:
        db.executemany(
            "update sources set checked_at=case when sha256=? then ? else checked_at end, "
            "refresh_error=? where id=? and (sha256=? or ? is not null)",
            [
                (
                    record.sha256,
                    record.checked_at or record.retrieved_at,
                    record.error,
                    source_id,
                    record.sha256,
                    record.error,
                )
                for source_id, record in records.items()
            ],
        )


def late_sources(database: Path) -> list[str]:
    with _read(database) as db:
        return [
            row[0]
            for row in db.execute(
                "select id from sources where refresh_error is not null "
                "and freshness_retrieval_days > 0 and (checked_at is null "
                "or julianday('now') - julianday(checked_at) > freshness_retrieval_days) "
                "order by id"
            )
        ]
