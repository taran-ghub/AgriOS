import { type FormEvent, useEffect, useMemo, useState } from 'react'
import {
  clearStoredSession,
  createCropCycle,
  listCropCycles,
  getCurrentUser,
  hasStoredSession,
  loginAccount,
  logoutAccount,
  registerAccount,
  updateFarmTask,
} from './services/api'
import type { AreaUnit, AuthInput, CropCycle, CropCycleInput, FarmTask, TaskStatus, User } from './types'
import IrrigationPanel from './components/IrrigationPanel'
import './App.css'

type Language = 'en' | 'hi'
type AuthMode = 'register' | 'login'

const copy = {
  en: {
    language: 'Language', eyebrow: 'Your season, organised', title: 'Plan your wheat crop in a few simple steps.',
    intro: 'Add one field and a sowing date. AgriOS will prepare a calendar you can adjust as the season changes.',
    fieldDetails: 'Field details', fieldHelp: 'You can change task dates after setup.', fieldName: 'Field name',
    fieldPlaceholder: 'e.g. North field', location: 'Approximate location', locationPlaceholder: 'e.g. Karnal, Haryana',
    optional: 'Optional', area: 'Field size', sowingDate: 'Sowing date', create: 'Create crop plan',
    creating: 'Creating your plan…', sample: 'Sample schedule', sampleNote: 'For product development only — not agricultural advice.',
    calendar: 'Crop calendar', wheat: 'Wheat', tasksDone: 'tasks completed', nextTask: 'Next task', complete: 'Complete',
    undo: 'Mark pending', skip: 'Skip', dueDate: 'Task date', startOver: 'Set up another field', saved: 'Saved',
    retry: 'Please check that the AgriOS API is running, then try again.', empty: 'All current tasks are complete.',
    accountTitle: 'Your farm plans, kept private.', accountIntro: 'Create an account to save your fields and keep every record tied to you.',
    createAccount: 'Create account', signIn: 'Sign in', name: 'Your name', email: 'Email address', password: 'Password',
    passwordHelp: 'Use at least 8 characters.', haveAccount: 'Already have an account?', newAccount: 'New to AgriOS?',
    signingIn: 'Signing in…', signingUp: 'Creating account…', signOut: 'Sign out', privacy: 'Your farm records are private to this account.',
  },
  hi: {
    language: 'भाषा', eyebrow: 'आपका मौसम, व्यवस्थित', title: 'गेहूं की फसल की योजना आसान चरणों में बनाएं।',
    intro: 'एक खेत और बुवाई की तारीख जोड़ें। मौसम के साथ बदलने वाला कैलेंडर तैयार हो जाएगा।',
    fieldDetails: 'खेत की जानकारी', fieldHelp: 'सेटअप के बाद काम की तारीख बदली जा सकती है।', fieldName: 'खेत का नाम',
    fieldPlaceholder: 'जैसे उत्तर वाला खेत', location: 'लगभग स्थान', locationPlaceholder: 'जैसे करनाल, हरियाणा',
    optional: 'वैकल्पिक', area: 'खेत का आकार', sowingDate: 'बुवाई की तारीख', create: 'फसल योजना बनाएं',
    creating: 'योजना बन रही है…', sample: 'नमूना कार्यक्रम', sampleNote: 'केवल उत्पाद विकास के लिए — कृषि सलाह नहीं।',
    calendar: 'फसल कैलेंडर', wheat: 'गेहूं', tasksDone: 'काम पूरे', nextTask: 'अगला काम', complete: 'पूरा करें',
    undo: 'बाकी रखें', skip: 'छोड़ें', dueDate: 'काम की तारीख', startOver: 'दूसरा खेत जोड़ें', saved: 'सहेजा गया',
    retry: 'AgriOS API चालू है या नहीं जांचें, फिर दोबारा कोशिश करें।', empty: 'सभी मौजूदा काम पूरे हो गए हैं।',
    accountTitle: 'आपकी खेत योजनाएं, निजी और सुरक्षित।', accountIntro: 'खेत सहेजने और रिकॉर्ड अपने खाते से जोड़ने के लिए खाता बनाएं।',
    createAccount: 'खाता बनाएं', signIn: 'साइन इन करें', name: 'आपका नाम', email: 'ईमेल पता', password: 'पासवर्ड',
    passwordHelp: 'कम से कम 8 अक्षर रखें।', haveAccount: 'पहले से खाता है?', newAccount: 'AgriOS पर नए हैं?',
    signingIn: 'साइन इन हो रहा है…', signingUp: 'खाता बन रहा है…', signOut: 'साइन आउट', privacy: 'आपके खेत के रिकॉर्ड इस खाते तक निजी हैं।',
  },
} as const

