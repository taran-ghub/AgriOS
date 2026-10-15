import { type FormEvent, useEffect, useState } from 'react'

type Language = 'en' | 'hi'
type Unit = 'kg' | 'quintal'

type Sale = {
  id: number
  crop_cycle_id: number
  sale_date: string
  quantity_grams: number
  total_value_paise: number
  notes: string | null
  created_at: string
}

type Overview = {
  currency: 'INR'
  total_sold_grams: number
  total_sales_value_paise: number
  total_recorded_expenses_paise: number
  recorded_balance_paise: number
  total_harvested_grams: number
  harvest_minus_sales_grams: number
  sales_exceed_recorded_harvest: boolean
  record_count: number
  records: Sale[]
}

type Props = {
  cropCycleId: number
  language: Language
}

const copy = {
  en: {
    title: 'Sales and financial summary',
    intro: 'Record crop sales separately from harvest.',
    sales: 'Recorded sales value',
    expenses: 'Recorded expenses',
    balance: 'Recorded balance',
    notice:
      'Balance = recorded sales value − recorded expenses. This is not confirmed profit or cash received. Missing costs and unpaid sales are not accounted for.',
    harvested: 'Recorded harvest',
    sold: 'Recorded quantity sold',
    warning:
      'Quantity sold exceeds recorded harvest. Check whether harvest entries are missing or sales quantities are incorrect.',
    date: 'Sale date',
    quantity: 'Quantity sold',
    unit: 'Unit',
    kg: 'kg',
    quintal: 'quintal',
    value: 'Total sale value (₹)',
    valueHelp: 'Enter the value of the whole sale, not the price per kg.',
    notes: 'Notes (optional)',
    save: 'Save sale',
    saving: 'Saving…',
    loading: 'Loading sales…',
    history: 'Sales history',
    empty: 'No sales recorded yet.',
    retry: 'Try again',
    refresh: 'Refresh summary',
    loadError: 'Could not load the financial summary.',
    saveError: 'Could not save the sale.',
    success: 'Sale saved.',
    refreshError:
      'The sale was saved, but the summary could not be refreshed. Use Refresh summary; do not enter the sale again.',
  },
  hi: {
    title: 'बिक्री और खर्च का सारांश',
    intro: 'फसल की बिक्री को कटाई से अलग दर्ज करें।',
    sales: 'दर्ज बिक्री मूल्य',
    expenses: 'दर्ज खर्च',
    balance: 'दर्ज शेष राशि',
    notice:
      'शेष राशि = दर्ज बिक्री मूल्य − दर्ज खर्च। यह निश्चित मुनाफा या प्राप्त नकद नहीं है। छूटे खर्च और बकाया भुगतान इसमें शामिल नहीं हैं।',
    harvested: 'दर्ज उपज',
    sold: 'दर्ज बिक्री की मात्रा',
    warning:
      'बेची गई मात्रा दर्ज उपज से अधिक है। देखें कि कटाई के रिकॉर्ड छूटे तो नहीं या बिक्री की मात्रा गलत तो नहीं है।',
    date: 'बिक्री की तारीख',
    quantity: 'बेची गई मात्रा',
    unit: 'इकाई',
    kg: 'किलो',
    quintal: 'क्विंटल',
    value: 'कुल बिक्री मूल्य (₹)',
    valueHelp: 'पूरी बिक्री का मूल्य भरें, प्रति किलो कीमत नहीं।',
    notes: 'नोट्स (वैकल्पिक)',
    save: 'बिक्री सहेजें',
    saving: 'सहेजा जा रहा है…',
    loading: 'बिक्री लोड हो रही है…',
    history: 'बिक्री का विवरण',
    empty: 'अभी कोई बिक्री दर्ज नहीं है।',
    retry: 'फिर कोशिश करें',
    refresh: 'सारांश ताज़ा करें',
    loadError: 'बिक्री और खर्च का सारांश लोड नहीं हुआ।',
    saveError: 'बिक्री सहेजी नहीं गई।',
    success: 'बिक्री सहेजी गई।',
    refreshError:
      'बिक्री सहेज दी गई, लेकिन सारांश ताज़ा नहीं हुआ। सारांश ताज़ा करें; बिक्री दोबारा दर्ज न करें।',
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

async function salesRequest<T>(
  cropCycleId: number,
  options?: RequestInit,
): Promise<T> {
  const token = window.localStorage.getItem('agrios.accessToken')
  const base = import.meta.env.VITE_API_URL ?? ''

  const response = await fetch(
    `${base}/api/crop-cycles/${cropCycleId}/sales`,
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

        return 'Invalid sale data'
      })

      throw new Error(messages.join('; '))
    }

    throw new Error('')
  }

  return response.json() as Promise<T>
}

