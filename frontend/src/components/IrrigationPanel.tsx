import IrrigationRecords from './IrrigationRecords'
import ExpensePanel from './ExpensePanel'

type Props = {
  cropCycleId: number
  language: 'en' | 'hi'
}

export default function IrrigationPanel({
  cropCycleId,
  language,
}: Props) {
  return (
    <>
      <IrrigationRecords
        key={`irrigation-${cropCycleId}`}
        cropCycleId={cropCycleId}
        language={language}
      />

      <ExpensePanel
        key={`expenses-${cropCycleId}`}
        cropCycleId={cropCycleId}
        language={language}
      />
    </>
  )
}