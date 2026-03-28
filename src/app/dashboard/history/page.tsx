'use client'

import { useMemo, useState } from 'react'
import { useExecutionEngineContext } from '@/lib/hooks/execution-engine-context'
import { buildDashboardProjection } from '@/lib/projection/dashboard-projection'

const MAX_VISIBLE_HISTORY_EVENTS = 120

export default function HistoryPage() {
  const [dateFilter, setDateFilter] = useState('7') // days
  const { state, loading } = useExecutionEngineContext()
  const projection = useMemo(() => buildDashboardProjection(state, new Date()), [state])

  const filteredEvents = useMemo(() => {
    const daysAgo = new Date()
    daysAgo.setDate(daysAgo.getDate() - parseInt(dateFilter, 10))
    return projection.history.events
      .filter(evt => evt.createdAt >= daysAgo)
      .map(evt => ({
        id: evt.id,
        event_type: evt.eventType,
        tile_title: evt.tileTitle,
        created_at: evt.createdAt,
      }))
  }, [dateFilter, projection.history.events])
  const visibleEvents = filteredEvents.slice(0, MAX_VISIBLE_HISTORY_EVENTS)
  const omittedEvents = Math.max(0, filteredEvents.length - visibleEvents.length)

  const groupedEvents = visibleEvents.reduce((acc, event) => {
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
      {omittedEvents > 0 ? (
        <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          +{omittedEvents} omitted
        </p>
      ) : null}

      {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Total Events</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{visibleEvents.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Started</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
             {visibleEvents.filter(e => e.event_type.endsWith('_started')).length}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Completed</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
             {visibleEvents.filter(e => e.event_type.endsWith('_ended')).length}
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
                      event.event_type.endsWith('_ended')
                        ? 'bg-green-500'
                        : event.event_type.endsWith('_started')
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
        {visibleEvents.length === 0 && (
          <p className="text-zinc-500 dark:text-zinc-400 text-center py-8">No events in this period</p>
        )}
      </div>
    </div>
  )
}