export default function SalesPanel({
  cropCycleId,
  language,
}: Props) {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [date, setDate] = useState(today)
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState<Unit>('kg')
  const [value, setValue] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [refreshFailed, setRefreshFailed] = useState(false)
  const [reload, setReload] = useState(0)

  const t = copy[language]
  const locale = language === 'hi' ? 'hi-IN' : 'en-IN'

  useEffect(() => {
    const controller = new AbortController()

    async function loadSales() {
      setLoading(true)
      setLoadFailed(false)

      try {
        const result = await salesRequest<Overview>(
          cropCycleId,
          { signal: controller.signal },
        )

        if (!controller.signal.aborted) {
          setOverview(result)
          setRefreshFailed(false)
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

    void loadSales()

    return () => controller.abort()
  }, [cropCycleId, reload])

  function money(paise: number): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(paise / 100)
  }

  function kilograms(grams: number): string {
    return new Intl.NumberFormat(locale, {
      maximumFractionDigits: 3,
    }).format(grams / 1000)
  }

  function formatDate(dateValue: string): string {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${dateValue}T00:00:00Z`))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!overview || saving) return

    setSaving(true)
    setSaveError(null)
    setSaved(false)
    setRefreshFailed(false)

    try {
      const sale = await salesRequest<Sale>(cropCycleId, {
        method: 'POST',
        body: JSON.stringify({
          sale_date: date,
          quantity,
          unit,
          total_value: value,
          notes: notes.trim() || null,
        }),
      })

      // Update from the confirmed saved record immediately.
      setOverview((current) => {
        if (!current) return current

        const totalSold = current.total_sold_grams + sale.quantity_grams
        const totalValue =
          current.total_sales_value_paise + sale.total_value_paise

        return {
          ...current,
          total_sold_grams: totalSold,
          total_sales_value_paise: totalValue,
          recorded_balance_paise:
            totalValue - current.total_recorded_expenses_paise,
          harvest_minus_sales_grams:
            current.total_harvested_grams - totalSold,
          sales_exceed_recorded_harvest:
            totalSold > current.total_harvested_grams,
          record_count: current.record_count + 1,
          records: [sale, ...current.records].sort(
            (a, b) =>
              b.sale_date.localeCompare(a.sale_date) || b.id - a.id,
          ),
        }
      })

      setQuantity('')
      setValue('')
      setNotes('')
      setSaved(true)

      // Refresh totals in case other records changed elsewhere.
      try {
        const latest = await salesRequest<Overview>(cropCycleId)
        setOverview(latest)
      } catch {
        setRefreshFailed(true)
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="form-card" style={{ marginTop: '20px' }}>
      <div className="card-heading">
        <div>
          <h2>{t.title}</h2>
          <p>{t.intro}</p>
        </div>
        <button
          className="text-button"
          type="button"
          disabled={loading || saving}
          onClick={() => setReload((current) => current + 1)}
        >
          {t.refresh}
        </button>
      </div>

      {loading ? (
        <p role="status">{t.loading}</p>
      ) : loadFailed || !overview ? (
        <div>
          <p className="error-message" role="alert">{t.loadError}</p>
          <button
            className="text-button"
            type="button"
            onClick={() => setReload((current) => current + 1)}
          >
            {t.retry}
          </button>
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            {[
              { label: t.sales, value: overview.total_sales_value_paise },
              {
                label: t.expenses,
                value: overview.total_recorded_expenses_paise,
              },
              { label: t.balance, value: overview.recorded_balance_paise },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  background: '#edf5ee',
                  color: '#183b24',
                }}
              >
                <span>{item.label}</span>
                <strong
                  style={{
                    display: 'block',
                    marginTop: '8px',
                    fontSize: '24px',
                  }}
                >
                  {money(item.value)}
                </strong>
              </div>
            ))}
          </div>

          <p>{t.notice}</p>
          <p>
            {t.harvested}: {kilograms(overview.total_harvested_grams)} {t.kg}
            {' · '}
            {t.sold}: {kilograms(overview.total_sold_grams)} {t.kg}
          </p>

          {overview.sales_exceed_recorded_harvest && (
            <p className="error-message" role="status">{t.warning}</p>
          )}

          {refreshFailed && (
            <p className="error-message" role="alert">{t.refreshError}</p>
          )}

          <form onSubmit={handleSubmit} style={{ marginTop: '24px' }}>
            <fieldset
              disabled={saving}
              style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
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
                      setUnit(event.target.value as Unit)
                      setSaved(false)
                    }}
                  >
                    <option value="kg">{t.kg}</option>
                    <option value="quintal">{t.quintal}</option>
                  </select>
                </label>
              </div>

              <label>
                <span>{t.value}</span>
                <input
                  required
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  max="10000000"
                  step="0.01"
                  value={value}
                  onChange={(event) => {
                    setValue(event.target.value)
                    setSaved(false)
                  }}
                />
                <small>{t.valueHelp}</small>
              </label>

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
              {overview.records.map((sale) => (
                <li
                  key={sale.id}
                  style={{
                    padding: '16px',
                    border: '1px solid #dce5dc',
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
                    <strong>{formatDate(sale.sale_date)}</strong>
                    <strong>{money(sale.total_value_paise)}</strong>
                  </div>

                  <p>{kilograms(sale.quantity_grams)} {t.kg}</p>

                  {sale.notes && (
                    <p
                      style={{
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {sale.notes}
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