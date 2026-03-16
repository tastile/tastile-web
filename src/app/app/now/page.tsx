'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Check, Pause, Plus, ArrowUp, Timer, ChevronRight,
} from 'lucide-react'
import { useExecutionEngine } from '@/lib/hooks/use-execution-engine'
import { Actor } from '@/lib/domain/actor'
import { TileId } from '@/lib/domain/ids'
import { TileLifecycle, StartSource } from '@/lib/domain/tile'

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatDuration(sec: number): string {
  const m = Math.round(sec / 60)
  if (m >= 60) {
    const h = Math.floor(m / 60)
    const rm = m % 60
    return rm > 0 ? `${h}h ${rm}m` : `${h}h`
  }
  return `${m} min`
}

const DEFAULT_DURATION_SEC = 25 * 60

export default function NowPage() {
  const { state, loading, execute } = useExecutionEngine()
  const [newTitle, setNewTitle] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [showIntervention, setShowIntervention] = useState(false)

  // Derive data from engine state
  const tiles = Array.from(state.tiles.values())
  const activeTile = state.execution.active_tile_id
    ? state.tiles.get(state.execution.active_tile_id)
    : null
  const readyTiles = tiles.filter(t => t.core.lifecycle === TileLifecycle.Ready)
  const nextUpTiles = readyTiles.slice(0, 2)
  const doneTiles = tiles.filter(t => t.core.lifecycle === TileLifecycle.Done)

  // Timer based on execution state
  const phaseEndsAt = state.execution.phase_ends_at
  const phaseStartedAt = state.execution.phase_started_at
  const duration = phaseEndsAt && phaseStartedAt
    ? (phaseEndsAt.getTime() - phaseStartedAt.getTime()) / 1000
    : DEFAULT_DURATION_SEC

  useEffect(() => {
    if (!activeTile || !phaseStartedAt) {
      setElapsed(0)
      setShowIntervention(false)
      return
    }
    const start = phaseStartedAt.getTime()
    const tick = () => {
      const now = Date.now()
      const sec = Math.floor((now - start) / 1000)
      setElapsed(sec)
      if (sec >= duration && !showIntervention) {
        setShowIntervention(true)
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [activeTile, phaseStartedAt, duration, showIntervention])

  const remaining = Math.max(0, duration - elapsed)
  const progress = duration > 0 ? Math.min(1, elapsed / duration) : 0

  async function createTile(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    const tileId = TileId.new()
    await execute(
      {
        type: 'create_tile',
        tile_id: tileId,
        title: newTitle.trim(),
        next_action: null,
        done_definition: null,
      },
      Actor.human('current-user')
    )
    setNewTitle('')
  }

  async function startTile(tileId: TileId) {
    await execute(
      {
        type: 'start_tile',
        tile_id: tileId,
        started_at: new Date(),
        source: StartSource.Manual,
      },
      Actor.human('current-user')
    )
  }

  async function completeTile(tileId: TileId) {
    await execute(
      {
        type: 'complete_tile',
        tile_id: tileId,
        completed_at: new Date(),
        next_tile_id: null,
      },
      Actor.human('current-user')
    )
    setShowIntervention(false)
  }

  async function extendTime(minutes: number) {
    if (!activeTile) return
    await execute(
      {
        type: 'extend_phase',
        tile_id: activeTile.core.id,
        delta_min: minutes,
        reason: null,
      },
      Actor.human('current-user')
    )
    setShowIntervention(false)
  }

  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-zinc-400 text-sm">Loading...</div>
      </div>
    )
  }

  // Calculate stats
  const plannedTiles = tiles.filter(t => t.core.lifecycle !== TileLifecycle.Done)
  const totalPlannedSec = plannedTiles.length * DEFAULT_DURATION_SEC
  const totalDoneSec = doneTiles.length * DEFAULT_DURATION_SEC
  const totalRemainingSec = Math.max(0, totalPlannedSec - totalDoneSec)

  return (
    <>
      {/* Main Content */}
      <div className="flex-1 flex flex-col gap-5 p-5 md:p-7 lg:px-12 lg:py-10 overflow-auto">
        {/* Desktop header */}
        <div className="hidden lg:flex items-center justify-between">
          <h1 className="text-[28px] font-extrabold text-black">
            Today
          </h1>
          <span className="text-sm text-zinc-500">{dateStr} · {timeStr}</span>
        </div>

        {/* Active Card */}
        {activeTile && (
          <div className="rounded-[20px] lg:rounded-[24px] bg-black p-5 lg:p-8 flex flex-col gap-3.5 lg:gap-5">
            {/* Badge row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 bg-zinc-800 rounded-md px-2.5 h-[22px] lg:h-[26px]">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <span className="text-[10px] lg:text-[11px] font-semibold tracking-wider text-zinc-400">ACTIVE</span>
              </div>
              <span className="text-[13px] text-zinc-500 font-medium">
                {formatTime(remaining)} left
                <span className="hidden lg:inline"> · {Math.round(progress * 100)}% complete</span>
              </span>
            </div>
            {/* Title */}
            <h2 className="text-[22px] lg:text-[32px] font-extrabold text-white leading-tight">
              {activeTile.core.title}
            </h2>
            {/* Timer + Progress */}
            <div className="flex items-end justify-between">
              <span className="text-[56px] lg:text-[80px] font-black text-white leading-none tracking-tight">
                {formatTime(remaining)}
              </span>
              <div className="hidden lg:flex flex-col items-end gap-2.5">
                {/* Desktop buttons */}
                <button
                  onClick={() => completeTile(activeTile.core.id)}
                  className="flex items-center gap-2 bg-white rounded-xl h-11 px-6 text-sm font-semibold text-black hover:bg-zinc-100 transition-colors"
                >
                  <Check size={14} />
                  Complete
                </button>
                <div className="flex gap-2">
                  <button className="flex items-center justify-center bg-zinc-800 rounded-[10px] h-11 w-12 text-zinc-400 hover:text-white transition-colors">
                    <Pause size={16} />
                  </button>
                  <button
                    onClick={() => extendTime(15)}
                    className="flex items-center justify-center bg-zinc-800 rounded-[10px] h-11 px-4 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
                  >
                    +15 min
                  </button>
                </div>
              </div>
            </div>
            {/* Progress bar - mobile/tablet only */}
            <div className="lg:hidden">
              <div className="bg-zinc-800 rounded h-1 w-full">
                <div className="bg-white rounded h-1 transition-all" style={{ width: `${progress * 100}%` }} />
              </div>
            </div>
            {/* Mobile action buttons */}
            <div className="flex gap-2 lg:hidden">
              <button
                onClick={() => completeTile(activeTile.core.id)}
                className="flex items-center justify-center gap-1.5 bg-white rounded-[10px] h-10 flex-1 text-[13px] font-semibold text-black"
              >
                <Check size={14} />
                Complete
              </button>
              <button className="flex items-center justify-center bg-zinc-800 rounded-[10px] h-10 w-11 text-zinc-400">
                <Pause size={16} />
              </button>
              <button
                onClick={() => extendTime(15)}
                className="flex items-center justify-center bg-zinc-800 rounded-[10px] h-10 w-[72px] text-xs font-semibold text-zinc-400"
              >
                +15 min
              </button>
            </div>
          </div>
        )}

        {/* Next Up Section */}
        {nextUpTiles.length > 0 && (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-[2px] text-zinc-400">NEXT UP</span>
              <span className="text-[11px] text-zinc-300">System scheduled</span>
            </div>
            <div className="flex gap-2.5 lg:gap-3">
              {nextUpTiles.map(tile => (
                <div key={tile.core.id} className="flex-1 bg-zinc-100 rounded-[14px] lg:rounded-[16px] p-3.5 lg:p-[18px] flex flex-col gap-2">
                  <span className="text-sm lg:text-base font-bold text-black">
                    {tile.core.title}
                  </span>
                  <div className="flex items-center justify-between text-zinc-500">
                    <span className="text-xs">
                      {formatDuration(DEFAULT_DURATION_SEC)}
                    </span>
                    <span className="flex gap-0.5">
                      <span className="w-1 h-1 rounded-full bg-zinc-400" />
                      <span className="w-1 h-1 rounded-full bg-zinc-400" />
                      <span className="w-1 h-1 rounded-full bg-zinc-300" />
                    </span>
                  </div>
                  <button
                    onClick={() => startTile(tile.core.id)}
                    className="flex items-center justify-center gap-1 bg-black rounded-lg h-8 lg:h-9 text-white text-xs lg:text-sm font-semibold"
                  >
                    Start <ChevronRight size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Today Timeline Strip - mobile/tablet only */}
        <div className="lg:hidden flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-[2px] text-zinc-400">TODAY</span>
            <span className="text-[11px] text-zinc-300">{formatDuration(totalPlannedSec)} planned</span>
          </div>
          <div className="flex items-center gap-[3px] bg-zinc-100 rounded-xl h-12 px-3 overflow-hidden relative">
            {tiles.filter(t => t.core.lifecycle !== TileLifecycle.Done).slice(0, 4).map((tile, i) => (
              <div
                key={tile.core.id}
                className={`flex items-center justify-center rounded-md h-8 px-3 shrink-0 ${
                  i === 0 && activeTile?.core.id === tile.core.id
                    ? 'bg-black text-white'
                    : 'bg-zinc-200 text-zinc-500'
                }`}
              >
                <span className="text-[9px] font-semibold truncate max-w-[80px]">
                  {tile.core.title.length > 12 ? tile.core.title.slice(0, 12) + '…' : tile.core.title}
                </span>
              </div>
            ))}
            {/* Now line */}
            <div className="absolute right-3 top-[5px] bottom-[5px] w-0.5 bg-red-500 rounded" />
          </div>
        </div>

        {/* Quick Add */}
        <form onSubmit={createTile} className="flex gap-2.5 lg:gap-3 mt-auto">
          <div className="flex items-center gap-2 bg-zinc-100 rounded-[14px] h-12 px-4 flex-1">
            <Plus size={16} className="text-zinc-400 shrink-0" />
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Add a tile..."
              className="bg-transparent text-sm text-black placeholder:text-zinc-400 outline-none w-full"
            />
          </div>
          <button
            type="submit"
            className="flex items-center justify-center bg-black rounded-[14px] h-12 w-12 shrink-0 text-white hover:bg-zinc-800 transition-colors"
          >
            <ArrowUp size={18} />
          </button>
        </form>
      </div>

      {/* Right Timeline Panel - Desktop & Tablet */}
      <div className="hidden md:flex flex-col gap-5 w-[320px] lg:w-[320px] shrink-0 bg-[#FAFAFA] border-l border-zinc-100 p-7 lg:px-6 lg:py-10 overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-base lg:text-lg font-extrabold text-black">
            Timeline
          </span>
          <span className="text-[13px] text-zinc-400">
            {now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>

        {/* Stats */}
        <div className="flex gap-0 bg-zinc-100 rounded-xl p-3.5 lg:p-0 lg:bg-transparent">
          <div className="flex-1 flex flex-col gap-0.5">
            <span className="text-sm lg:text-[14px] font-extrabold text-black">
              {formatDuration(totalPlannedSec)}
            </span>
            <span className="text-[10px] lg:text-[11px] text-zinc-400">Planned</span>
          </div>
          <div className="flex-1 flex flex-col gap-0.5">
            <span className="text-sm lg:text-[14px] font-extrabold text-black">
              {formatDuration(totalDoneSec)}
            </span>
            <span className="text-[10px] lg:text-[11px] text-zinc-400">Done</span>
          </div>
          <div className="flex-1 flex flex-col gap-0.5">
            <span className="text-sm lg:text-[14px] font-extrabold text-black">
              {formatDuration(totalRemainingSec)}
            </span>
            <span className="text-[10px] lg:text-[11px] text-zinc-400">Remaining</span>
          </div>
        </div>

        {/* Timeline Items */}
        <div className="flex flex-col gap-1.5 flex-1">
          {tiles.filter(t => t.core.lifecycle !== TileLifecycle.Done).map((tile, i) => {
            const isActive = activeTile?.core.id === tile.core.id
            return (
              <div
                key={tile.core.id}
                className={`flex items-center justify-between rounded-xl px-3.5 ${
                  isActive
                    ? 'bg-black h-14 lg:h-[56px]'
                    : i < 3
                      ? 'bg-zinc-200 h-11 lg:h-[44px]'
                      : 'bg-zinc-100 h-10 lg:h-[40px] border border-zinc-200'
                }`}
              >
                <span className={`text-[13px] font-${isActive ? 'bold' : 'semibold'} ${
                  isActive ? 'text-white' : i < 3 ? 'text-zinc-500' : 'text-zinc-400'
                }`}>
                  {tile.core.title}
                </span>
                <span className={`text-[11px] ${
                  isActive ? 'text-zinc-400' : 'text-zinc-400'
                }`}>
                  {isActive ? formatTime(remaining) : ''}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Intervention Modal */}
      {showIntervention && activeTile && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Gradient backdrop */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/80 to-black" />
          {/* Card */}
          <div className="relative w-full max-w-[390px] bg-white rounded-t-[28px] p-7 lg:p-8 flex flex-col gap-5 lg:rounded-[28px] lg:mb-auto lg:mt-[30vh]">
            {/* Badge */}
            <div className="flex items-center gap-1.5 bg-amber-50 rounded-[7px] px-2.5 h-6 w-fit">
              <Timer size={12} className="text-amber-600" />
              <span className="text-[11px] font-semibold text-amber-600">Time&apos;s up</span>
            </div>
            {/* Title */}
            <h2 className="text-[26px] font-extrabold text-black leading-tight">
              {activeTile.core.title}
            </h2>
            {/* Elapsed */}
            <div className="flex items-center gap-2">
              <span className="text-[48px] font-black text-black tracking-tight leading-none">
                {formatTime(elapsed)}
              </span>
              <span className="text-sm text-zinc-500">elapsed</span>
            </div>
            {/* Buttons */}
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => completeTile(activeTile.core.id)}
                className="flex items-center justify-center gap-2 bg-black rounded-[14px] h-[52px] text-white text-[15px] font-semibold hover:bg-zinc-800 transition-colors"
              >
                <Check size={16} />
                Mark Complete
              </button>
              <div className="flex gap-2.5">
                <button
                  onClick={() => extendTime(15)}
                  className="flex items-center justify-center gap-1.5 bg-zinc-100 rounded-xl h-12 flex-1 text-sm font-semibold text-black hover:bg-zinc-200 transition-colors"
                >
                  <Plus size={14} />
                  +15 min
                </button>
                <button
                  onClick={() => extendTime(5)}
                  className="flex items-center justify-center gap-1.5 bg-zinc-100 rounded-xl h-12 flex-1 text-sm font-semibold text-black hover:bg-zinc-200 transition-colors"
                >
                  <Plus size={14} />
                  +5 min
                </button>
              </div>
            </div>
            {/* Break link */}
            <button
              onClick={() => setShowIntervention(false)}
              className="text-[13px] text-zinc-400 text-center hover:text-zinc-600 transition-colors"
            >
              Take a break instead
            </button>
          </div>
        </div>
      )}
    </>
  )
}
