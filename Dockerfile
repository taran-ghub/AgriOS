FROM node:24-bookworm-slim AS frontend-build

WORKDIR /build/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


# Run the Python API and serve the built website.
FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

WORKDIR /app

COPY backend/requirements-lock.txt /app/backend/requirements-lock.txt
RUN pip install --no-cache-dir -r /app/backend/requirements-lock.txt

COPY backend/ /app/backend/
COPY alembic.ini /app/alembic.ini
COPY --from=frontend-build /build/frontend/dist /app/frontend/dist

RUN useradd --create-home --uid 10001 agrios \
    && chown -R agrios:agrios /app

USER agrios

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && exec uvicorn backend.app.main:app --host 0.0.0.0 --port \"${PORT}\""]