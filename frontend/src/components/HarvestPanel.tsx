import { type FormEvent, useEffect, useState } from 'react'

type Language = 'en' | 'hi'
type HarvestUnit = 'kg' | 'quintal'

type HarvestRecord = {
  id: number
  crop_cycle_id: number
  harvest_date: string
  quantity_grams: number
  notes: string | null
  created_at: string
}

type HarvestOverview = {
  total_recorded_grams: number
  record_count: number
  records: HarvestRecord[]
}

type Props = {
  cropCycleId: number
  language: Language
}

const copy = {
  en: {
    title: 'Harvest records',
    intro: 'Record the crop you have harvested.',
    total: 'Total recorded harvest',
    notice: 'Harvest quantity does not represent sales or income.',
    date: 'Harvest date',
    quantity: 'Quantity',
    unit: 'Unit',
    kg: 'kg',
    quintal: 'quintal',
    conversion: '1 quintal = 100 kg',
    notes: 'Notes (optional)',
    save: 'Save harvest',
    saving: 'Saving…',
    loading: 'Loading harvest records…',
    history: 'Harvest history',
    empty: 'No harvest recorded yet.',
    retry: 'Try again',
    loadError: 'Could not load harvest records.',
    saveError: 'Could not save the harvest. Please try again.',
    success: 'Harvest saved.',
  },
  hi: {
    title: 'कटाई के रिकॉर्ड',
    intro: 'काटी गई फसल की मात्रा दर्ज करें।',
    total: 'कुल दर्ज उपज',
    notice: 'उपज की मात्रा बिक्री या आय नहीं दर्शाती।',
    date: 'कटाई की तारीख',
    quantity: 'मात्रा',
    unit: 'इकाई',
    kg: 'किलो',
    quintal: 'क्विंटल',
    conversion: '1 क्विंटल = 100 किलो',
    notes: 'नोट्स (वैकल्पिक)',
    save: 'कटाई सहेजें',
    saving: 'सहेजा जा रहा है…',
    loading: 'कटाई रिकॉर्ड लोड हो रहे हैं…',
    history: 'कटाई का विवरण',
    empty: 'अभी कोई कटाई दर्ज नहीं है।',
    retry: 'फिर कोशिश करें',
    loadError: 'कटाई रिकॉर्ड लोड नहीं हुए।',
    saveError: 'कटाई सहेजी नहीं गई। फिर कोशिश करें।',
    success: 'कटाई सहेजी गई।',
  },
} as const

