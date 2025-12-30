from pathlib import Path
from typing import List

from ..schemas import FlashcardCreate


def import_cc_cedict(file_path: str | Path) -> List[FlashcardCreate]:
    """
    Parse CC-CEDICT data into FlashcardCreate entries.
    TODO: Implement parsing and field normalization.
    """
    _ = file_path
    return []


def import_hsk(file_path: str | Path) -> List[FlashcardCreate]:
    """
    Parse HSK CSV/JSON data into FlashcardCreate entries.
    TODO: Implement parsing and field normalization.
    """
    _ = file_path
    return []
