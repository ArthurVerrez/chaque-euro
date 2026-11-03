import json
import re
from collections.abc import Iterator
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


class DecisionRows(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.rows: list[tuple[list[str], list[str]]] = []
        self.cells: list[str] = []
        self.documents: list[str] = []
        self.in_cell = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "tr":
            self.cells, self.documents = [], []
        elif tag == "td":
            self.in_cell = True
            self.cells.append("")
        elif tag == "a":
            href = dict(attrs).get("href") or ""
            path = urlparse(href)
            if path.hostname == "decisions.cnccfp.fr" and re.fullmatch(
                r"/documents/DECISION_[A-Z_]+_\d+\.pdf", path.path
            ):
                self.documents.append(path.path.rsplit("/", 1)[1])

    def handle_endtag(self, tag: str) -> None:
        if tag == "td":
            self.in_cell = False
        elif tag == "tr":
            self.rows.append(([c.strip() for c in self.cells], self.documents))

    def handle_data(self, data: str) -> None:
        if self.in_cell:
            self.cells[-1] += data


def decisions(root: Path) -> Iterator[tuple[Any, ...]]:
    seen = set()
    for page in sorted(root.glob("page-*.json")):
        if not re.fullmatch(r"page-\d+\.json", page.name):
            continue
        payload = json.loads(page.read_text())
        if not payload.get("success"):
            raise ValueError("CNCCFP decision index unavailable")
        parser = DecisionRows()
        parser.feed(payload["data"]["rows"])
        for cells, documents in parser.rows:
            if len(cells) < 6:
                raise ValueError("CNCCFP decision layout changed")
            initial = next((d for d in documents if "INITIALE" in d), None)
            for document in documents:
                if document in seen:
                    continue
                seen.add(document)
                yield (
                    document.removesuffix(".pdf"),
                    cells[0],
                    f"{cells[3]} · {cells[5]}",
                    document,
                    initial.removesuffix(".pdf") if initial and document != initial else None,
                    "Index publié, contrôle national en cours ; résultat dans le PDF officiel",
                    "cnccfp-mun2026",
                )
