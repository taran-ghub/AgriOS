import { useEffect, useState } from 'react'

type Language = 'en' | 'hi'

type TodayTask = {
  id: number
  crop_cycle_id: number
  field_name: string
  crop: string
  title: string
  category: string
  due_date: string
  status: 'pending' | 'postponed'
  schedule_source: string
  schedule_version: string
}

type TaskGroup = {
  total_count: number
  tasks: TodayTask[]
}

type Overview = {
  on_date: string
  upcoming_through: string
  overdue: TaskGroup
  due_today: TaskGroup
  upcoming: TaskGroup
}

type Props = {
  language: Language
}

const copy = {
  en: {
    title: 'Today overview',
    intro: 'Unfinished tasks across all your saved crop plans.',
    overdue: 'Overdue',
    today: 'Due today',
    upcoming: 'Next 7 days',
    empty: 'No tasks in this group.',
    loading: 'Loading tasks…',
    error: 'Could not load your tasks.',
    retry: 'Try again',
    refresh: 'Refresh',
    sample:
      'Current crop calendars use development sample schedules, not agricultural advice.',
    help:
      'To complete or reschedule a task, choose its crop plan from the saved-plans dropdown above and use its calendar.',
    showing: 'Showing',
    of: 'of',
    more: 'Open the relevant crop calendar to see more tasks.',
    postponed: 'Rescheduled',
    through: 'Upcoming through',
    source: 'Schedule source',
  },
  hi: {
    title: 'आज का सारांश',
    intro: 'आपकी सभी सहेजी गई फसल योजनाओं के बाकी काम।',
    overdue: 'तारीख बीत चुकी है',
    today: 'आज के काम',
    upcoming: 'अगले 7 दिन',
    empty: 'इस समूह में कोई काम नहीं है।',
    loading: 'काम लोड हो रहे हैं…',
    error: 'आपके काम लोड नहीं हुए।',
    retry: 'फिर कोशिश करें',
    refresh: 'ताज़ा करें',
    sample:
      'मौजूदा फसल कैलेंडर विकास के लिए नमूना कार्यक्रम हैं, कृषि सलाह नहीं।',
    help:
      'काम पूरा करने या तारीख बदलने के लिए ऊपर सूची से उसकी फसल योजना चुनें और कैलेंडर का उपयोग करें।',
    showing: 'दिखाए गए',
    of: 'कुल',
    more: 'बाकी काम देखने के लिए संबंधित फसल कैलेंडर खोलें।',
    postponed: 'तारीख बदली गई',
    through: 'आगामी काम इस तारीख तक',
    source: 'कार्यक्रम का स्रोत',
  },
} as const

const hindiTaskLabels: Record<string, string> = {
  'Prepare the field': 'खेत तैयार करें',
  'Confirm seed and supplies': 'बीज और सामग्री की पुष्टि करें',
  'Record sowing': 'बुवाई दर्ज करें',
  'Review first irrigation': 'पहली सिंचाई की समीक्षा करें',
  'Check crop condition': 'फसल की स्थिति देखें',
  'Review second irrigation': 'दूसरी सिंचाई की समीक्षा करें',
  'Review crop nutrition': 'फसल पोषण की समीक्षा करें',
  'Check harvest readiness': 'कटाई की तैयारी देखें',
}

function localDate(): string {
  const now = new Date()

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

export default function TodayPanel({ language }: Props) {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [reload, setReload] = useState(0)

  const t = copy[language]

  useEffect(() => {
    const controller = new AbortController()

    async function loadOverview() {
      setLoading(true)
      setFailed(false)

      try {
        const base = import.meta.env.VITE_API_URL ?? ''
        const token = window.localStorage.getItem('agrios.accessToken')
        const query = new URLSearchParams({ on_date: localDate() })

        const response = await fetch(`${base}/api/today?${query}`, {
          signal: controller.signal,
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        })

        if (!response.ok) {
          throw new Error('Unable to load tasks')
        }

        const result = await response.json() as Overview

        if (!controller.signal.aborted) {
          setOverview(result)
        }
      } catch {
        if (!controller.signal.aborted) {
          setFailed(true)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadOverview()

    return () => controller.abort()
  }, [reload])

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

  function taskTitle(task: TodayTask): string {
    return language === 'hi'
      ? hindiTaskLabels[task.title] || task.title
      : task.title
  }

  const groups = overview
    ? [
        {
          key: 'overdue',
          title: t.overdue,
          group: overview.overdue,
          background: '#fff1ed',
          color: '#7b3020',
        },
        {
          key: 'today',
          title: t.today,
          group: overview.due_today,
          background: '#edf5ee',
          color: '#183b24',
        },
        {
          key: 'upcoming',
          title: t.upcoming,
          group: overview.upcoming,
          background: '#eef3fb',
          color: '#24476b',
        },
      ]
    : []

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
          disabled={loading}
          onClick={() => setReload((current) => current + 1)}
        >
          {t.refresh}
        </button>
      </div>

      {loading ? (
        <p role="status">{t.loading}</p>
      ) : failed || !overview ? (
        <div>
          <p className="error-message" role="alert">{t.error}</p>
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
          <p>
            <strong>{formatDate(overview.on_date)}</strong>
            {' · '}
            {t.through}: {formatDate(overview.upcoming_through)}
          </p>

          <aside className="sample-notice">
            <span className="notice-icon" aria-hidden="true">i</span>
            <p>{t.sample}</p>
          </aside>

          <p>{t.help}</p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '12px',
              margin: '20px 0',
            }}
          >
            {groups.map((item) => (
              <div
                key={item.key}
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  background: item.background,
                  color: item.color,
                }}
              >
                <span>{item.title}</span>
                <strong
                  style={{
                    display: 'block',
                    fontSize: '28px',
                    marginTop: '8px',
                  }}
                >
                  {item.group.total_count}
                </strong>
              </div>
            ))}
          </div>

          {groups.map((item) => (
            <section key={item.key} style={{ marginTop: '24px' }}>
              <h3>{item.title}</h3>

              {item.group.tasks.length === 0 ? (
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
                  {item.group.tasks.map((task) => (
                    <li
                      key={task.id}
                      style={{
                        padding: '16px',
                        border: '1px solid #dce5dc',
                        borderRadius: '12px',
                      }}
                    >
                      <small>
                        {task.field_name} · #{task.crop_cycle_id}
                      </small>

                      <h4 style={{ margin: '8px 0' }}>
                        {taskTitle(task)}
                      </h4>

                      <p style={{ margin: '8px 0' }}>
                        {formatDate(task.due_date)}
                        {task.status === 'postponed'
                          ? ` · ${t.postponed}`
                          : ''}
                      </p>

                      <small
                        style={{
                          display: 'block',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {t.source}: {task.schedule_source}
                        {' · '}{task.schedule_version}
                      </small>
                    </li>
                  ))}
                </ul>
              )}

              {item.group.total_count > item.group.tasks.length && (
                <p>
                  {t.showing} {item.group.tasks.length}
                  {' · '}{t.of} {item.group.total_count}. {t.more}
                </p>
              )}
            </section>
          ))}
        </>
      )}
    </section>
  )
}