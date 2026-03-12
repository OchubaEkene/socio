import { useState } from 'react'
import { cn } from '@/lib/utils'
import Absences from './Absences'
import Vacations from './Vacations'

const TABS = [
  { id: 'absences', label: 'Absences' },
  { id: 'vacations', label: 'Vacations' },
] as const

type Tab = typeof TABS[number]['id']

export default function TimeOff() {
  const [tab, setTab] = useState<Tab>('absences')

  return (
    <div className="space-y-0">
      {/* Tab bar */}
      <div className="border-b flex gap-0">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-6 py-3 text-sm font-medium border-b-2 transition-colors',
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="pt-4">
        {tab === 'absences' ? <Absences /> : <Vacations />}
      </div>
    </div>
  )
}
