export const START = '2026-11-06'
export const HABITS = [
  ['discipline', 'Start the day with intention', 'Discipline'],
  ['walking', 'Take a walk', 'Health'],
  ['exercise', 'Move and exercise', 'Health'],
  ['sleep', 'Keep a consistent sleep routine', 'Recovery'],
  ['screen', 'Stay within my screen time goal', 'Discipline'],
  ['home', 'Own a household responsibility', 'Home'],
  ['family', 'Spend undistracted time with family', 'Family'],
  ['care', 'Complete a childcare responsibility', 'Family'],
]
export const PHASES = ['Fix the basics', 'Become more responsible', 'Rebuild connection', 'Make it a lifestyle']
export function localDay(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function offsetDay(date, offset) {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}
export const dayNumber = date => Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${START}T12:00:00Z`)) / 86400000) + 1
export const phaseIndex = n => n <= 7 ? 0 : n <= 14 ? 1 : n <= 21 ? 2 : 3
export const emptyData = () => ({ schemaVersion: 2, days: {} })
export const emptyDay = () => ({ checked: [], tasks: [], journal: '', wins: '', minutes: 0, sleep: 0, screen: 0 })
export function validateData(value) {
  if (!value || value.schemaVersion !== 2 || !value.days || typeof value.days !== 'object' || Array.isArray(value.days)) throw Error('Unsupported backup format.')
  if (Object.keys(value.days).length > 3660) throw Error('Backup has too many days.')
  for (const [date, d] of Object.entries(value.days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0,10) !== date || !d || typeof d !== 'object') throw Error('Invalid day in backup.')
    if (!Array.isArray(d.checked) || d.checked.some(id => !HABITS.some(h => h[0] === id)) || new Set(d.checked).size !== d.checked.length) throw Error('Invalid habits in backup.')
    if (!Array.isArray(d.tasks) || d.tasks.length > 100 || new Set(d.tasks.map(t=>t.id)).size !== d.tasks.length) throw Error('Invalid tasks in backup.')
    for (const t of d.tasks) if (!t || typeof t.id !== 'string' || typeof t.name !== 'string' || t.name.length > 140 || typeof t.done !== 'boolean' || !/^([01]\d|2[0-3]):[0-5]\d$|^$/.test(t.time) || !['Personal','Home','Family','Childcare'].includes(t.group)) throw Error('Invalid task in backup.')
    for (const k of ['journal', 'wins']) if (typeof d[k] !== 'string' || d[k].length > 10000) throw Error('Invalid reflection in backup.')
    for (const [k, max] of [['minutes',1440],['sleep',24],['screen',24]]) if (typeof d[k] !== 'number' || !Number.isFinite(d[k]) || d[k] < 0 || d[k] > max) throw Error('Invalid metric in backup.')
  }
  if (JSON.stringify(value).length > 700000) throw Error('Backup exceeds the supported size. Export and archive older entries first.')
  return { schemaVersion: 2, days: value.days }
}
export function weeklyStats(data, end) {
  return Array.from({length: 7}, (_, i) => {
    const date = offsetDay(end, i - 6), d = data.days[date] || emptyDay()
    return { date, habits: d.checked.length, minutes: d.minutes, tasks: d.tasks.filter(t => t.done).length }
  })
}
export function assertRevision(actual, expected) {
  if (actual !== expected) throw Error('Cloud backup changed on another device. Restore and review it before uploading. Your local entries are unchanged.')
}
