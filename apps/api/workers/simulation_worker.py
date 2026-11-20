import os
import sys
import asyncio
import concurrent.futures
from rq import Worker, SimpleWorker, Queue
from dotenv import load_dotenv

# Add app to path so we can import from app
_worker_dir = os.path.dirname(os.path.abspath(__file__))
_api_dir = os.path.dirname(_worker_dir)
sys.path.insert(0, _api_dir)

# Load .env from apps/api/.env — must happen before settings are imported
load_dotenv(os.path.join(_api_dir, '.env'))

from app.redis.client import sync_redis_client
from app.engine.simulation import SimulationEngine


def run_simulation_job(run_id: int):
    """
    Entry point for the RQ worker to run a simulation.

    Design constraints on Windows:
    1. RQ must use SimpleWorker (no os.fork on Windows).
    2. SimpleWorker maintains an internal event loop, so asyncio.run() called
       directly inside run_simulation_job raises:
           RuntimeError: asyncio.run() cannot be called from a running event loop
    3. asyncpg connection pools are event-loop-bound: a pool created in loop A
       cannot be used in loop B, raising "Future attached to a different loop".

    Solution:
    - Spin up a dedicated worker thread with concurrent.futures.ThreadPoolExecutor.
    - The thread has NO running event loop, so asyncio.run() starts a fresh one.
    - Create a brand-new SQLAlchemy async engine with NullPool inside that thread,
      ensuring the asyncpg pool belongs exclusively to the thread's event loop.
    - Dispose the engine after each job to release all connections cleanly.
    """
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
    from sqlalchemy.pool import NullPool
    from app.core.config import settings

    async def async_runner():
        # Fresh NullPool engine — no connection reuse across loops
        engine = create_async_engine(
            settings.database_url,
            poolclass=NullPool,
            echo=False,
        )
        session_factory = async_sessionmaker(
            bind=engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False,
        )
        try:
            async with session_factory() as session:
                sim_engine = SimulationEngine(session, run_id)
                await sim_engine.execute()
        finally:
            await engine.dispose()

    def _thread_target():
        # Windows: apply Selector policy before starting the loop
        if sys.platform == 'win32':
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        asyncio.run(async_runner())

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(_thread_target)
        future.result()  # Re-raises any exception from the thread


if __name__ == '__main__':
    queue = Queue('simulation_queue', connection=sync_redis_client)
    worker_cls = SimpleWorker if sys.platform == 'win32' else Worker
    worker = worker_cls([queue], connection=sync_redis_client)
    print(f"Simulation Worker starting ({worker_cls.__name__})...")
    worker.work()
