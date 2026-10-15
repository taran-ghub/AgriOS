import { type FormEvent, useEffect, useState } from 'react'

type Method = 'flood' | 'furrow' | 'sprinkler' | 'drip' | 'other'
type RecordItem = { id: number; crop_cycle_id: number; irrigation_date: string; method: Method; notes: string | null; created_at: string }
type Props = { cropCycleId: number; language: 'en' | 'hi' }
const copy = {
  en: { title: 'Irrigation records', intro: 'Record irrigation carried out for this crop.', date: 'Irrigation date', method: 'Method', notes: 'Notes (optional)', save: 'Save irrigation', saving: 'Saving…', loading: 'Loading…', history: 'Recorded irrigation', empty: 'No irrigation recorded yet.', retry: 'Try again', failure: 'Could not load irrigation records.', saveError: 'Could not save irrigation.', success: 'Irrigation recorded.', methods: { flood: 'Flood', furrow: 'Furrow', sprinkler: 'Sprinkler', drip: 'Drip', other: 'Other' } },
  hi: { title: 'सिंचाई के रिकॉर्ड', intro: 'इस फसल में की गई सिंचाई दर्ज करें।', date: 'सिंचाई की तारीख', method: 'तरीका', notes: 'नोट्स (वैकल्पिक)', save: 'सिंचाई सहेजें', saving: 'सहेजा जा रहा है…', loading: 'लोड हो रहा है…', history: 'दर्ज की गई सिंचाई', empty: 'अभी कोई सिंचाई दर्ज नहीं है।', retry: 'फिर कोशिश करें', failure: 'सिंचाई रिकॉर्ड लोड नहीं हुए।', saveError: 'सिंचाई सहेजी नहीं गई।', success: 'सिंचाई दर्ज हो गई।', methods: { flood: 'बाढ़ सिंचाई', furrow: 'कूंड सिंचाई', sprinkler: 'फव्वारा', drip: 'टपक', other: 'अन्य' } },
}
function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function sortRecords(items: RecordItem[]) {
  return [...items].sort((a, b) => b.irrigation_date.localeCompare(a.irrigation_date) || b.id - a.id)
}
async function request<T>(id: number, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('agrios.accessToken')
  const response = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/crop-cycles/${id}/irrigation`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(typeof body?.detail === 'string' ? body.detail : '')
  }
  return response.json() as Promise<T>
}
export default function IrrigationPanel({ cropCycleId, language }: Props) {
  const t = copy[language]
  const [records, setRecords] = useState<RecordItem[]>([])
  const [date, setDate] = useState(today)
  const [method, setMethod] = useState<Method>('flood')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true)
      setFailed(false)
      try {
        const items = await request<RecordItem[]>(cropCycleId, { signal: controller.signal })
        if (!controller.signal.aborted) setRecords(sortRecords(items))
      } catch {
        if (!controller.signal.aborted) setFailed(true)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [cropCycleId, reload])
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const item = await request<RecordItem>(cropCycleId, { method: 'POST', body: JSON.stringify({ irrigation_date: date, method, notes: notes.trim() || null }) })
      setRecords((current) => sortRecords([item, ...current]))
      setNotes('')
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '')
    } finally { setSaving(false) }
  }
  function formatDate(value: string) {
    return new Intl.DateTimeFormat(language === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
  }
  return (
    <section className="form-card" style={{ marginTop: 28 }}>
      <div className="card-heading"><div><h2>{t.title}</h2><p>{t.intro}</p></div></div>
      {loading ? <p role="status">{t.loading}</p> : failed ? (
        <div><p className="error-message" role="alert">{t.failure}</p><button type="button" className="text-button" onClick={() => setReload((n) => n + 1)}>{t.retry}</button></div>
      ) : <>
        <form onSubmit={save}>
          <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <div className="form-row">
              <label><span>{t.date}</span><input required type="date" max={today()} value={date} onChange={(e) => { setDate(e.target.value); setSaved(false) }} /></label>
              <label><span>{t.method}</span><select value={method} onChange={(e) => { setMethod(e.target.value as Method); setSaved(false) }}>{(Object.keys(t.methods) as Method[]).map((m) => <option key={m} value={m}>{t.methods[m]}</option>)}</select></label>
            </div>
            <label><span>{t.notes}</span><input maxLength={1000} value={notes} onChange={(e) => { setNotes(e.target.value); setSaved(false) }} /></label>
            {error !== null && <p className="error-message" role="alert">{error || t.saveError}</p>}
            {saved && <p role="status">{t.success}</p>}
            <button type="submit" className="primary-button">{saving ? t.saving : t.save}</button>
          </fieldset>
        </form>
        <h3 style={{ marginTop: 28 }}>{t.history}</h3>
        {records.length === 0 ? <p>{t.empty}</p> : <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 12 }}>{records.map((item) => <li key={item.id} style={{ padding: 16, border: '1px solid #dce5dc', borderRadius: 12 }}><strong>{formatDate(item.irrigation_date)}</strong><p>{t.methods[item.method]}</p>{item.notes && <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.notes}</p>}</li>)}</ul>}
      </>}
    </section>
  )
}
