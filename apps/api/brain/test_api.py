import urllib.request, json

base = 'http://127.0.0.1:8000'

def get(path):
    try:
        r = urllib.request.urlopen(f'{base}{path}', timeout=5)
        return r.status, json.loads(r.read())
    except Exception as e:
        return None, str(e)

# Health
status, data = get('/health')
print(f'Health: {status} -> {data}')

# Scenarios list
status, data = get('/api/v1/scenarios')
print(f'Scenarios: {status} -> {len(data) if isinstance(data, list) else data}')

# Simulation runs
status, data = get('/api/v1/simulation')
print(f'Simulation runs: {status} -> count={len(data) if isinstance(data, list) else data}')

# Run 8 status
status, data = get('/api/v1/simulation/8')
if isinstance(data, dict):
    print(f'Run 8: status={status}, sim_status={data.get("status")}')
else:
    print(f'Run 8: {status} -> {data}')

# Snapshots for run 8
status, data = get('/api/v1/simulation/8/snapshots')
if isinstance(data, list):
    print(f'Run 8 snapshots: {status} -> count={len(data)}')
    if data:
        gs = data[0].get('global_state', {})
        print(f'  First snapshot day={data[0].get("horizon_days")}, countries={len(gs)}')
else:
    print(f'Snapshots: {status} -> {data}')

# Logs for run 8
status, data = get('/api/v1/simulation/8/logs')
if isinstance(data, list):
    print(f'Run 8 logs: {status} -> count={len(data)}')
else:
    print(f'Logs: {status} -> {data}')
