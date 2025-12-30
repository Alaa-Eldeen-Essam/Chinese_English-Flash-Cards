from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass(frozen=True)
class DatasetSpec:
    id: str
    name: str
    description: str
    kind: str
    size_mb: float
    version: str
    status: str
    source_url: Optional[str] = None
    filters: Optional[Dict[str, object]] = None


DATASET_CATALOG: List[DatasetSpec] = [
    DatasetSpec(
        id="cedict",
        name="CC-CEDICT",
        description="Open Chinese-English dictionary core.",
        kind="dictionary",
        size_mb=20.0,
        version="latest",
        status="available",
        source_url="https://www.mdbg.net/chinese/export/cedict/",
        filters=None
    ),
    DatasetSpec(
        id="hsk-1",
        name="HSK Level 1",
        description="Official HSK 1 vocabulary list.",
        kind="vocab",
        size_mb=0.2,
        version="2.0",
        status="available",
        source_url="https://github.com/krmanik/HSK-CSV",
        filters={"hsk_levels": [1]}
    ),
    DatasetSpec(
        id="hsk-2",
        name="HSK Level 2",
        description="Official HSK 2 vocabulary list.",
        kind="vocab",
        size_mb=0.3,
        version="2.0",
        status="available",
        source_url="https://github.com/krmanik/HSK-CSV",
        filters={"hsk_levels": [2]}
    ),
    DatasetSpec(
        id="hsk-3",
        name="HSK Level 3",
        description="Official HSK 3 vocabulary list.",
        kind="vocab",
        size_mb=0.5,
        version="2.0",
        status="available",
        source_url="https://github.com/krmanik/HSK-CSV",
        filters={"hsk_levels": [3]}
    ),
    DatasetSpec(
        id="hsk-4",
        name="HSK Level 4",
        description="Official HSK 4 vocabulary list.",
        kind="vocab",
        size_mb=0.7,
        version="2.0",
        status="available",
        source_url="https://github.com/krmanik/HSK-CSV",
        filters={"hsk_levels": [4]}
    ),
    DatasetSpec(
        id="hsk-5",
        name="HSK Level 5",
        description="Official HSK 5 vocabulary list.",
        kind="vocab",
        size_mb=0.9,
        version="2.0",
        status="available",
        source_url="https://github.com/krmanik/HSK-CSV",
        filters={"hsk_levels": [5]}
    ),
    DatasetSpec(
        id="hsk-6",
        name="HSK Level 6",
        description="Official HSK 6 vocabulary list.",
        kind="vocab",
        size_mb=1.1,
        version="2.0",
        status="available",
        source_url="https://github.com/krmanik/HSK-CSV",
        filters={"hsk_levels": [6]}
    ),
    DatasetSpec(
        id="hsk-3.0",
        name="HSK 3.0 (new)",
        description="Updated official HSK 3.0 lists (planned).",
        kind="vocab",
        size_mb=2.5,
        version="3.0",
        status="planned",
        source_url="https://www.chinesetest.cn",
        filters=None
    ),
    DatasetSpec(
        id="tatoeba-cmn",
        name="Tatoeba Sentences (cmn)",
        description="Example sentences for Mandarin (planned).",
        kind="examples",
        size_mb=200.0,
        version="latest",
        status="planned",
        source_url="https://tatoeba.org/eng/downloads",
        filters=None
    ),
    DatasetSpec(
        id="subtlex-ch",
        name="SUBTLEX-CH Frequency",
        description="Word frequency list from subtitles (planned).",
        kind="frequency",
        size_mb=5.0,
        version="1.0",
        status="planned",
        source_url="https://zipfstanford.github.io/SUBTLEX-CH/",
        filters=None
    )
]

DATASET_MAP = {dataset.id: dataset for dataset in DATASET_CATALOG}
