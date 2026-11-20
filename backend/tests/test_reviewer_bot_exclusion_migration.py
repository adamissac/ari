"""0023 moves projects off the old ``*[bot]`` default and leaves edited lists alone."""

import json
import uuid

import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from conftest import _admin_engine

from backend.migrate import MIGRATIONS

NEW = ["ari-security[bot]", "dependabot[bot]", "renovate[bot]"]


def test_0023_rewrites_only_the_old_default_and_rolls_back():
    admin = _admin_engine()
    name = "botexcl_" + uuid.uuid4().hex[:12]
    with admin.connect() as conn:
        conn.execute(sa.text(f'CREATE DATABASE "{name}"'))
    engine = sa.create_engine(admin.url.set(database=name))
    cfg = Config()
    cfg.set_main_option("script_location", str(MIGRATIONS))

    def excluded(conn, pid):
        return conn.execute(
            sa.text("SELECT settings->'review'->'exclude_authors' FROM projects WHERE id=:id"),
            {"id": pid},
        ).scalar_one()

    try:
        with engine.begin() as conn:
            cfg.attributes["connection"] = conn
            command.upgrade(cfg, "0022")
            conn.execute(sa.text("INSERT INTO organizations(id,name) VALUES ('org_b','b')"))
            for pid, authors in [("prj_default", ["*[bot]"]), ("prj_custom", ["*[bot]", "ci-*"])]:
                settings = {"review": {"exclude_authors": authors, "strictness": 3}}
                conn.execute(
                    sa.text(
                        "INSERT INTO projects(id,org_id,name,settings) "
                        "VALUES (:id,'org_b',:id,CAST(:s AS jsonb))"
                    ),
                    {"id": pid, "s": json.dumps(settings)},
                )

            command.upgrade(cfg, "0023")
            assert excluded(conn, "prj_default") == NEW
            assert excluded(conn, "prj_custom") == ["*[bot]", "ci-*"]
            strictness = (
                "SELECT settings->'review'->'strictness' FROM projects WHERE id='prj_default'"
            )
            assert conn.execute(sa.text(strictness)).scalar_one() == 3

            command.downgrade(cfg, "0022")
            assert excluded(conn, "prj_default") == ["*[bot]"]
    finally:
        engine.dispose()
        with admin.connect() as conn:
            conn.execute(sa.text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
        admin.dispose()
