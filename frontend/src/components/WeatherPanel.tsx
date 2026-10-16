import { type FormEvent, useEffect, useRef, useState } from 'react'

type Language = 'en' | 'hi'

type Location = {
  id: number
  name: string
  latitude: number
  longitude: number
  admin1: string | null
  country: string | null
  country_code: string | null
}

type ForecastDay = {
  date: string
  temperature_min_c: number | null
  temperature_max_c: number | null
  precipitation_probability_percent: number | null
  precipitation_mm: number | null
  wind_max_kmh: number | null
  weather_code: number | null
}

type Forecast = {
  provider: string
  provider_url: string
  latitude: number
  longitude: number
  timezone: string
  fetched_at: string
  days: ForecastDay[]
}

type Props = {
  language: Language
}

const copy = {
  en: {
    title: 'Weather',
    intro: 'Search for your nearest town in India, then select a result.',
    town: 'Town or city',
    placeholder: 'e.g. Karnal',
    search: 'Search',
    searching: 'Searching…',
    choose: 'Choose your location',
    noResults: 'No matching locations. Try a nearby town or another spelling.',
    searchError: 'Location search is unavailable. Please try again.',
    forecastError: 'Weather is unavailable. Please try again.',
    loading: 'Loading forecast…',
    refresh: 'Refresh forecast',
    retry: 'Try again',
    retrieved: 'Retrieved',
    timezone: 'Forecast timezone',
    min: 'Minimum',
    max: 'Maximum',
    probability: 'Precipitation chance',
    precipitation: 'Precipitation',
    wind: 'Maximum wind',
    unavailable: 'Unavailable',
    stale: 'This forecast was retrieved over 30 minutes ago. Refresh it.',
    guidance:
      'Use the forecast to review your plans. Irrigation and spraying decisions also depend on crop stage, soil and field conditions.',
    scope:
      'Weather is for the location selected here. It does not change your saved field location.',
    source: 'Weather data',
  },
  hi: {
    title: 'मौसम',
    intro: 'भारत में अपना नज़दीकी शहर खोजें, फिर सही स्थान चुनें।',
    town: 'कस्बा या शहर',
    placeholder: 'जैसे Karnal',
    search: 'खोजें',
    searching: 'खोज रहे हैं…',
    choose: 'अपना स्थान चुनें',
    noResults: 'स्थान नहीं मिला। नज़दीकी शहर या दूसरी वर्तनी आज़माएं।',
    searchError: 'स्थान की खोज उपलब्ध नहीं है। फिर कोशिश करें।',
    forecastError: 'मौसम उपलब्ध नहीं है। फिर कोशिश करें।',
    loading: 'मौसम लोड हो रहा है…',
    refresh: 'मौसम ताज़ा करें',
    retry: 'फिर कोशिश करें',
    retrieved: 'प्राप्त किया गया',
    timezone: 'पूर्वानुमान का समय क्षेत्र',
    min: 'न्यूनतम',
    max: 'अधिकतम',
    probability: 'वर्षण की संभावना',
    precipitation: 'वर्षण',
    wind: 'अधिकतम हवा',
    unavailable: 'उपलब्ध नहीं',
    stale: 'यह पूर्वानुमान 30 मिनट से अधिक पहले प्राप्त किया गया था। ताज़ा करें।',
    guidance:
      'मौसम देखकर अपनी योजना की समीक्षा करें। सिंचाई और छिड़काव के फैसले फसल की अवस्था, मिट्टी और खेत की स्थिति पर भी निर्भर करते हैं।',
    scope:
      'मौसम यहां चुने गए स्थान के लिए है। इससे खेत का सहेजा गया स्थान नहीं बदलता।',
    source: 'मौसम डेटा',
  },
} as const

