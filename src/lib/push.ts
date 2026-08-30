import { supabase } from './supabase'

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function isPushEnabled(): Promise<boolean> {
  if (!pushSupported()) return false
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return !!sub && Notification.permission === 'granted'
}

export type EnableResult = 'ok' | 'denied' | 'unsupported' | 'no-key' | 'error'

export async function enablePush(): Promise<EnableResult> {
  if (!pushSupported()) return 'unsupported'
  if (!VAPID_PUBLIC) return 'no-key'
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return 'denied'
  try {
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource })
    const j = sub.toJSON()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !j.endpoint || !j.keys) return 'error'
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: user.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth
    }, { onConflict: 'endpoint' })
    if (error) return 'error'
    return 'ok'
  } catch {
    return 'error'
  }
}
