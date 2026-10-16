import { useEffect, useState } from 'react'

type Language = 'en' | 'hi'
type RecordType = 'irrigation' | 'expenses' | 'harvests' | 'sales'

type RecordItem = {
  id: number
  crop_cycle_id: number
  irrigation_date?: string
  expense_date?: string
  harvest_date?: string
  sale_date?: string
  method?: string
  category?: string
  amount_paise?: number
  quantity_grams?: number
  total_value_paise?: number
  notes: string | null
}

type Props = {
  cropCycleId: number
  language: Language
}

const copy = {
  en: {
    title: 'Manage records',
    intro: 'Review and remove incorrect entries from this crop plan.',
    type: 'Record type',
    irrigation: 'Irrigation',
    expenses: 'Expenses',
    harvests: 'Harvest',
    sales: 'Sales',
    loading: 'Loading records…',
    empty: 'No records in this category.',
    loadError: 'Could not load records.',
    retry: 'Try again',
    refresh: 'Refresh',
    remove: 'Delete',
    deleting: 'Deleting…',
    cancel: 'Cancel',
    confirm: 'Delete permanently',
    question: 'Delete this record?',
    warning:
      'This cannot be undone. Related totals will change when reloaded.',
    deleted: 'Record deleted.',
    deleteError: 'Could not delete the record. Please try again.',
    totals:
      'After deleting, open the relevant record tab or Sales to see updated totals.',
    kg: 'kg',
    number: 'Record',
  },
  hi: {
    title: 'रिकॉर्ड प्रबंधन',
    intro: 'इस फसल योजना की गलत प्रविष्टियां देखें और हटाएं।',
    type: 'रिकॉर्ड का प्रकार',
    irrigation: 'सिंचाई',
    expenses: 'खर्च',
    harvests: 'कटाई',
    sales: 'बिक्री',
    loading: 'रिकॉर्ड लोड हो रहे हैं…',
    empty: 'इस श्रेणी में कोई रिकॉर्ड नहीं है।',
    loadError: 'रिकॉर्ड लोड नहीं हुए।',
    retry: 'फिर कोशिश करें',
    refresh: 'ताज़ा करें',
    remove: 'हटाएं',
    deleting: 'हटाया जा रहा है…',
    cancel: 'रद्द करें',
    confirm: 'स्थायी रूप से हटाएं',
    question: 'यह रिकॉर्ड हटाएं?',
    warning:
      'इसे वापस नहीं लाया जा सकेगा। दोबारा लोड करने पर संबंधित कुल बदल जाएंगे।',
    deleted: 'रिकॉर्ड हटा दिया गया।',
    deleteError: 'रिकॉर्ड हटाया नहीं गया। फिर कोशिश करें।',
    totals:
      'हटाने के बाद नए कुल देखने के लिए संबंधित रिकॉर्ड या बिक्री वाला भाग खोलें।',
    kg: 'किलो',
    number: 'रिकॉर्ड',
  },
} as const

const hindiLabels: Record<string, string> = {
  flood: 'बाढ़ सिंचाई',
  furrow: 'कूंड सिंचाई',
  sprinkler: 'फव्वारा',
  drip: 'टपक',
  other: 'अन्य',
  seeds: 'बीज',
  fertiliser: 'खाद',
  crop_protection: 'फसल सुरक्षा',
  irrigation: 'सिंचाई',
  labour: 'मजदूरी',
  machinery: 'मशीनरी',
  transport: 'ढुलाई',
}

