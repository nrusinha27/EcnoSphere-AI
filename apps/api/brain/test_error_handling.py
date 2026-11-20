"""
Checkpoint 5 — Error handling verification
Tests the API under Redis-unavailable and invalid scenario conditions.
Requires FastAPI server running on :8000.
"""
import sys, os, asyncio, urllib.request, urllib.error, json
sys.path.insert(0, os.path.abspath('apps/api'))
from dotenv import load_dotenv; load_dotenv('apps/api/.env')

BASE = 'http://127.0.0.1:8000'
PASS, FAIL = [], []

def req(method, path, payload=None):
    url = f'{BASE}{path}'
    data = json.dumps(payload).encode() if payload else None
    headers = {'Content-Type': 'application/json'}
    rq = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        r = urllib.request.urlopen(rq, timeout=5)
        return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())
    except Exception as e:
        return None, str(e)

def check(label, status, body, expected_status, check_fn=None):
    ok = status == expected_status and (check_fn is None or check_fn(body))
    result = "PASS" if ok else "FAIL"
    (PASS if ok else FAIL).append(label)
    print(f"  [{result}] {label} (HTTP {status}) -> {str(body)[:100]}")

print("=" * 60)
print("CHECKPOINT 5 — ERROR HANDLING VERIFICATION")
print("=" * 60)

print("\n[A] Valid simulation start (scenario 1)...")
status, body = req('POST', '/api/v1/simulation/start', {'scenario_id': 1})
check("Start valid simulation", status, body, 201)

print("\n[B] Invalid scenario ID (scenario 9999)...")
status, body = req('POST', '/api/v1/simulation/start', {'scenario_id': 9999})
check("404 on missing scenario", status, body, 404)

print("\n[C] Invalid payload (missing scenario_id)...")
status, body = req('POST', '/api/v1/simulation/start', {'bad_field': 'x'})
check("422 on bad payload", status, body, 422)

print("\n[D] Get status of valid run (run 8)...")
status, body = req('GET', '/api/v1/simulation/8/status')
check("Run 8 status", status, body, 200, lambda b: b.get('status') == 'COMPLETED')

print("\n[E] Get snapshots for valid run (run 8)...")
status, body = req('GET', '/api/v1/simulation/8/snapshots')
check("Run 8 has 6 snapshots", status, body, 200, lambda b: isinstance(b, list) and len(b) == 6)

print("\n[F] Get status of non-existent run (run 99999)...")
status, body = req('GET', '/api/v1/simulation/99999/status')
check("404 on non-existent run", status, body, 404)

print("\n[G] Get snapshots for non-existent run (run 99999)...")
status, body = req('GET', '/api/v1/simulation/99999/snapshots')
check("404 snapshots non-existent run", status, body, 404)

print("\n[H] Scenarios list endpoint...")
status, body = req('GET', '/api/v1/scenarios')
check("Scenarios list returns 200", status, body, 200, lambda b: isinstance(b, list) and len(b) > 0)

print("\n[I] Simulation runs list endpoint...")
status, body = req('GET', '/api/v1/simulation')
check("Simulation list returns 200", status, body, 200, lambda b: isinstance(b, list))

print("\n" + "=" * 60)
print(f"RESULTS: {len(PASS)} PASS, {len(FAIL)} FAIL")
if FAIL:
    print("FAILED:", FAIL)
print("=" * 60)
