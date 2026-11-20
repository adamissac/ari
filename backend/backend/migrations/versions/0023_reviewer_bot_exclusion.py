"""Reviewer default: skip only Ari's own bot and dependency-update bots, not every ``*[bot]`` author.

The old ``*[bot]`` default also skipped coding agents (Devin, Copilot) whose PRs most need a
review. Projects whose exclusion list is still exactly the old default move to the new one;
a list a team edited is left alone.
"""

from alembic import op

revision = "0023"
down_revision = "0022"
branch_labels = None
depends_on = None

OLD = '["*[bot]"]'
NEW = '["ari-security[bot]", "dependabot[bot]", "renovate[bot]"]'


def _swap(old: str, new: str) -> None:
    op.execute(
        f"""
        UPDATE projects
        SET settings = jsonb_set(settings, '{{review,exclude_authors}}', '{new}'::jsonb)
        WHERE settings->'review'->'exclude_authors' = '{old}'::jsonb
        """
    )


def upgrade() -> None:
    _swap(OLD, NEW)


def downgrade() -> None:
    _swap(NEW, OLD)
