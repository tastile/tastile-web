export function formatDuration(minutes: number | null, locale: 'ja' | 'en' = 'ja'): string {
  if (minutes === null || minutes === undefined) return locale === 'ja' ? '未設定' : 'unspecified'

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (locale === 'ja') {
    if (hours > 0 && mins > 0) return `${hours}時間${mins}分`
    if (hours > 0) return `${hours}時間`
    return `${mins}分`
  }

  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`
  if (hours > 0) return `${hours}h`
  return `${mins}m`
}

export function formatDateTime(date: Date | null, locale: 'ja' | 'en' = 'ja'): string {
  if (!date) return locale === 'ja' ? '未設定' : 'unscheduled'

  return new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-US', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function getCurrentLocalDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getCurrentLocalTime(): string {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

export function parseDateTimeParts(datePart: string, timePart: string): Date | null {
  if (!datePart || !timePart) return null
  const date = new Date(`${datePart}T${timePart}`)
  if (Number.isNaN(date.getTime())) return null
  return date
}
