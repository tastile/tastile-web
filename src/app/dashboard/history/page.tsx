'use client'

import { useMemo, useState } from 'react'
import { useExecutionEngine } from '@/lib/hooks/use-execution-engine'

export default function HistoryPage() {
  const [dateFilter, setDateFilter] = useState('7') // days
  const { state, loading } = useExecutionEngine()

  const filteredEvents = useMemo(() => {
    const daysAgo = new Date()
    daysAgo.setDate(daysAgo.getDate() - parseInt(dateFilter, 10))
    return state.events
      .filter(evt => evt.occurred_at >= daysAgo)
      .map(evt => {
        const tileId = 'tile_id' in evt.event ? evt.event.tile_id : evt.event.type === 'tile_created' ? evt.event.tile.core.id : null
        const tileTitle = tileId ? state.tiles.get(tileId)?.core.title ?? 'Unknown tile' : 'System'
        return {
          id: evt.event_id,
          event_type: evt.event.type,
          tile_title: tileTitle,
          created_at: evt.occurred_at,
        }
      })
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
  }, [dateFilter, state.events, state.tiles])

  const groupedEvents = filteredEvents.reduce((acc, event) => {
    const date = event.created_at.toLocaleDateString()
    if (!acc[date]) acc[date] = []
    acc[date].push(event)
    return acc
  }, {} as Record<string, typeof filteredEvents>)

  if (loading) {
    return <p className="text-zinc-500 dark:text-zinc-400">Loading...</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">History</h1>
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>

      {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Total Events</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{filteredEvents.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Started</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {filteredEvents.filter(e => e.event_type === 'tile_started').length}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Completed</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {filteredEvents.filter(e => e.event_type === 'tile_completed').length}
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-6">
        {Object.entries(groupedEvents).map(([date, dayEvents]) => (
          <div key={date}>
            <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3">{date}</h3>
            <div className="space-y-2">
              {dayEvents.map(event => (
                <div
                  key={event.id}
                  className="flex items-center gap-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3"
                >
                  <div className={`w-2 h-2 rounded-full ${
                      event.event_type === 'tile_completed'
                        ? 'bg-green-500'
                        : event.event_type === 'tile_started'
                        ? 'bg-blue-500'
                        : 'bg-zinc-400'
                  }`} />
                  <div className="flex-1">
                    <span className="capitalize font-medium text-zinc-900 dark:text-zinc-100">
                      {event.event_type}
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-400"> • {event.tile_title}</span>
                    </div>
                  <span className="text-sm text-zinc-400 dark:text-zinc-500">
                    {event.created_at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {filteredEvents.length === 0 && (
          <p className="text-zinc-500 dark:text-zinc-400 text-center py-8">No events in this period</p>
        )}
      </div>
    </div>
  )
}
