import hashlib
import http.client
import json
import logging
import re
import ssl
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass, replace
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import truststore

from .registry import Source

USER_AGENT = "chaque-euro-pipeline/0.1 (+https://github.com/ArthurVerrez/chaque-euro)"
CHUNK = 1 << 20
OFGL_PAGE_LIMIT = 20000
OFGL_GROUP_FIELDS = (
    "com_code,com_name,dep_code,dep_name,reg_name,siren,tranche_population,ptot,agregat"
)


@dataclass
class FetchRecord:
    source_id: str
    path: str
    urls: list[str]
    retrieved_at: str
    published_at: str | None
    bytes: int
    sha256: str
    checked_at: str | None = None
    etag: str | None = None
    last_modified: str | None = None
    failed_at: str | None = None
    error: str | None = None


def _sidecar(path: Path) -> Path:
    return path / ".fetch.json" if path.is_dir() else path.with_name(path.name + ".fetch.json")


def _now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def _open(url: str, timeout: int = 300, headers: dict[str, str] | None = None) -> Any:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, **(headers or {})})
    for attempt in range(4):
        try:
            return urllib.request.urlopen(
                request, timeout=timeout, context=truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
            )
        except urllib.error.HTTPError:
            raise
        except urllib.error.URLError as error:
            if isinstance(error.reason, ssl.SSLError) or attempt == 3:
                raise
            time.sleep(5 * (attempt + 1))
        except OSError:
            if attempt == 3:
                raise
            time.sleep(5 * (attempt + 1))
    raise AssertionError("unreachable")


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(CHUNK):
            digest.update(chunk)
    return digest.hexdigest()


def _cached(path: Path) -> FetchRecord | None:
    sidecar = _sidecar(path)
    if not path.exists() or not sidecar.exists():
        return None
    record = FetchRecord(**json.loads(sidecar.read_text(encoding="utf-8")))
    return replace(record, path=str(path))


def _due(source: Source, record: FetchRecord, refresh: bool) -> bool:
    if refresh or record.error:
        return True
    checked = datetime.fromisoformat(record.checked_at or record.retrieved_at)
    now = datetime.now(UTC)
    if source.max_age_days == 1:
        paris = ZoneInfo("Europe/Paris")
        return checked.astimezone(paris).date() < now.astimezone(paris).date()
    return now - checked >= timedelta(days=source.max_age_days)


def _save(record: FetchRecord) -> FetchRecord:
    path = Path(record.path)
    sidecar = _sidecar(path)
    partial = sidecar.with_name(sidecar.name + ".part")
    partial.write_text(json.dumps(asdict(record), indent=2), encoding="utf-8")
    partial.replace(sidecar)
    return record


def _fallback(cached: FetchRecord | None, error: Exception) -> FetchRecord:
    if cached is None:
        raise error
    logging.warning("%s: refresh failed, keeping cached data: %s", cached.source_id, error)
    return _save(replace(cached, failed_at=_now(), error=str(error)))