const categoryLabels: Record<Language, Record<string, string>> = {
  en: { preparation: 'Preparation', sowing: 'Sowing', irrigation: 'Irrigation', monitoring: 'Monitoring', nutrition: 'Nutrition', harvest: 'Harvest' },
  hi: { preparation: 'तैयारी', sowing: 'बुवाई', irrigation: 'सिंचाई', monitoring: 'निरीक्षण', nutrition: 'पोषण', harvest: 'कटाई' },
}

const taskLabels: Record<Language, Record<string, string>> = {
  en: {},
  hi: {
    'Prepare the field': 'खेत तैयार करें', 'Confirm seed and supplies': 'बीज और सामग्री की पुष्टि करें',
    'Record sowing': 'बुवाई दर्ज करें', 'Review first irrigation': 'पहली सिंचाई की समीक्षा करें',
    'Check crop condition': 'फसल की स्थिति देखें', 'Review second irrigation': 'दूसरी सिंचाई की समीक्षा करें',
    'Review crop nutrition': 'फसल पोषण की समीक्षा करें', 'Check harvest readiness': 'कटाई की तैयारी देखें',
  },
}

const initialForm: CropCycleInput = {
  field_name: '', area: 1, area_unit: 'acres', location: '', sowing_date: new Date().toISOString().slice(0, 10),
}

