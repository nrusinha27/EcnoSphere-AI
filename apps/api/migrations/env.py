import asyncio
import sys
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    from logging.config import fileConfig
    fileConfig(config.config_file_name)
import sys
from os.path import abspath, dirname
sys.path.insert(0, dirname(dirname(abspath(__file__))))
from app.database.base import Base
import app.models.country
import app.models.scenario
import app.models.simulation
import app.models.trade  # Phase 22: bilateral trade ledger
from app.core.config import settings

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    # Fail-closed safety guard using actual connection metadata (not just URL string)
    import sqlalchemy as sa
    db_name = connection.execute(sa.text("SELECT current_database();")).scalar()
    if db_name == "econosphere":
        raise RuntimeError(
            "FAIL-CLOSED SAFETY GUARD: Connection metadata confirms target database is active "
            "'econosphere'. Migration execution on the active production database is strictly prohibited!"
        )

    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """In this scenario we need to create an Engine
    and associate a connection with the context.

    """

    configuration = config.get_section(config.config_ini_section, {})
    target_url = config.get_main_option("sqlalchemy.url")
    if not target_url or "driver://user:pass@localhost/dbname" in target_url:
        target_url = str(settings.database_url)

    # Fail-closed safety guard against mutating active database in testing
    import os
    if "econosphere" in target_url and "econosphere_migration_test" not in target_url:
        raise RuntimeError(
            "FAIL-CLOSED GUARD: Migration URL strictly forbidden from targeting active 'econosphere' database!"
        )

    configuration["sqlalchemy.url"] = target_url
    
    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
        await connection.commit()

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    # Python 3.14 on Windows defaults to ProactorEventLoop which has a known
    # asyncpg socket resolution bug. Use SelectorEventLoop for Alembic runs.
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
