from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.api.auth import router as auth_router
from backend.app.api.crop_cycles import router as crop_cycles_router
from backend.app.api.expenses import router as expenses_router
from backend.app.api.harvests import router as harvests_router
from backend.app.api.irrigation import router as irrigation_router
from backend.app.api.records import router as records_router
from backend.app.api.sales import router as sales_router
from backend.app.api.today import router as today_router
from backend.app.api.weather import router as weather_router
from backend.app.database import create_tables

PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"


@asynccontextmanager
async def lifespan(_: FastAPI):
    create_tables()
    yield


app = FastAPI(
    title="AgriOS API",
    description="Backend API for the AgriOS farm operations assistant",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(crop_cycles_router)
app.include_router(irrigation_router)
app.include_router(expenses_router)
app.include_router(harvests_router)
app.include_router(sales_router)
app.include_router(today_router)
app.include_router(weather_router)
app.include_router(records_router)


@app.get("/health", tags=["system"])
def health_check() -> dict[str, str]:
    return {
        "status": "healthy",
        "service": "agrios-api",
        "version": "0.1.0",
    }


# Register this last so API routes take priority.
if FRONTEND_DIST.is_dir():
    app.mount(
        "/",
        StaticFiles(directory=str(FRONTEND_DIST), html=True),
        name="frontend",
    )
