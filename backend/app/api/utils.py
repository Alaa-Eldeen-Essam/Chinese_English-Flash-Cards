from sqlalchemy.orm import Session

from ..crud import ensure_demo_user, get_user


def resolve_user_id(db: Session, user_id: str | int) -> int:
    if isinstance(user_id, int):
        if get_user(db, user_id):
            return user_id
        demo = ensure_demo_user(db)
        return demo.id

    if user_id == "me":
        demo = ensure_demo_user(db)
        return demo.id

    try:
        parsed = int(user_id)
    except ValueError:
        demo = ensure_demo_user(db)
        return demo.id

    if get_user(db, parsed):
        return parsed

    demo = ensure_demo_user(db)
    return demo.id
