from pathlib import Path
from typing import List

from ..schemas import CardCreate


def import_cc_cedict(file_path: str | Path) -> List[CardCreate]:
    """
    Parse CC-CEDICT data into CardCreate entries.
    TODO: Implement parsing and field normalization.
    """
    _ = file_path
    return []


def import_hsk(file_path: str | Path) -> List[CardCreate]:
    """
    Parse HSK CSV/JSON data into CardCreate entries.
    TODO: Implement parsing and field normalization.
    """
    _ = file_path
    return []
