import { useEffect, useState } from 'react'
export function useReminders(date, tasks, notify) {
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    if (!enabled) return
    function check() {
      const now = new Date(), today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
      if (date !== today) return
      const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
      for (const task of tasks) {
        if (task.done || !task.time || task.time > time) continue
        const key = `reminded:${date}:${task.id}:${task.time}`
        try {
          if (sessionStorage.getItem(key)) continue
          sessionStorage.setItem(key, '1')
          notify(`Task reminder: ${task.name}`)
          if ('Notification' in window && Notification.permission === 'granted') navigator.serviceWorker?.ready.then(reg => reg.showNotification('Better Every Day', {body: 'A planned task is ready. Open your tracker to review it.', tag: key})).catch(()=>{})
        } catch { notify('Reminders need browser session storage.') }
      }
    }
    check(); const id = setInterval(check, 30000)
    return () => clearInterval(id)
  }, [enabled, date, tasks, notify])
  async function enable() {
    if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission()
    setEnabled(true)
  }
  return { enabled, enable, disable: () => setEnabled(false) }
}