def fetch_file(source: Source, raw_dir: Path, refresh: bool) -> FetchRecord:
    assert source.file_url and source.filename
    path = raw_dir / source.id / source.filename
    cached = _cached(path)
    if cached and not _due(source, cached, refresh):
        print(f"  cached {source.filename}", flush=True)
        return cached
    path.parent.mkdir(parents=True, exist_ok=True)
    partial = path.with_name(path.name + ".part")
    headers = {}
    if cached:
        if cached.etag:
            headers["If-None-Match"] = cached.etag
        if cached.last_modified:
            headers["If-Modified-Since"] = cached.last_modified
    print(f"  checking {source.file_url}", flush=True)
    try:
        try:
            with _open(source.file_url, headers=headers) as response, partial.open("wb") as out:
                final_url = response.geturl()
                modified = response.headers.get("Last-Modified")
                etag = response.headers.get("ETag")
                while chunk := response.read(CHUNK):
                    out.write(chunk)
        except urllib.error.HTTPError as error:
            if error.code != 304 or cached is None:
                error.close()
                raise
            with error:
                print(f"  not modified (304): {source.filename}", flush=True)
                return _save(
                    replace(
                        cached,
                        checked_at=_now(),
                        etag=error.headers.get("ETag", cached.etag),
                        last_modified=error.headers.get("Last-Modified", cached.last_modified),
                        failed_at=None,
                        error=None,
                    )
                )
        except (urllib.error.URLError, ConnectionError) as error:
            if isinstance(error, urllib.error.URLError) and not isinstance(
                error.reason, ssl.SSLError
            ):
                raise
            result = subprocess.run(
                [
                    "curl",
                    "--fail",
                    "--location",
                    "--proto",
                    "=https",
                    "--proto-redir",
                    "=https",
                    "--max-time",
                    "300",
                    "--user-agent",
                    USER_AGENT,
                    "--output",
                    str(partial),
                    "--write-out",
                    "%{url_effective}\n%header{last-modified}",
                    source.file_url,
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            final_url, _, modified = result.stdout.strip().partition("\n")
            etag = None
        digest = sha256_of(partial)
        size = partial.stat().st_size
        partial.replace(path)
        return _save(
            FetchRecord(
                source_id=source.id,
                path=str(path),
                urls=[final_url],
                retrieved_at=_now(),
                checked_at=_now(),
                published_at=modified or None,
                last_modified=modified or None,
                etag=etag,
                bytes=size,
                sha256=digest,
            )
        )
    except (OSError, http.client.HTTPException, subprocess.SubprocessError) as error:
        return _fallback(cached, error)
    finally:
        partial.unlink(missing_ok=True)


def _ofgl_query(
    source: Source, raw_dir: Path, params: dict[str, str], refresh: bool
) -> dict[str, Any]:
    url = f"{source.file_url}?{urllib.parse.urlencode(params)}"
    filename = f".queries/{hashlib.sha256(url.encode()).hexdigest()}.json"
    record = fetch_file(replace(source, file_url=url, filename=filename), raw_dir, refresh)
    if record.error:
        raise OSError(record.error)
    payload: dict[str, Any] = json.loads(Path(record.path).read_text())
    payload["_url"] = url
    return payload


def _download_ofgl(source: Source, path: Path, raw_dir: Path, refresh: bool) -> FetchRecord:
    assert source.file_url and source.filename
    path.parent.mkdir(parents=True, exist_ok=True)
    aggregates = ",".join(json.dumps(name, ensure_ascii=False) for name in source.aggregates)
    urls: list[str] = []
    partial = path.with_name(path.name + ".part")
    with partial.open("w", encoding="utf-8") as out:
        for year in source.years:
            year_filter = f"exer=date'{year}'"
            departments = _ofgl_query(
                source,
                raw_dir,
                {"where": year_filter, "group_by": "dep_code", "limit": "500"},
                refresh,
            )
            urls.append(departments["_url"])
            for department in sorted(row["dep_code"] for row in departments["results"]):
                page = _ofgl_query(
                    source,
                    raw_dir,
                    {
                        "where": f'{year_filter} and dep_code="{department}" '
                        f"and agregat in ({aggregates})",
                        "group_by": OFGL_GROUP_FIELDS,
                        "select": "sum(montant) as montant",
                        "limit": str(OFGL_PAGE_LIMIT),
                    },
                    refresh,
                )
                urls.append(page["_url"])
                if len(page["results"]) != page["total_count"]:
                    raise RuntimeError(f"OFGL page truncated for {year} {department}")
                for row in page["results"]:
                    out.write(json.dumps({"year": year, **row}, ensure_ascii=False) + "\n")
                print(f"  ofgl {year} {department}: {page['total_count']} rows", flush=True)
                time.sleep(0.2)
    partial.replace(path)
    return _save(
        FetchRecord(
            source_id=source.id,
            path=str(path),
            urls=urls,
            retrieved_at=_now(),
            checked_at=_now(),
            published_at=None,
            bytes=path.stat().st_size,
            sha256=sha256_of(path),
        )
    )


def fetch_ofgl_records(source: Source, raw_dir: Path, refresh: bool) -> FetchRecord:
    assert source.filename
    path = raw_dir / source.id / source.filename
    cached = _cached(path)
    if cached and not _due(source, cached, refresh):
        return cached
    try:
        return _download_ofgl(source, path, raw_dir, refresh)
    except (OSError, http.client.HTTPException, ValueError, RuntimeError) as error:
        return _fallback(cached, error)
    finally:
        path.with_name(path.name + ".part").unlink(missing_ok=True)


def _collection(source: Source, directory: Path, records: list[FetchRecord]) -> FetchRecord:
    failures = [record for record in records if record.error]
    return FetchRecord(
        source_id=source.id,
        path=str(directory),
        urls=[url for record in records for url in record.urls],
        retrieved_at=min(record.retrieved_at for record in records),
        checked_at=min(record.checked_at or record.retrieved_at for record in records),
        published_at=None,
        bytes=sum(record.bytes for record in records),
        sha256=hashlib.sha256(
            "".join(f"{Path(record.path).name}:{record.sha256}" for record in records).encode()
        ).hexdigest(),
        failed_at=max(record.failed_at or "" for record in failures) if failures else None,
        error="; ".join(record.error or "" for record in failures) or None,
    )


def fetch(source: Source, raw_dir: Path, refresh: bool) -> FetchRecord | None:
    if source.kind == "file":
        return fetch_file(source, raw_dir, refresh)
    if source.kind == "ofgl_records":
        return fetch_ofgl_records(source, raw_dir, refresh)
    if source.kind != "files":
        return None
    directory = raw_dir / source.id
    directory.mkdir(parents=True, exist_ok=True)
    previous = _cached(directory)
    if previous is None:
        existing = [
            record
            for path in sorted(directory.iterdir())
            if path.is_file()
            and not path.name.endswith((".fetch.json", ".part"))
            and (record := _cached(path)) is not None
        ]
        if existing:
            previous = _collection(source, directory, existing)
    try:
        if source.delivery_pattern:
            source = _deliveries(source, raw_dir, refresh)
        records = [
            fetch_file(replace(source, file_url=url, filename=name), raw_dir, refresh)
            for name, url in sorted(source.files.items())
        ]
        if source.delivery_pattern:
            index = _cached(directory / "index.html")
            assert index
            records.append(index)
        if source.rolling_days:
            records += _retained(source, directory)
        record = _collection(source, directory, records)
        if source.delivery_pattern and not source.rolling_days and not record.error:
            _drop_superseded(source, directory)
        return _save(record)
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as error:
        return _fallback(previous, error)


def _window_start(source: Source) -> str:
    return (datetime.now(UTC) - timedelta(days=source.rolling_days)).strftime("%Y%m%d")


def _retained(source: Source, directory: Path) -> list[FetchRecord]:
    assert source.delivery_pattern
    start = _window_start(source)
    kept = []
    for path in sorted(directory.glob(source.delivery_pattern + "_*.tar.gz")):
        if path.name in source.files:
            continue
        record = _cached(path)
        if record and path.name.split("_")[-1][:8] >= start:
            kept.append(record)
        else:
            path.unlink()
            _sidecar(path).unlink(missing_ok=True)
    return kept


def _drop_superseded(source: Source, directory: Path) -> None:
    stock = next(name for name in source.files if name.startswith("Freemium_"))
    for path in directory.glob("*.tar.gz"):
        if path.name not in source.files and path.name.split("_")[-1] < stock.split("_")[-1]:
            path.unlink()
            _sidecar(path).unlink(missing_ok=True)


def _deliveries(source: Source, raw_dir: Path, refresh: bool) -> Source:
    assert source.file_url and source.delivery_pattern
    index = fetch_file(replace(source, filename="index.html"), raw_dir, refresh)
    names = set(re.findall(r'href="([^"/]+\.tar\.gz)"', Path(index.path).read_text()))
    stocks = sorted(name for name in names if name.startswith("Freemium_"))
    start = _window_start(source)
    selected = sorted(
        name
        for name in names
        if name.startswith(source.delivery_pattern + "_")
        and (not source.rolling_days or name.split("_")[-1][:8] >= start)
    )
    if not source.rolling_days:
        if not stocks:
            raise ValueError(f"No stock in {source.id} index")
        stock = stocks[-1]
        selected = [stock] + [
            name for name in selected if name.split("_")[-1] > stock.split("_")[-1]
        ]
    if not selected:
        raise ValueError(f"No deliveries in {source.id} index")
    return replace(
        source, files={name: urllib.parse.urljoin(source.file_url, name) for name in selected}
    )