function formatDate(value: string, language: Language) {
  return new Intl.DateTimeFormat(language === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

function App() {
  const [language, setLanguage] = useState<Language>('en')
  const [user, setUser] = useState<User | null>(null)
  const [authMode, setAuthMode] = useState<AuthMode>('register')
  const [authForm, setAuthForm] = useState<AuthInput>({ name: '', email: '', password: '' })
  const [form, setForm] = useState<CropCycleInput>(initialForm)
  const [cycles, setCycles] = useState<CropCycle[]>([])
  const [cycle, setCycle] = useState<CropCycle | null>(null)
  const [loading, setLoading] = useState(hasStoredSession)
  const [error, setError] = useState('')
  const [savingTask, setSavingTask] = useState<number | null>(null)
  const t = copy[language]

  useEffect(() => {
    if (!hasStoredSession()) return

    getCurrentUser()
      .then(async (currentUser) => {
        setUser(currentUser)
        const plans = await listCropCycles()
        setCycles(plans)
        setCycle(plans[0] ?? null)
      })
      .catch(() => { setError('Could not restore your session or load plans. Please sign in again.'); setUser(null); clearStoredSession() })
      .finally(() => setLoading(false))
  }, [])

  const completedCount = cycle?.tasks.filter((task) => task.status === 'completed').length ?? 0
  const nextTask = useMemo(
    () => cycle?.tasks.find((task) => task.status === 'pending' || task.status === 'postponed'), [cycle],
  )

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = authMode === 'register'
        ? await registerAccount(authForm)
        : await loginAccount(authForm)
      setUser(response.user)
      const plans = await listCropCycles()
      setCycles(plans)
      setCycle(plans[0] ?? null)
      setAuthForm({ name: '', email: '', password: '' })
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t.retry)
    } finally { setLoading(false) }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const created = await createCropCycle(form)
      setCycle(created)
      setCycles((current) => [created, ...current])

    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t.retry)
    } finally { setLoading(false) }
  }

  async function changeTask(task: FarmTask, changes: { status?: TaskStatus; due_date?: string }) {
    setSavingTask(task.id)
    setError('')
    try {
      const updated = await updateFarmTask(task.id, changes)
      const updateCycle = (item: CropCycle): CropCycle => ({
        ...item,
        tasks: item.tasks.map((existing) => existing.id === updated.id ? updated : existing)
          .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.id - b.id),
      })
      setCycle((current) => current ? updateCycle(current) : current)
      setCycles((current) => current.map(updateCycle))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t.retry)
    } finally { setSavingTask(null) }
  }

  function resetSetup() {

    setCycle(null)
    setForm(initialForm)
    setError('')
  }

  async function handleLogout() {
    setLoading(true)
    await logoutAccount().catch(() => undefined)
    setUser(null)
    setCycles([])
    setCycle(null)
    setError('')
    setLoading(false)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="AgriOS home"><span className="brand-mark" aria-hidden="true">A</span><span>AgriOS</span></a>
        <div className="topbar-actions">
          {user && <div className="account-chip"><span>{user.name.charAt(0).toUpperCase()}</span><div><strong>{user.name}</strong><button type="button" onClick={handleLogout} disabled={loading}>{t.signOut}</button></div></div>}
          <div className="language-switcher" aria-label={t.language}>
            <button className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')} type="button">EN</button>
            <button className={language === 'hi' ? 'active' : ''} onClick={() => setLanguage('hi')} type="button">हिं</button>
          </div>
        </div>
      </header>

      <main id="top">
        {user && (
          <section className="form-card" style={{ marginBottom: 24 }}>
            <h2>{language === 'hi' ? 'आपकी फसल योजनाएं' : 'Your saved crop plans'}</h2>
            <label>
              <span>{language === 'hi' ? 'योजना चुनें' : 'Choose a crop plan'}</span>
              <select value={cycle?.id ?? ''} disabled={loading || savingTask !== null}
                onChange={(event) => { setCycle(cycles.find((item) => item.id === Number(event.target.value)) ?? null); setError('') }}>
                <option value="">{language === 'hi' ? 'नई योजना बनाएं' : 'Create a new plan'}</option>
                {cycles.map((item) => <option key={item.id} value={item.id}>{item.field.name} · {formatDate(item.sowing_date, language)}</option>)}
              </select>
            </label>
          </section>
        )}
        {!user ? (
          <div className="setup-layout auth-layout">
            <section className="welcome-panel">
              <p className="eyebrow">AgriOS</p><h1>{t.accountTitle}</h1><p className="intro">{t.accountIntro}</p>
              <div className="privacy-note"><span aria-hidden="true">✓</span>{t.privacy}</div>
            </section>
            <section className="form-card" aria-labelledby="account-heading">
              <div className="auth-tabs" role="tablist" aria-label="Account access">
                <button className={authMode === 'register' ? 'active' : ''} onClick={() => { setAuthMode('register'); setError('') }} role="tab" aria-selected={authMode === 'register'} type="button">{t.createAccount}</button>
                <button className={authMode === 'login' ? 'active' : ''} onClick={() => { setAuthMode('login'); setError('') }} role="tab" aria-selected={authMode === 'login'} type="button">{t.signIn}</button>
              </div>
              <div className="card-heading auth-heading"><div><h2 id="account-heading">{authMode === 'register' ? t.createAccount : t.signIn}</h2><p>{authMode === 'register' ? t.newAccount : t.haveAccount}</p></div></div>
              <form onSubmit={handleAuth}>
                {authMode === 'register' && <label><span>{t.name}</span><input required minLength={2} maxLength={80} autoComplete="name" value={authForm.name} onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })} /></label>}
                <label><span>{t.email}</span><input required type="email" maxLength={254} autoComplete="email" value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} /></label>
                <label><span>{t.password}</span><input required type="password" minLength={8} maxLength={128} autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} /><small>{t.passwordHelp}</small></label>
                {error && <p className="error-message" role="alert">{error}</p>}
                <button className="primary-button" disabled={loading} type="submit"><span>{loading ? (authMode === 'register' ? t.signingUp : t.signingIn) : (authMode === 'register' ? t.createAccount : t.signIn)}</span><span aria-hidden="true">→</span></button>
              </form>
            </section>
          </div>
        ) : !cycle ? (
          <div className="setup-layout">
            <section className="welcome-panel">
              <p className="eyebrow">{t.eyebrow}</p><h1>{t.title}</h1><p className="intro">{t.intro}</p>
              <div className="season-visual" aria-hidden="true"><span className="sun" /><span className="field-line field-line-one" /><span className="field-line field-line-two" /><span className="sprout">⌁</span></div>
            </section>

            <section className="form-card" aria-labelledby="field-heading">
              <div className="card-heading"><div><h2 id="field-heading">{t.fieldDetails}</h2><p>{t.fieldHelp}</p></div><span className="step-pill">1 / 1</span></div>
              <form onSubmit={handleCreate}>
                <label><span>{t.fieldName}</span><input required maxLength={80} value={form.field_name} placeholder={t.fieldPlaceholder} onChange={(event) => setForm({ ...form, field_name: event.target.value })} /></label>
                <label><span>{t.location} <small>{t.optional}</small></span><input maxLength={120} value={form.location} placeholder={t.locationPlaceholder} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label>
                <div className="form-row">
                  <label><span>{t.area}</span><div className="joined-input">
                    <input required min="0.01" step="0.01" type="number" value={form.area} onChange={(event) => setForm({ ...form, area: Number(event.target.value) })} />
                    <select aria-label="Area unit" value={form.area_unit} onChange={(event) => setForm({ ...form, area_unit: event.target.value as AreaUnit })}><option value="acres">Acres</option><option value="kanal">Kanal</option></select>
                  </div></label>
                  <label><span>{t.sowingDate}</span><input required type="date" value={form.sowing_date} onChange={(event) => setForm({ ...form, sowing_date: event.target.value })} /></label>
                </div>
                {error && <p className="error-message" role="alert">{error} {t.retry}</p>}
                <button className="primary-button" disabled={loading} type="submit"><span>{loading ? t.creating : t.create}</span><span aria-hidden="true">→</span></button>
              </form>
            </section>
          </div>
        ) : (
          <div className="calendar-layout">
            <section className="calendar-hero">
              <div><p className="eyebrow">{cycle.field.location || t.eyebrow}</p><h1>{cycle.field.name}</h1><p className="field-meta">{cycle.field.area} {cycle.field.area_unit} · {t.wheat} · {formatDate(cycle.sowing_date, language)}</p></div>
              <button className="text-button" type="button" disabled={savingTask !== null} onClick={resetSetup}>{t.startOver}</button>
            </section>
            <aside className="sample-notice"><span className="notice-icon" aria-hidden="true">i</span><div><strong>{t.sample}</strong><p>{t.sampleNote}</p></div></aside>
            <section className="summary-grid" aria-label="Crop summary">
              <article><span className="summary-label">{t.tasksDone}</span><strong>{completedCount} / {cycle.tasks.length}</strong><div className="progress"><span style={{ width: `${(completedCount / cycle.tasks.length) * 100}%` }} /></div></article>
              <article><span className="summary-label">{t.nextTask}</span><strong>{nextTask ? (taskLabels[language][nextTask.title] || nextTask.title) : t.empty}</strong>{nextTask && <span className="summary-date">{formatDate(nextTask.due_date, language)}</span>}</article>
            </section>
            <section className="task-section" aria-labelledby="calendar-heading">
              <div className="section-heading"><div><p className="eyebrow">{t.wheat}</p><h2 id="calendar-heading">{t.calendar}</h2></div><span className="saved-state"><span />{t.saved}</span></div>
              {error && <p className="error-message" role="alert">{error}</p>}
              <div className="task-list">
                {cycle.tasks.map((task, index) => (
                  <article className={`task-card ${task.status}`} key={task.id}>
                    <button className="task-check" aria-label={task.status === 'completed' ? t.undo : t.complete} disabled={savingTask !== null} onClick={() => changeTask(task, { status: task.status === 'completed' ? 'pending' : 'completed' })} type="button">{task.status === 'completed' ? '✓' : index + 1}</button>
                    <div className="task-content"><span className="category">{categoryLabels[language][task.category] || task.category}</span><h3>{taskLabels[language][task.title] || task.title}</h3>
                      <label className="date-editor"><span>{t.dueDate}</span><input type="date" value={task.due_date} disabled={savingTask !== null} onChange={(event) => { if (event.target.value) void changeTask(task, { due_date: event.target.value, status: task.status === 'completed' || task.status === 'skipped' ? task.status : 'postponed' }) }} /></label>
                    </div>
                    <div className="task-actions">
                      <button className="complete-button" disabled={savingTask !== null} onClick={() => changeTask(task, { status: task.status === 'completed' ? 'pending' : 'completed' })} type="button">{task.status === 'completed' ? t.undo : t.complete}</button>
                      <button className="skip-button" disabled={savingTask !== null} onClick={() => changeTask(task, { status: 'skipped' })} type="button">{t.skip}</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
            <IrrigationPanel key={cycle.id} cropCycleId={cycle.id} language={language} />
          </div>
        )}
      </main>
      <footer>AgriOS · {language === 'hi' ? 'किसान के दिन को आसान बनाएं' : "Make the farmer's day simpler"}</footer>
    </div>
  )
}

export default App
