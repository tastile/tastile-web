'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Event {
  id: string
  event_type: string
  tile_title: string
  created_at: string
}

export default function HistoryPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState('7') // days
  const supabase = createClient()

  useEffect(() => {
    loadEvents()
  }, [dateFilter])

  async function loadEvents() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const daysAgo = new Date()
    daysAgo.setDate(daysAgo.getDate() - parseInt(dateFilter))

    // Note: In a real implementation, you would have an events table
    // For now, we'll simulate events from tile updates
    const { data: tiles } = await supabase
      .from('tiles')
      .select('id, title, lifecycle, updated_at')
      .eq('user_id', user.id)
      .gte('updated_at', daysAgo.toISOString())
      .order('updated_at', { ascending: false })

    // Simulate events from tile data
    const simulatedEvents: Event[] = []
    tiles?.forEach(tile => {
      simulatedEvents.push({
        id: `${tile.id}-update`,
        event_type: tile.lifecycle === 'Done' ? 'completed' : tile.lifecycle === 'Started' ? 'started' : 'updated',
        tile_title: tile.title,
        created_at: tile.updated_at
      })
    })

    setEvents(simulatedEvents)
    setLoading(false)
  }

  const groupedEvents = events.reduce((acc, event) => {
    const date = new Date(event.created_at).toLocaleDateString()
    if (!acc[date]) acc[date] = []
    acc[date].push(event)
    return acc
  }, {} as Record<string, Event[]>)

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
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{events.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Started</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {events.filter(e => e.event_type === 'started').length}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Completed</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {events.filter(e => e.event_type === 'completed').length}
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
                    event.event_type === 'completed'
                      ? 'bg-green-500'
                      : event.event_type === 'started'
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
                    {new Date(event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {events.length === 0 && (
          <p className="text-zinc-500 dark:text-zinc-400 text-center py-8">No events in this period</p>
        )}
      </div>
    </div>
  )
}
