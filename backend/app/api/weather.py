import json
from datetime import UTC, date, datetime
from typing import Literal
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ValidationError

from backend.app.dependencies import CurrentUser


router = APIRouter(
    prefix="/api/weather",
    tags=["weather"],
)

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"


class LocationResult(BaseModel):
    id: int
    name: str
    latitude: float
    longitude: float
    admin1: str | None = None
    country: str | None = None
    country_code: str | None = None


class LocationSearch(BaseModel):
    results: list[LocationResult]


class ForecastDay(BaseModel):
    date: date
    temperature_min_c: float | None
    temperature_max_c: float | None
    precipitation_probability_percent: float | None
    precipitation_mm: float | None
    wind_max_kmh: float | None
    weather_code: int | None


class ForecastResponse(BaseModel):
    provider: str = "Open-Meteo"
    provider_url: str = "https://open-meteo.com/"
    latitude: float
    longitude: float
    timezone: str

    # When AgriOS retrieved the response, not the model's issue time.
    fetched_at: datetime

    days: list[ForecastDay]


def fetch_provider_json(url: str, params: dict) -> dict:
    request = Request(
        f"{url}?{urlencode(params)}",
        headers={
            "Accept": "application/json",
            "User-Agent": "AgriOS-Development/0.1",
        },
    )

    try:
        with urlopen(request, timeout=10) as response:
            data = json.load(response)

        if not isinstance(data, dict) or data.get("error"):
            raise ValueError("Invalid provider response")

        return data

    except (OSError, ValueError):
        raise HTTPException(
            status_code=503,
            detail="Weather service is unavailable. Please try again shortly.",
        ) from None


@router.get("/locations", response_model=LocationSearch)
def search_locations(
    current_user: CurrentUser,
    q: str = Query(min_length=2, max_length=100),
    language: Literal["en", "hi"] = "en",
):
    del current_user

    search_text = q.strip()

    if len(search_text) < 2:
        raise HTTPException(
            status_code=422,
            detail="Enter at least two characters for the town name",
        )

    data = fetch_provider_json(
        GEOCODING_URL,
        {
            "name": search_text,
            "count": 5,
            "language": language,
            "format": "json",
            "countryCode": "IN",
        },
    )

    try:
        return LocationSearch(
            results=[
                LocationResult.model_validate(item)
                for item in data.get("results", [])
            ]
        )
    except (ValidationError, TypeError):
        raise HTTPException(
            status_code=503,
            detail="Location search returned an unexpected response.",
        ) from None


@router.get("/forecast", response_model=ForecastResponse)
def get_forecast(
    current_user: CurrentUser,
    latitude: float = Query(ge=-90, le=90, allow_inf_nan=False),
    longitude: float = Query(ge=-180, le=180, allow_inf_nan=False),
):
    del current_user

    data = fetch_provider_json(
        FORECAST_URL,
        {
            "latitude": latitude,
            "longitude": longitude,
            "daily": ",".join(
                [
                    "weather_code",
                    "temperature_2m_min",
                    "temperature_2m_max",
                    "precipitation_probability_max",
                    "precipitation_sum",
                    "wind_speed_10m_max",
                ]
            ),
            "temperature_unit": "celsius",
            "wind_speed_unit": "kmh",
            "precipitation_unit": "mm",
            "timezone": "auto",
            "forecast_days": 3,
        },
    )

    try:
        daily = data["daily"]
        dates = daily["time"]

        if not isinstance(dates, list) or len(dates) != 3:
            raise ValueError("Unexpected forecast dates")

        variables = [
            "weather_code",
            "temperature_2m_min",
            "temperature_2m_max",
            "precipitation_probability_max",
            "precipitation_sum",
            "wind_speed_10m_max",
        ]

        for variable in variables:
            values = daily[variable]
            if not isinstance(values, list) or len(values) != len(dates):
                raise ValueError("Incomplete forecast")

        days = [
            ForecastDay(
                date=day,
                temperature_min_c=daily["temperature_2m_min"][index],
                temperature_max_c=daily["temperature_2m_max"][index],
                precipitation_probability_percent=(
                    daily["precipitation_probability_max"][index]
                ),
                precipitation_mm=daily["precipitation_sum"][index],
                wind_max_kmh=daily["wind_speed_10m_max"][index],
                weather_code=daily["weather_code"][index],
            )
            for index, day in enumerate(dates)
        ]

        return ForecastResponse(
            latitude=latitude,
            longitude=longitude,
            timezone=data["timezone"],
            fetched_at=datetime.now(UTC),
            days=days,
        )

    except (KeyError, TypeError, ValueError):
        raise HTTPException(
            status_code=503,
            detail="Weather service returned an incomplete forecast.",
        ) from None