async function recordRequest(
  path: string,
  options?: RequestInit,
): Promise<Response> {
  const token = window.localStorage.getItem('agrios.accessToken')
  const base = import.meta.env.VITE_API_URL ?? ''

  const response = await fetch(`${base}/api${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  if (!response.ok) {
    throw new Error('Record request failed')
  }

  return response
}

export default function ManageRecordsPanel({
  cropCycleId,
  language,
}: Props) {
  const [recordType, setRecordType] = useState<RecordType>('expenses')
  const [records, setRecords] = useState<RecordItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [reload, setReload] = useState(0)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deleteFailed, setDeleteFailed] = useState(false)
  const [deleted, setDeleted] = useState(false)

  const t = copy[language]
  const locale = language === 'hi' ? 'hi-IN' : 'en-IN'

  useEffect(() => {
    const controller = new AbortController()

    async function loadRecords() {
      setLoading(true)
      setLoadFailed(false)
      setConfirmId(null)
      setDeleteFailed(false)
      setDeleted(false)

      try {
        const response = await recordRequest(
          `/crop-cycles/${cropCycleId}/${recordType}`,
          { signal: controller.signal },
        )

        const data = await response.json()
        const items: RecordItem[] =
          recordType === 'irrigation' ? data : data.records

        if (!Array.isArray(items)) {
          throw new Error('Unexpected record response')
        }

        if (!controller.signal.aborted) {
          setRecords(items)
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

    void loadRecords()

    return () => controller.abort()
  }, [cropCycleId, recordType, reload])

  function recordDate(record: RecordItem): string {
    const value =
      record.irrigation_date
      ?? record.expense_date
      ?? record.harvest_date
      ?? record.sale_date

    if (!value) return '—'

    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${value}T00:00:00Z`))
  }

  function money(paise: number): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(paise / 100)
  }

  function quantity(grams: number): string {
    return new Intl.NumberFormat(locale, {
      maximumFractionDigits: 3,
    }).format(grams / 1000)
  }

  function label(value: string): string {
    if (language === 'hi') return hindiLabels[value] || value

    const text = value.replaceAll('_', ' ')
    return text.charAt(0).toUpperCase() + text.slice(1)
  }

  async function deleteRecord(record: RecordItem) {
    if (deletingId !== null) return

    setDeletingId(record.id)
    setDeleteFailed(false)
    setDeleted(false)

    try {
      await recordRequest(
        `/crop-cycles/${cropCycleId}/records/${recordType}/${record.id}`,
        { method: 'DELETE' },
      )

      setRecords((current) =>
        current.filter((item) => item.id !== record.id),
      )

      setConfirmId(null)
      setDeleted(true)
    } catch {
      setDeleteFailed(true)
    } finally {
      setDeletingId(null)
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
          disabled={loading || deletingId !== null}
          onClick={() => setReload((current) => current + 1)}
        >
          {t.refresh}
        </button>
      </div>

      <label>
        <span>{t.type}</span>
        <select
          value={recordType}
          disabled={deletingId !== null}
          onChange={(event) => {
            setRecordType(event.target.value as RecordType)
            setLoading(true)
            setConfirmId(null)
            setDeleteFailed(false)
            setDeleted(false)
          }}
        >
          <option value="irrigation">{t.irrigation}</option>
          <option value="expenses">{t.expenses}</option>
          <option value="harvests">{t.harvests}</option>
          <option value="sales">{t.sales}</option>
        </select>
      </label>

      <p>{t.totals}</p>

      {deleted && <p role="status">{t.deleted}</p>}

      {loading ? (
        <p role="status">{t.loading}</p>
      ) : loadFailed ? (
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
      ) : records.length === 0 ? (
        <p>{t.empty}</p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            display: 'grid',
            gap: '14px',
          }}
        >
          {records.map((record) => (
            <li
              key={record.id}
              style={{
                padding: '18px',
                border: '1px solid #dce5dc',
                borderRadius: '12px',
              }}
            >
              <small>{t.number} #{record.id}</small>
              <h3 style={{ margin: '8px 0' }}>{recordDate(record)}</h3>

              {record.category && <p>{label(record.category)}</p>}
              {record.method && <p>{label(record.method)}</p>}

              {record.amount_paise !== undefined && (
                <p><strong>{money(record.amount_paise)}</strong></p>
              )}

              {record.quantity_grams !== undefined && (
                <p>{quantity(record.quantity_grams)} {t.kg}</p>
              )}

              {record.total_value_paise !== undefined && (
                <p><strong>{money(record.total_value_paise)}</strong></p>
              )}

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

              {confirmId === record.id ? (
                <div
                  style={{
                    marginTop: '16px',
                    padding: '14px',
                    borderRadius: '10px',
                    background: '#fff1ed',
                    color: '#7b3020',
                  }}
                >
                  <strong>{t.question}</strong>
                  <p>{t.warning}</p>

                  {deleteFailed && (
                    <p role="alert">{t.deleteError}</p>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '12px',
                    }}
                  >
                    <button
                      type="button"
                      disabled={deletingId !== null}
                      onClick={() => void deleteRecord(record)}
                      style={{
                        padding: '10px 16px',
                        border: 0,
                        borderRadius: '8px',
                        background: '#a52c23',
                        color: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      {deletingId === record.id ? t.deleting : t.confirm}
                    </button>

                    <button
                      className="text-button"
                      type="button"
                      disabled={deletingId !== null}
                      onClick={() => {
                        setConfirmId(null)
                        setDeleteFailed(false)
                      }}
                    >
                      {t.cancel}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="text-button"
                  type="button"
                  disabled={deletingId !== null}
                  onClick={() => {
                    setConfirmId(record.id)
                    setDeleteFailed(false)
                    setDeleted(false)
                  }}
                  style={{ color: '#a52c23' }}
                >
                  {t.remove}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}