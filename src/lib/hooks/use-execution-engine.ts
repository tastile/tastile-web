'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AppState } from '../core/state'
import { cloneState, CommandHandler } from '../core/handler'
import { EventStore } from '../storage/event-store'
import { CommandEnvelope, Command } from '../core/command'
import { Actor } from '../domain/actor'
import { reduce } from '../core/reducer'

export function useExecutionEngine() {
  const [state, setState] = useState<AppState>(AppState.initial())
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [supabase] = useState(() => createClient())
  const handlerRef = useRef(new CommandHandler())
  const eventStoreRef = useRef<EventStore | null>(null)

  // Initialize: load user and event history
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      setUserId(user.id)
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
  }, [supabase])

  // Subscribe to new events via Supabase Realtime
  useEffect(() => {
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
            const eventEnvelope = eventStoreRef.current.deserialize(
              payload.new as Parameters<EventStore['deserialize']>[0]
            )
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
  }, [supabase, userId])

  // Execute command
  const execute = useCallback(async (command: Command, actor: Actor) => {
    if (!eventStoreRef.current) {
      throw new Error('Event store not initialized. Are you authenticated?')
    }

    const envelope = CommandEnvelope.create(command, actor)

    // Use setState functional form to get latest state
    setState(prevState => {
      const stateCopy = cloneState(prevState)
      const events = handlerRef.current.handle(envelope, stateCopy)

      // Persist events to Supabase (fire-and-forget for optimistic update)
      Promise.all(events.map(evt => eventStoreRef.current!.append(evt))).catch(err => {
        console.error('Failed to persist events:', err)
      })

      return stateCopy
    })
  }, [])

  return { state, loading, execute }
}
