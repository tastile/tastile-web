'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AppState } from '../core/state'
import { CommandHandler } from '../core/handler'
import { EventStore } from '../storage/event-store'
import { CommandEnvelope, Command } from '../core/command'
import { Actor } from '../domain/actor'
import { reduce } from '../core/reducer'

export function useExecutionEngine() {
  const [state, setState] = useState<AppState>(AppState.initial)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const handlerRef = useRef(new CommandHandler())
  const eventStoreRef = useRef<EventStore | null>(null)
  const userIdRef = useRef<string | null>(null)

  // Initialize: load user and event history
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      userIdRef.current = user.id
      const eventStore = new EventStore(supabase, user.id)
      eventStoreRef.current = eventStore

      // Replay all events to build state
      const events = await eventStore.loadAll()
      const newState = AppState.initial()
      for (const envelope of events) {
        reduce(newState, envelope.event)
        newState.events.push(envelope)
      }
      setState(newState)
      setLoading(false)
    }

    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Subscribe to new events via Supabase Realtime
  useEffect(() => {
    const userId = userIdRef.current
    if (!userId) return

    const channel = supabase
      .channel('execution-events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'events',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (!eventStoreRef.current) return
          try {
            const eventEnvelope = eventStoreRef.current.deserialize(payload.new as any)
            setState(prev => {
              const newState: AppState = {
                tiles: new Map(prev.tiles),
                execution: { ...prev.execution },
                events: [...prev.events],
              }
              reduce(newState, eventEnvelope.event)
              newState.events.push(eventEnvelope)
              return newState
            })
          } catch (err) {
            console.error('Failed to deserialize realtime event:', err)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIdRef.current])

  // Execute command
  const execute = useCallback(async (command: Command, actor: Actor) => {
    if (!eventStoreRef.current) {
      throw new Error('Event store not initialized. Are you authenticated?')
    }

    const envelope = CommandEnvelope.create(command, actor)

    // Handle command (validates, generates events, applies to local state copy)
    const stateCopy: AppState = {
      tiles: new Map(state.tiles),
      execution: { ...state.execution },
      events: [...state.events],
    }
    const events = handlerRef.current.handle(envelope, stateCopy)

    // Persist events to Supabase
    for (const evt of events) {
      await eventStoreRef.current.append(evt)
    }

    // Update local state (Realtime will also update, but do optimistic update too)
    setState(stateCopy)
  }, [state])

  return { state, loading, execute }
}
