import json
import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..schemas import DictFacetCounts, DictSearchResponse, DictWordOut
from ..services.importer import normalize_pinyin_search
from .utils import get_current_user

router = APIRouter(prefix="/dict", tags=["dict"])

MAX_LIMIT = 200


def _load_list(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        data = json.loads(value)
        if isinstance(data, list):
            return [str(item) for item in data]
    except json.JSONDecodeError:
        pass
    return [value]


def _parse_hsk(raw: str | None) -> list[int]:
    if not raw:
        return []
    levels: list[int] = []
    for part in raw.split(","):
        cleaned = part.strip().lower().replace("hsk", "")
        if cleaned.isdigit():
            levels.append(int(cleaned))
    return sorted(set(levels))


def _parse_csv(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [part.strip() for part in raw.split(",") if part.strip()]


def _build_fts_match(query: str, mode: str) -> str:
    cleaned = re.sub(r"[^\w\u4e00-\u9fff]+", " ", query.strip(), flags=re.UNICODE)
    tokens = [token for token in re.split(r"\s+", cleaned) if token]
    if not tokens:
        return ""
    tokens = [token if token.endswith("*") else f"{token}*" for token in tokens]
    if mode in {"simplified", "traditional", "pinyin", "meanings"}:
        return " ".join([f"{mode}:{token}" for token in tokens])
    return " ".join(tokens)


def _dict_word_out(row: dict) -> DictWordOut:
    return DictWordOut(
        id=row["id"],
        simplified=row["simplified"],
        traditional=row.get("traditional"),
        pinyin=row.get("pinyin"),
        pinyin_normalized=row.get("pinyin_normalized"),
        meanings=_load_list(row.get("meanings")),
        examples=_load_list(row.get("examples")),
        tags=_load_list(row.get("tags")),
        hsk_level=row.get("hsk_level"),
        pos=row.get("pos"),
        frequency=row.get("frequency")
    )


def _fts_available(db: Session) -> bool:
    result = db.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name='dict_word_fts'")
    ).fetchone()
    return result is not None


@router.get("/search", response_model=DictSearchResponse)
def search_dict(
    query: str | None = None,
    mode: str = "all",
    hsk: str | None = None,
    pos: str | None = None,
    freq_min: float | None = None,
    freq_max: float | None = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> DictSearchResponse:
    if mode not in {"all", "simplified", "traditional", "pinyin", "meanings"}:
        raise HTTPException(status_code=400, detail="Invalid mode")

    limit = max(1, min(limit, MAX_LIMIT))
    offset = max(0, offset)
    hsk_levels = _parse_hsk(hsk)
    pos_values = _parse_csv(pos)

    match = ""
    use_fts = bool(query) and _fts_available(db)
    if use_fts and query:
        match = _build_fts_match(query, mode)
        if not match:
            use_fts = False

    base_from = "FROM dict_word d"
    if use_fts:
        base_from += " JOIN dict_word_fts ON d.id = dict_word_fts.rowid"

    where_clauses: list[str] = []
    params: dict = {"limit": limit, "offset": offset}

    if query:
        if use_fts:
            where_clauses.append("dict_word_fts MATCH :match")
            params["match"] = match
            if mode == "pinyin":
                normalized = normalize_pinyin_search(query)
                if normalized:
                    where_clauses.append(
                        "(d.pinyin_normalized LIKE :pn OR replace(d.pinyin_normalized, ' ', '') LIKE :pn_compact)"
                    )
                    params["pn"] = f"%{normalized}%"
                    params["pn_compact"] = f"%{normalized.replace(' ', '')}%"
        else:
            like_query = f"%{query}%"
            if mode == "simplified":
                where_clauses.append("d.simplified LIKE :q")
                params["q"] = like_query
            elif mode == "traditional":
                where_clauses.append("d.traditional LIKE :q")
                params["q"] = like_query
            elif mode == "pinyin":
                normalized = normalize_pinyin_search(query)
                where_clauses.append(
                    "(d.pinyin LIKE :q OR d.pinyin_normalized LIKE :pn OR replace(d.pinyin_normalized, ' ', '') LIKE :pn_compact)"
                )
                params["q"] = like_query
                params["pn"] = f"%{normalized}%"
                params["pn_compact"] = f"%{normalized.replace(' ', '')}%"
            elif mode == "meanings":
                where_clauses.append("d.meanings LIKE :q")
                params["q"] = like_query
            else:
                where_clauses.append(
                    "(d.simplified LIKE :q OR d.traditional LIKE :q OR d.pinyin LIKE :q OR d.meanings LIKE :q)"
                )
                params["q"] = like_query

    if hsk_levels:
        placeholders = []
        for idx, level in enumerate(hsk_levels):
            key = f"hsk{idx}"
            placeholders.append(f":{key}")
            params[key] = level
        where_clauses.append(f"d.hsk_level IN ({', '.join(placeholders)})")

    if pos_values:
        placeholders = []
        for idx, value in enumerate(pos_values):
            key = f"pos{idx}"
            placeholders.append(f":{key}")
            params[key] = value
        where_clauses.append(f"d.pos IN ({', '.join(placeholders)})")

    if freq_min is not None:
        where_clauses.append("d.frequency >= :freq_min")
        params["freq_min"] = freq_min
    if freq_max is not None:
        where_clauses.append("d.frequency <= :freq_max")
        params["freq_max"] = freq_max

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    select_columns = (
        "d.id, d.simplified, d.traditional, d.pinyin, d.pinyin_normalized, "
        "d.meanings, d.examples, d.tags, d.hsk_level, d.pos, d.frequency"
    )

    rows = db.execute(
        text(
            f"""
            SELECT {select_columns}
            {base_from}
            {where_sql}
            ORDER BY d.id ASC
            LIMIT :limit OFFSET :offset
            """
        ),
        params
    ).mappings().all()

    total_row = db.execute(
        text(f"SELECT COUNT(*) as count {base_from} {where_sql}"),
        params
    ).mappings().first()
    total = total_row["count"] if total_row else 0

    hsk_rows = db.execute(
        text(
            f"""
            SELECT d.hsk_level as key, COUNT(*) as count
            {base_from}
            {where_sql}
            GROUP BY d.hsk_level
            """
        ),
        params
    ).mappings().all()
    pos_rows = db.execute(
        text(
            f"""
            SELECT d.pos as key, COUNT(*) as count
            {base_from}
            {where_sql}
            GROUP BY d.pos
            """
        ),
        params
    ).mappings().all()

    facets = DictFacetCounts(
        hsk={str(row["key"]): row["count"] for row in hsk_rows if row["key"] is not None},
        pos={str(row["key"]): row["count"] for row in pos_rows if row["key"] is not None}
    )

    return DictSearchResponse(
        total=total,
        results=[_dict_word_out(row) for row in rows],
        facets=facets
    )