function today(): string {
  const now = new Date()

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

function sortRecords(records: HarvestRecord[]): HarvestRecord[] {
  return [...records].sort(
    (a, b) =>
      b.harvest_date.localeCompare(a.harvest_date) || b.id - a.id,
  )
}

async function harvestRequest<T>(
  cropCycleId: number,
  options?: RequestInit,
): Promise<T> {
  const base = import.meta.env.VITE_API_URL ?? ''
  const token = window.localStorage.getItem('agrios.accessToken')

  const response = await fetch(
    `${base}/api/crop-cycles/${cropCycleId}/harvests`,
    {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  )

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const detail: unknown = body?.detail

    if (typeof detail === 'string') {
      throw new Error(detail)
    }

    if (Array.isArray(detail)) {
      const messages = detail.map((item: unknown) => {
        if (
          typeof item === 'object'
          && item !== null
          && 'msg' in item
          && typeof item.msg === 'string'
        ) {
          return item.msg
        }

        return 'Invalid harvest data'
      })

      throw new Error(messages.join('; '))
    }

    throw new Error('')
  }

  return response.json() as Promise<T>
}

export default function HarvestPanel({
  cropCycleId,
  language,
}: Props) {
  const [overview, setOverview] = useState<HarvestOverview | null>(null)
  const [date, setDate] = useState(today)
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState<HarvestUnit>('kg')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [reload, setReload] = useState(0)

  const t = copy[language]

  useEffect(() => {
    const controller = new AbortController()

    async function loadHarvests() {
      setLoading(true)
      setLoadFailed(false)

      try {
        const result = await harvestRequest<HarvestOverview>(
          cropCycleId,
          { signal: controller.signal },
        )

        if (!controller.signal.aborted) {
          setOverview(result)
        }
      } catch {
        if (!controller.signal.aborted) {
          setLoadFailed(true)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadHarvests()

    return () => controller.abort()
  }, [cropCycleId, reload])

  function formatQuantity(grams: number, divisor: number): string {
    return new Intl.NumberFormat(
      language === 'hi' ? 'hi-IN' : 'en-IN',
      { maximumFractionDigits: divisor === 1000 ? 3 : 5 },
    ).format(grams / divisor)
  }

  function formatDate(value: string): string {
    return new Intl.DateTimeFormat(
      language === 'hi' ? 'hi-IN' : 'en-IN',
      {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      },
    ).format(new Date(`${value}T00:00:00Z`))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!overview || saving) return

    setSaving(true)
    setSaveError(null)
    setSaved(false)

    try {
      const record = await harvestRequest<HarvestRecord>(
        cropCycleId,
        {
          method: 'POST',
          body: JSON.stringify({
            harvest_date: date,
            quantity,
            unit,
            notes: notes.trim() || null,
          }),
        },
      )

      setOverview((current) => {
        if (!current) return current

        return {
          total_recorded_grams:
            current.total_recorded_grams + record.quantity_grams,
          record_count: current.record_count + 1,
          records: sortRecords([record, ...current.records]),
        }
      })

      setQuantity('')
      setNotes('')
      setSaved(true)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="form-card" style={{ marginTop: '28px' }}>
      <div className="card-heading">
        <div>
          <h2>{t.title}</h2>
          <p>{t.intro}</p>
        </div>
      </div>

      {loading ? (
        <p role="status">{t.loading}</p>
      ) : loadFailed || !overview ? (
        <div>
          <p className="error-message" role="alert">
            {t.loadError}
          </p>

          <button
            className="text-button"
            type="button"
            onClick={() => setReload((value) => value + 1)}
          >
            {t.retry}
          </button>
        </div>
      ) : (
        <>
          <div
            style={{
              padding: '20px',
              marginBottom: '24px',
              borderRadius: '14px',
              background: '#fff5dc',
              color: '#59420e',
            }}
          >
            <span>{t.total}</span>

            <strong
              style={{
                display: 'block',
                fontSize: '28px',
                marginTop: '8px',
              }}
            >
              {formatQuantity(overview.total_recorded_grams, 1000)}
              {' '}{t.kg}
            </strong>

            <p>
              {formatQuantity(overview.total_recorded_grams, 100000)}
              {' '}{t.quintal}
            </p>

            <small>{t.notice}</small>
          </div>

          <form onSubmit={handleSubmit}>
            <fieldset
              disabled={saving}
              style={{
                border: 0,
                padding: 0,
                margin: 0,
                minWidth: 0,
              }}
            >
              <label>
                <span>{t.date}</span>
                <input
                  required
                  type="date"
                  max={today()}
                  value={date}
                  onChange={(event) => {
                    setDate(event.target.value)
                    setSaved(false)
                  }}
                />
              </label>

              <div className="form-row">
                <label>
                  <span>{t.quantity}</span>
                  <input
                    required
                    type="number"
                    inputMode="decimal"
                    min="0.001"
                    max="1000000"
                    step="0.001"
                    placeholder="0"
                    value={quantity}
                    onChange={(event) => {
                      setQuantity(event.target.value)
                      setSaved(false)
                    }}
                  />
                </label>

                <label>
                  <span>{t.unit}</span>
                  <select
                    value={unit}
                    onChange={(event) => {
                      setUnit(event.target.value as HarvestUnit)
                      setSaved(false)
                    }}
                  >
                    <option value="kg">{t.kg}</option>
                    <option value="quintal">{t.quintal}</option>
                  </select>
                  <small>{t.conversion}</small>
                </label>
              </div>

              <label>
                <span>{t.notes}</span>
                <input
                  maxLength={1000}
                  value={notes}
                  onChange={(event) => {
                    setNotes(event.target.value)
                    setSaved(false)
                  }}
                />
              </label>

              {saveError !== null && (
                <p className="error-message" role="alert">
                  {saveError || t.saveError}
                </p>
              )}

              {saved && <p role="status">{t.success}</p>}

              <button className="primary-button" type="submit">
                {saving ? t.saving : t.save}
              </button>
            </fieldset>
          </form>

          <h3 style={{ marginTop: '28px' }}>{t.history}</h3>

          {overview.records.length === 0 ? (
            <p>{t.empty}</p>
          ) : (
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                display: 'grid',
                gap: '12px',
              }}
            >
              {overview.records.map((record) => (
                <li
                  key={record.id}
                  style={{
                    padding: '16px',
                    border: '1px solid #e8dfc8',
                    borderRadius: '12px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <strong>{formatDate(record.harvest_date)}</strong>
                    <strong>
                      {formatQuantity(record.quantity_grams, 1000)}
                      {' '}{t.kg}
                    </strong>
                  </div>

                  {record.notes && (
                    <p
                      style={{
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {record.notes}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}