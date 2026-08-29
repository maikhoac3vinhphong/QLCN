import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { getMyProfile, type Profile } from './lib/auth'
import Login from './pages/Login'
import RoleHome from './pages/RoleHome'
import SetupWizard from './pages/SetupWizard'

type State =
  | { kind: 'loading' }
  | { kind: 'signedout' }
  | { kind: 'signedin'; profile: Profile }

function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh', color: 'var(--muted)' }}>{children}</div>
}

// GVCN: chưa có lớp → wizard; có rồi → trang chủ.
function GvcnGate({ profile, onSignedOut }: { profile: Profile; onSignedOut: () => void }) {
  const [view, setView] = useState<'loading' | 'wizard' | 'home'>('loading')
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('classes').select('id').limit(1)
      setView(data && data.length ? 'home' : 'wizard')
    })()
  }, [])
  if (view === 'loading') return <Center>Đang tải…</Center>
  if (view === 'wizard') return <SetupWizard profile={profile} onDone={() => setView('home')} />
  return <RoleHome profile={profile} onSignedOut={onSignedOut} />
}

export default function App() {
  const [state, setState] = useState<State>({ kind: 'loading' })

  async function refresh() {
    try {
      const profile = await getMyProfile()
      setState(profile ? { kind: 'signedin', profile } : { kind: 'signedout' })
    } catch {
      setState({ kind: 'signedout' })
    }
  }

  useEffect(() => {
    refresh()
    const { data: sub } = supabase.auth.onAuthStateChange(() => refresh())
    return () => sub.subscription.unsubscribe()
  }, [])

  if (state.kind === 'loading') return <Center>Đang tải…</Center>
  if (state.kind === 'signedout') return <Login onSignedIn={refresh} />
  if (state.profile.role === 'gvcn') return <GvcnGate profile={state.profile} onSignedOut={refresh} />
  return <RoleHome profile={state.profile} onSignedOut={refresh} />
}
