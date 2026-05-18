# CloudPhone Manager Sidecar

Python FastAPI service that the Electron app spawns to manage redroid
containers, ADB connections and proxy plumbing.

## Quick start (development)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate    # Windows
# source .venv/bin/activate    # macOS/Linux
pip install -r requirements.txt

# Run standalone for API testing
uvicorn app.main:app --reload --host 127.0.0.1 --port 38080
```

Visit <http://127.0.0.1:38080/health>.

When the Electron app is in dev mode it spawns this sidecar automatically;
see `electron/sidecar.ts`.

## Environment

| var | default | purpose |
| --- | --- | --- |
| `CP_SIDECAR_HOST` | `127.0.0.1` | bind host |
| `CP_SIDECAR_PORT` | `38080` | bind port |
| `CP_DATA_DIR` | _empty_ | where phone data lives |
| `CP_SNAPSHOT_DIR` | _empty_ | snapshot storage |
| `CP_APK_DIR` | _empty_ | APK library |
| `CP_LOG_LEVEL` | `info` | `debug` enables `/docs` |
| `CP_IPC_TOKEN` | _empty_ | required header `X-CP-Token` |
| `CP_CORS_ORIGINS` | _empty_ | comma list (e.g. dev renderer URL) |

## Layout

```
backend/
  app/
    main.py            FastAPI app factory + lifespan
    config.py          Env-driven settings
    security.py        Token guard for protected routes
    schemas.py         Pydantic models (mirror frontend types)
    docker_client.py   Lazy docker-py wrapper
    routers/
      health.py        /health, /version (anonymous)
      phones.py        /phones CRUD + lifecycle (token-guarded)
  requirements.txt
  pyproject.toml
```
