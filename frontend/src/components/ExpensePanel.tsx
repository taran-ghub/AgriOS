import { type FormEvent, useEffect, useState } from 'react'

type Language = 'en' | 'hi'

type Category =
  | 'seeds'
  | 'fertiliser'
  | 'crop_protection'
  | 'irrigation'
  | 'labour'
  | 'machinery'
  | 'transport'
  | 'other'

type Expense = {
  id: number
  crop_cycle_id: number
  expense_date: string
  category: Category
  amount_paise: number
  notes: string | null
  created_at: string
}

type Overview = {
  currency: 'INR'
  total_recorded_paise: number
  record_count: number
  records: Expense[]
}

type Props = {
  cropCycleId: number
  language: Language
}

const copy = {
  en: {
    title: 'Crop expenses',
    intro: 'Keep track of money spent on this crop.',
    total: 'Total recorded spending',
    notice: 'Only expenses entered here are included.',
    date: 'Expense date',
    category: 'Category',
    amount: 'Amount (₹)',
    notes: 'Notes (optional)',
    save: 'Save expense',
    saving: 'Saving…',
    loading: 'Loading expenses…',
    history: 'Expense history',
    empty: 'No expenses recorded yet.',
    retry: 'Try again',
    loadError: 'Could not load expenses.',
    saveError: 'Could not save the expense. Please try again.',
    success: 'Expense saved.',
    categories: {
      seeds: 'Seeds',
      fertiliser: 'Fertiliser',
      crop_protection: 'Crop protection',
      irrigation: 'Irrigation',
      labour: 'Labour',
      machinery: 'Machinery',
      transport: 'Transport',
      other: 'Other',
    },
  },
  hi: {
    title: 'फसल के खर्च',
    intro: 'इस फसल पर हुए खर्च का रिकॉर्ड रखें।',
    total: 'कुल दर्ज खर्च',
    notice: 'केवल यहां दर्ज किए गए खर्च शामिल हैं।',
    date: 'खर्च की तारीख',
    category: 'श्रेणी',
    amount: 'राशि (₹)',
    notes: 'नोट्स (वैकल्पिक)',
    save: 'खर्च सहेजें',
    saving: 'सहेजा जा रहा है…',
    loading: 'खर्च लोड हो रहे हैं…',
    history: 'खर्च का विवरण',
    empty: 'अभी कोई खर्च दर्ज नहीं है।',
    retry: 'फिर कोशिश करें',
    loadError: 'खर्च लोड नहीं हुए।',
    saveError: 'खर्च सहेजा नहीं गया। फिर कोशिश करें।',
    success: 'खर्च सहेजा गया।',
    categories: {
      seeds: 'बीज',
      fertiliser: 'खाद',
      crop_protection: 'फसल सुरक्षा',
      irrigation: 'सिंचाई',
      labour: 'मजदूरी',
      machinery: 'मशीनरी',
      transport: 'ढुलाई',
      other: 'अन्य',
    },
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

function sortExpenses(records: Expense[]): Expense[] {
  return [...records].sort(
    (a, b) =>
      b.expense_date.localeCompare(a.expense_date) || b.id - a.id,
  )
}

async function expenseRequest<T>(
  cropCycleId: number,
  options?: RequestInit,
): Promise<T> {
  const base = import.meta.env.VITE_API_URL ?? ''
  const token = window.localStorage.getItem('agrios.accessToken')

  const response = await fetch(
    `${base}/api/crop-cycles/${cropCycleId}/expenses`,
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

        return 'Invalid expense data'
      })

      throw new Error(messages.join('; '))
    }

    throw new Error('')
  }

  return response.json() as Promise<T>
}

export default function ExpensePanel({
  cropCycleId,
  language,
}: Props) {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [date, setDate] = useState(today)
  const [category, setCategory] = useState<Category>('seeds')
  const [amount, setAmount] = useState('')
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

    async function loadExpenses() {
      setLoading(true)
      setLoadFailed(false)

      try {
        const result = await expenseRequest<Overview>(
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

    void loadExpenses()

    return () => controller.abort()
  }, [cropCycleId, reload])

  function formatMoney(paise: number): string {
    return new Intl.NumberFormat(
      language === 'hi' ? 'hi-IN' : 'en-IN',
      {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
    ).format(paise / 100)
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
      const expense = await expenseRequest<Expense>(
        cropCycleId,
        {
          method: 'POST',
          body: JSON.stringify({
            expense_date: date,
            category,
            // Send the decimal text directly for backend validation.
            amount,
            notes: notes.trim() || null,
          }),
        },
      )

      setOverview((current) => {
        if (!current) return current

        return {
          ...current,
          total_recorded_paise:
            current.total_recorded_paise + expense.amount_paise,
          record_count: current.record_count + 1,
          records: sortExpenses([expense, ...current.records]),
        }
      })

      setAmount('')
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
              background: '#edf5ee',
              color: '#183b24',
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
              {formatMoney(overview.total_recorded_paise)}
            </strong>

            <p>{t.notice}</p>
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
              <div className="form-row">
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

                <label>
                  <span>{t.category}</span>
                  <select
                    value={category}
                    onChange={(event) => {
                      setCategory(event.target.value as Category)
                      setSaved(false)
                    }}
                  >
                    {(Object.keys(t.categories) as Category[]).map(
                      (item) => (
                        <option key={item} value={item}>
                          {t.categories[item]}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>

              <label>
                <span>{t.amount}</span>
                <input
                  required
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  max="10000000"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value)
                    setSaved(false)
                  }}
                />
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
              {overview.records.map((expense) => (
                <li
                  key={expense.id}
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
                    <strong>{t.categories[expense.category]}</strong>
                    <strong>{formatMoney(expense.amount_paise)}</strong>
                  </div>

                  <p>{formatDate(expense.expense_date)}</p>

                  {expense.notes && (
                    <p
                      style={{
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {expense.notes}
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