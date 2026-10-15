import { useState } from 'react'
import TodayPanel from './TodayPanel'
import IrrigationRecords from './IrrigationRecords'
import ExpensePanel from './ExpensePanel'
import HarvestPanel from './HarvestPanel'
import SalesPanel from './SalesPanel'

type Props = {
  cropCycleId: number
  language: 'en' | 'hi'
}

type Section =
  | 'today'
  | 'irrigation'
  | 'expenses'
  | 'harvest'
  | 'sales'

const labels = {
  en: {
    heading: 'Overview and crop records',
    reminder: 'Save your entry before switching sections.',
    today: 'Today',
    irrigation: 'Irrigation',
    expenses: 'Expenses',
    harvest: 'Harvest',
    sales: 'Sales',
    scope: 'These records belong to the crop plan selected above.',
  },
  hi: {
    heading: 'सारांश और फसल के रिकॉर्ड',
    reminder: 'दूसरा भाग खोलने से पहले अपनी जानकारी सहेजें।',
    today: 'आज',
    irrigation: 'सिंचाई',
    expenses: 'खर्च',
    harvest: 'कटाई',
    sales: 'बिक्री',
    scope: 'ये रिकॉर्ड ऊपर चुनी गई फसल योजना के हैं।',
  },
} as const

const sections: Section[] = [
  'today',
  'irrigation',
  'expenses',
  'harvest',
  'sales',
]

export default function IrrigationPanel({
  cropCycleId,
  language,
}: Props) {
  const [active, setActive] = useState<Section>('today')
  const t = labels[language]

  return (
    <section style={{ marginTop: '28px' }}>
      <h2>{t.heading}</h2>
      <p>{t.reminder}</p>

      <div
        role="group"
        aria-label={t.heading}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          marginTop: '16px',
        }}
      >
        {sections.map((section) => (
          <button
            key={section}
            type="button"
            aria-pressed={active === section}
            onClick={() => setActive(section)}
            style={{
              padding: '12px 20px',
              borderRadius: '10px',
              border: '1px solid #bfd0c0',
              background: active === section ? '#245b38' : '#ffffff',
              color: active === section ? '#ffffff' : '#245b38',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t[section]}
          </button>
        ))}
      </div>

      {active !== 'today' && <p>{t.scope}</p>}

      {active === 'today' && (
        <TodayPanel language={language} />
      )}

      {active === 'irrigation' && (
        <IrrigationRecords
          key={`irrigation-${cropCycleId}`}
          cropCycleId={cropCycleId}
          language={language}
        />
      )}

      {active === 'expenses' && (
        <ExpensePanel
          key={`expenses-${cropCycleId}`}
          cropCycleId={cropCycleId}
          language={language}
        />
      )}

      {active === 'harvest' && (
        <HarvestPanel
          key={`harvest-${cropCycleId}`}
          cropCycleId={cropCycleId}
          language={language}
        />
      )}

      {active === 'sales' && (
        <SalesPanel
          key={`sales-${cropCycleId}`}
          cropCycleId={cropCycleId}
          language={language}
        />
      )}
    </section>
  )
}