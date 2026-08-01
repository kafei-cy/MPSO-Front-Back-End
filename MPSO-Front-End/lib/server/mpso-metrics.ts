import 'server-only'

const onlineCommunicationPattern = /^P1 communication cost\s*=\s*([0-9]+(?:\.[0-9]+)?)\s*MB\s*$/m

export function parseOnlineCommunicationMiB(log: string) {
  const onlineSectionIndex = log.indexOf('[ONLINE P0]')
  const onlineLog = onlineSectionIndex >= 0 ? log.slice(onlineSectionIndex) : log
  const match = onlineLog.match(onlineCommunicationPattern)
  if (!match) return null

  const value = Number(match[1])
  return Number.isFinite(value) && value >= 0 ? value : null
}
