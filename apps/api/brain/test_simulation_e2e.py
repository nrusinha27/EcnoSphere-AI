"""
Stage 1 End-to-End Simulation Test
Runs the full simulation pipeline: create run → enqueue → worker processes → verify results
"""
import sys, os, asyncio

# Ensure we're run from apps/api directory
script_dir = os.path.dirname(os.path.abspath(__file__))
api_dir = os.path.dirname(script_dir)
os.chdir(api_dir)
sys.path.insert(0, api_dir)

from dotenv import load_dotenv
load_dotenv(os.path.join(api_dir, '.env'))

from rq import SimpleWorker, Queue
from app.redis.client import sync_redis_client
from app.database.session import AsyncSessionLocal
from app.services.simulation import SimulationService
from app.repositories.simulation import SimulationRepository
from app.repositories.scenario import ScenarioRepository
from app.models.scenario import Scenario

RESULTS = {}

async def run_test():
    print("=" * 60)
    print("STAGE 1 — END-TO-END SIMULATION TEST")
    print("=" * 60)

    # Step 1: Verify Redis
    print("\n[1] Checking Redis connectivity...")
    try:
        pong = sync_redis_client.ping()
        print(f"    Redis PING: {pong}")
        RESULTS['redis'] = 'CONNECTED'
    except Exception as e:
        print(f"    Redis FAILED: {e}")
        RESULTS['redis'] = f'FAILED: {e}'
        return

    # Step 2: Check DB and list available scenarios
    print("\n[2] Checking database connection and scenarios...")
    try:
        async with AsyncSessionLocal() as session:
            repo = ScenarioRepository(session)
            scenarios = await repo.get_scenarios(limit=10)
            print(f"    Found {len(scenarios)} scenario(s):")
            for s in scenarios:
                print(f"      - ID={s.id}: {s.title}")
            if not scenarios:
                print("    ERROR: No scenarios in database. Cannot test.")
                RESULTS['scenarios'] = 'NONE FOUND'
                return
            test_scenario = scenarios[0]
            RESULTS['scenarios'] = f"{len(scenarios)} available"
    except Exception as e:
        print(f"    DB FAILED: {e}")
        RESULTS['db'] = f'FAILED: {e}'
        return

    # Step 3: Create a simulation run via SimulationService
    print(f"\n[3] Starting simulation for scenario ID={test_scenario.id}: '{test_scenario.title}'...")
    try:
        async with AsyncSessionLocal() as session:
            service = SimulationService(session)
            run = await service.start_simulation(test_scenario.id, {'test_mode': True})
            run_id = run.id
            print(f"    Created SimulationRun ID={run_id}, status={run.status}")
            RESULTS['run_id'] = run_id
            RESULTS['initial_status'] = str(run.status)
    except Exception as e:
        print(f"    start_simulation FAILED: {e}")
        RESULTS['start_simulation'] = f'FAILED: {e}'
        return

    # Step 4: Run worker in burst mode to process the queued job
    print(f"\n[4] Running RQ worker in burst mode to process job...")
    try:
        queue = Queue('simulation_queue', connection=sync_redis_client)
        queue_len_before = len(queue)
        print(f"    Jobs in queue before burst: {queue_len_before}")
        
        worker = SimpleWorker([queue], connection=sync_redis_client)
        worker.work(burst=True)
        print(f"    Worker burst completed.")
        RESULTS['worker'] = 'BURST_COMPLETED'
    except Exception as e:
        print(f"    Worker FAILED: {e}")
        RESULTS['worker'] = f'FAILED: {e}'
        return

    # Step 5: Verify final status in DB
    print(f"\n[5] Verifying simulation results in database...")
    try:
        async with AsyncSessionLocal() as session:
            repo = SimulationRepository(session)
            updated_run = await repo.get_run(run_id)
            snapshots = await repo.get_snapshots(run_id)
            logs = await repo.get_logs(run_id)
            
            status_val = str(updated_run.status.value) if hasattr(updated_run.status, 'value') else str(updated_run.status)
            print(f"    Run status:    {status_val}")
            print(f"    Snapshots:     {len(snapshots)}")
            print(f"    Log entries:   {len(logs)}")
            
            if snapshots:
                s = snapshots[0]
                print(f"    First snapshot: day={s.horizon_days}, state_keys={list(s.global_state.keys())[:3] if s.global_state else 'empty'}")
            
            RESULTS['final_status'] = status_val
            RESULTS['snapshots'] = len(snapshots)
            RESULTS['logs'] = len(logs)
            
            if status_val.upper() == 'COMPLETED':
                print("\n✅ STAGE 1: SIMULATION VERIFIED — Run completed successfully.")
                RESULTS['verdict'] = 'STAGE1_SIMULATION_VERIFIED'
            elif status_val.upper() == 'RUNNING':
                print("\n⚠️  STAGE 1: SIMULATION PARTIALLY WORKING — Job is still running.")
                RESULTS['verdict'] = 'STAGE1_SIMULATION_PARTIALLY_WORKING'
            else:
                print(f"\n❌ STAGE 1: Status is {status_val}. Checking logs for errors...")
                for log in logs[-5:]:
                    print(f"    LOG [{log.severity}]: {log.message}")
                RESULTS['verdict'] = 'STAGE1_SIMULATION_PARTIALLY_WORKING'
    except Exception as e:
        print(f"    Verify FAILED: {e}")
        RESULTS['verify'] = f'FAILED: {e}'
        RESULTS['verdict'] = 'STAGE1_SIMULATION_BLOCKED'

    print("\n" + "=" * 60)
    print("RESULTS SUMMARY:")
    for k, v in RESULTS.items():
        print(f"  {k:20s}: {v}")
    print("=" * 60)
    return RESULTS

if __name__ == '__main__':
    asyncio.run(run_test())
