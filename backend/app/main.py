from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.auth import router as auth_router
from backend.app.api.crop_cycles import router as crop_cycles_router
from backend.app.api.expenses import router as expenses_router
from backend.app.api.irrigation import router as irrigation_router
from backend.app.database import create_tables


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


@app.get("/health", tags=["system"])
def health_check() -> dict[str, str]:
    return {
        "status": "healthy",
        "service": "agrios-api",
        "version": "0.1.0",
    }