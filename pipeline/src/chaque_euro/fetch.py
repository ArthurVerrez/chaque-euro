import hashlib
import json
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


def _sidecar(path: Path) -> Path:
    return path.with_name(path.name + ".fetch.json")


def _now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def _open(url: str, timeout: int = 300) -> Any:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(4):
        try:
            return urllib.request.urlopen(
                request, timeout=timeout, context=truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
            )
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


def _cached(path: Path, refresh: bool) -> FetchRecord | None:
    sidecar = _sidecar(path)
    if refresh or not path.exists() or not sidecar.exists():
        return None
    return FetchRecord(**json.loads(sidecar.read_text(encoding="utf-8")))


def _save(record: FetchRecord) -> FetchRecord:
    path = Path(record.path)
    _sidecar(path).write_text(json.dumps(asdict(record), indent=2), encoding="utf-8")
    return record


def fetch_file(source: Source, raw_dir: Path, refresh: bool) -> FetchRecord:
    assert source.file_url and source.filename
    path = raw_dir / source.id / source.filename
    if cached := _cached(path, refresh):
        return cached
    path.parent.mkdir(parents=True, exist_ok=True)
    partial = path.with_name(path.name + ".part")
    print(f"  downloading {source.file_url}", flush=True)
    try:
        with _open(source.file_url) as response, partial.open("wb") as out:
            final_url = response.geturl()
            published_at = response.headers.get("Last-Modified")
            while chunk := response.read(CHUNK):
                out.write(chunk)
    except urllib.error.URLError as error:
        if not isinstance(error.reason, ssl.SSLError):
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
        published_at = modified or None
    partial.replace(path)
    return _save(
        FetchRecord(
            source_id=source.id,
            path=str(path),
            urls=[final_url],
            retrieved_at=_now(),
            published_at=published_at,
            bytes=path.stat().st_size,
            sha256=sha256_of(path),
        )
    )


def _ofgl_query(api_url: str, params: dict[str, str]) -> dict[str, Any]:
    url = f"{api_url}?{urllib.parse.urlencode(params)}"
    with _open(url, timeout=180) as response:
        payload: dict[str, Any] = json.load(response)
    payload["_url"] = url
    return payload


def fetch_ofgl_records(source: Source, raw_dir: Path, refresh: bool) -> FetchRecord:
    assert source.file_url and source.filename
    path = raw_dir / source.id / source.filename
    if cached := _cached(path, refresh):
        return cached
    path.parent.mkdir(parents=True, exist_ok=True)
    aggregates = ",".join(json.dumps(name, ensure_ascii=False) for name in source.aggregates)
    urls: list[str] = []
    partial = path.with_name(path.name + ".part")
    with partial.open("w", encoding="utf-8") as out:
        for year in source.years:
            year_filter = f"exer=date'{year}'"
            departments = _ofgl_query(
                source.file_url,
                {"where": year_filter, "group_by": "dep_code", "limit": "500"},
            )
            urls.append(departments["_url"])
            for department in sorted(row["dep_code"] for row in departments["results"]):
                page = _ofgl_query(
                    source.file_url,
                    {
                        "where": f'{year_filter} and dep_code="{department}" '
                        f"and agregat in ({aggregates})",
                        "group_by": OFGL_GROUP_FIELDS,
                        "select": "sum(montant) as montant",
                        "limit": str(OFGL_PAGE_LIMIT),
                    },
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
            published_at=None,
            bytes=path.stat().st_size,
            sha256=sha256_of(path),
        )
    )


def fetch(source: Source, raw_dir: Path, refresh: bool) -> FetchRecord | None:
    if source.kind == "file":
        return fetch_file(source, raw_dir, refresh)
    if source.kind == "files":
        if source.delivery_pattern:
            source = _deliveries(source, raw_dir, refresh)
        records = [
            fetch_file(replace(source, file_url=url, filename=name), raw_dir, refresh)
            for name, url in source.files.items()
        ]
        if source.delivery_pattern and source.rolling_days:
            for old in (raw_dir / source.id).glob(source.delivery_pattern + "_*.tar.gz"):
                if old.name not in source.files:
                    old.unlink()
                    _sidecar(old).unlink(missing_ok=True)
        return FetchRecord(
            source_id=source.id,
            path=str(raw_dir / source.id),
            urls=[url for record in records for url in record.urls],
            retrieved_at=max(record.retrieved_at for record in records),
            published_at=None,
            bytes=sum(record.bytes for record in records),
            sha256=hashlib.sha256(
                "".join(record.sha256 for record in records).encode()
            ).hexdigest(),
        )
    if source.kind == "ofgl_records":
        return fetch_ofgl_records(source, raw_dir, refresh)
    return None


def _deliveries(source: Source, raw_dir: Path, refresh: bool) -> Source:
    assert source.file_url and source.delivery_pattern
    index = fetch_file(replace(source, filename="index.html"), raw_dir, refresh)
    names = set(re.findall(r'href="([^"/]+\.tar\.gz)"', Path(index.path).read_text()))
    stocks = sorted(name for name in names if name.startswith("Freemium_"))
    cutoff = (datetime.now(UTC) - timedelta(days=source.rolling_days)).strftime("%Y%m%d")
    selected = sorted(
        name
        for name in names
        if name.startswith(source.delivery_pattern + "_")
        and (not source.rolling_days or name.split("_")[-1][:8] >= cutoff)
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
