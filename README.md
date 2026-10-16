# AgriOS

AgriOS is a multilingual, mobile-first farm operations assistant. The first working flow helps a farmer create a field and wheat crop cycle, then follow and edit a task calendar generated from the sowing date.

## Current milestone

- Create a field with acres or kanal
- Register, sign in, and revoke account sessions
- Keep each field, crop cycle, and task private to its owning account
- Start a wheat crop cycle from a sowing date
- Save the crop cycle and reopen it later
- Complete, skip, postpone, or reschedule tasks
- Switch the interface between English and Hindi
- Keep development schedules clearly labelled as sample data

The bundled task offsets are product-development placeholders, not agricultural advice. They must be replaced with reviewed and versioned agronomic sources before farmer-facing use.

## Technology

- React and TypeScript frontend
- FastAPI and SQLAlchemy backend
- SQLite for local development
- PBKDF2 password hashing and revocable opaque session tokens
- Pytest and Ruff for backend quality checks
- ESLint and TypeScript checks for the frontend

## Run locally

### Backend

Activate the `agrios` Conda environment, then run from the repository root:

```powershell
uvicorn backend.app.main:app --reload
```

The API is available at `http://127.0.0.1:8000`, with interactive documentation at `http://127.0.0.1:8000/docs`.

### Frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. Vite forwards `/api` calls to the local FastAPI server.

## Verify

From the repository root:

```powershell
pytest
ruff check backend
```

From `frontend/`:

```powershell
npm run lint
npm run build
```

## Next milestone

Add irrigation records and a focused Today screen, then introduce expense records and tested cost calculations. The current authentication is suitable for local development; production deployment should move session delivery to secure, HTTP-only cookies and add account recovery.