async function weatherRequest<T>(
  path: string,
  signal: AbortSignal,
): Promise<T> {
  const token = window.localStorage.getItem('agrios.accessToken')
  const base = import.meta.env.VITE_API_URL ?? ''

  const response = await fetch(`${base}/api/weather${path}`, {
    signal,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  if (!response.ok) {
    throw new Error('Weather request failed')
  }

  return response.json() as Promise<T>
}

export default function WeatherPanel({ language }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Location[]>([])
  const [searched, setSearched] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchFailed, setSearchFailed] = useState(false)
  const [selected, setSelected] = useState<Location | null>(null)
  const [forecast, setForecast] = useState<Forecast | null>(null)
  const [loading, setLoading] = useState(false)
  const [forecastFailed, setForecastFailed] = useState(false)
  const [now, setNow] = useState(Date.now)

  const searchController = useRef<AbortController | null>(null)
  const forecastController = useRef<AbortController | null>(null)

  const t = copy[language]
  const locale = language === 'hi' ? 'hi-IN' : 'en-IN'

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000)

    return () => {
      window.clearInterval(timer)
      searchController.current?.abort()
      forecastController.current?.abort()
    }
  }, [])

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const name = query.trim()
    if (name.length < 2) return

    searchController.current?.abort()
    const controller = new AbortController()
    searchController.current = controller

    setSearching(true)
    setSearchFailed(false)
    setSearched(false)
    setResults([])

    try {
      const params = new URLSearchParams({
        q: name,
        language,
      })

      const response = await weatherRequest<{ results: Location[] }>(
        `/locations?${params}`,
        controller.signal,
      )

      if (!controller.signal.aborted) {
        setResults(response.results)
        setSearched(true)
      }
    } catch {
      if (!controller.signal.aborted) {
        setSearchFailed(true)
      }
    } finally {
      if (!controller.signal.aborted) {
        setSearching(false)
      }
    }
  }

  async function loadForecast(location: Location) {
    forecastController.current?.abort()
    const controller = new AbortController()
    forecastController.current = controller

    setSelected(location)
    setForecast(null)
    setLoading(true)
    setForecastFailed(false)

    try {
      const params = new URLSearchParams({
        latitude: String(location.latitude),
        longitude: String(location.longitude),
      })

      const response = await weatherRequest<Forecast>(
        `/forecast?${params}`,
        controller.signal,
      )

      if (!controller.signal.aborted) {
        setForecast(response)
        setNow(Date.now())
      }
    } catch {
      if (!controller.signal.aborted) {
        setForecastFailed(true)
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }

  function locationName(location: Location): string {
    return [location.name, location.admin1, location.country]
      .filter(Boolean)
      .join(', ')
  }

  function display(value: number | null, unit: string): string {
    if (value === null) return t.unavailable

    return `${new Intl.NumberFormat(locale, {
      maximumFractionDigits: 1,
    }).format(value)}${unit}`
  }

  function formatDay(value: string): string {
    return new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(`${value}T00:00:00Z`))
  }

  const stale = forecast
    ? now - new Date(forecast.fetched_at).getTime() > 30 * 60 * 1000
    : false

  return (
    <section className="form-card" style={{ marginTop: '20px' }}>
      <div className="card-heading">
        <div>
          <h2>{t.title}</h2>
          <p>{t.intro}</p>
        </div>
      </div>

      <form onSubmit={search}>
        <label>
          <span>{t.town}</span>
          <input
            required
            minLength={2}
            maxLength={100}
            value={query}
            placeholder={t.placeholder}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <button
          className="primary-button"
          type="submit"
          disabled={searching || query.trim().length < 2}
        >
          {searching ? t.searching : t.search}
        </button>
      </form>

      {searchFailed && (
        <p className="error-message" role="alert">{t.searchError}</p>
      )}

      {searched && results.length === 0 && (
        <p role="status">{t.noResults}</p>
      )}

      {results.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h3>{t.choose}</h3>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              display: 'grid',
              gap: '8px',
            }}
          >
            {results.map((location) => (
              <li key={location.id}>
                <button
                  type="button"
                  aria-pressed={selected?.id === location.id}
                  onClick={() => void loadForecast(location)}
                  style={{
                    width: '100%',
                    padding: '14px',
                    textAlign: 'left',
                    borderRadius: '10px',
                    border: '1px solid #bfd0c0',
                    background:
                      selected?.id === location.id ? '#edf5ee' : '#fff',
                    color: '#183b24',
                    cursor: 'pointer',
                  }}
                >
                  {locationName(location)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selected && (
        <div style={{ marginTop: '24px' }}>
          <div className="card-heading">
            <h3>{locationName(selected)}</h3>
            <button
              className="text-button"
              type="button"
              disabled={loading}
              onClick={() => void loadForecast(selected)}
            >
              {t.refresh}
            </button>
          </div>

          <p>{t.scope}</p>

          {loading && <p role="status">{t.loading}</p>}

          {forecastFailed && (
            <div>
              <p className="error-message" role="alert">
                {t.forecastError}
              </p>
              <button
                className="text-button"
                type="button"
                onClick={() => void loadForecast(selected)}
              >
                {t.retry}
              </button>
            </div>
          )}

          {forecast && (
            <>
              <p>
                {t.retrieved}:{' '}
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(forecast.fetched_at))}
              </p>
              <p>{t.timezone}: {forecast.timezone}</p>

              {stale && (
                <p className="error-message" role="status">{t.stale}</p>
              )}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '12px',
                  marginTop: '16px',
                }}
              >
                {forecast.days.map((day) => (
                  <article
                    key={day.date}
                    style={{
                      padding: '18px',
                      borderRadius: '12px',
                      background: '#eef3fb',
                      color: '#24476b',
                    }}
                  >
                    <h3>{formatDay(day.date)}</h3>
                    <p>
                      {t.min}: <strong>
                        {display(day.temperature_min_c, ' °C')}
                      </strong>
                    </p>
                    <p>
                      {t.max}: <strong>
                        {display(day.temperature_max_c, ' °C')}
                      </strong>
                    </p>
                    <p>
                      {t.probability}:{' '}
                      {display(day.precipitation_probability_percent, '%')}
                    </p>
                    <p>
                      {t.precipitation}:{' '}
                      {display(day.precipitation_mm, ' mm')}
                    </p>
                    <p>
                      {t.wind}: {display(day.wind_max_kmh, ' km/h')}
                    </p>
                  </article>
                ))}
              </div>

              <p style={{ marginTop: '20px' }}>{t.guidance}</p>

              <p>
                {t.source}:{' '}
                <a
                  href="https://open-meteo.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open-Meteo
                </a>
              </p>
            </>
          )}
        </div>
      )}

      {searched && (
        <small>
          Location data:{' '}
          <a
            href="https://www.geonames.org/"
            target="_blank"
            rel="noopener noreferrer"
          >
            GeoNames
          </a>
          {' / '}
          <a
            href="https://open-meteo.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open-Meteo
          </a>
        </small>
      )}
    </section>
  )
}