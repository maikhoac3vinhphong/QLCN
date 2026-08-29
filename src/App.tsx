import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { getMyProfile, type Profile } from './lib/auth'
import { resolveClassId, amITreasurer } from './lib/db'
import Login from './pages/Login'
import SetupWizard from './pages/SetupWizard'
import Shell from './pages/Shell'
import ParentClaim from './pages/ParentClaim'

function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh', color: 'var(--muted)', textAlign: 'center', padding: 20 }}>{children}</div>
}

type Inner =
  | { kind: 'loading' }
  | { kind: 'wizard' }
  | { kind: 'noclass' }
  | { kind: 'shell'; classId: string; isTreasurer: boolean }

// Sau khi đăng nhập: xác định lớp → wizard (GVCN chưa có lớp) hoặc vào khung app.
function SignedIn({ profile, onSignedOut }: { profile: Profile; onSignedOut: () => void }) {
  const [inner, setInner] = useState<Inner>({ kind: 'loading' })

  async function resolve() {
    const cid = await resolveClassId(profile)
    if (cid) {
      const treas = profile.role === 'hs' ? await amITreasurer() : false
      setInner({ kind: 'shell', classId: cid, isTreasurer: treas })
    } else setInner({ kind: profile.role === 'gvcn' ? 'wizard' : 'noclass' })
  }
  useEffect(() => { resolve() }, [])

  if (inner.kind === 'loading') return <Center>Đang tải…</Center>
  if (inner.kind === 'wizard') return <SetupWizard profile={profile} onDone={resolve} />
  if (inner.kind === 'noclass') return <Center>Tài khoản của bạn chưa được gắn vào lớp nào. Liên hệ giáo viên chủ nhiệm.</Center>
  return <Shell profile={profile} classId={inner.classId} isTreasurer={inner.isTreasurer} onSignedOut={onSignedOut} />
}

type State =
  | { kind: 'loading' }
  | { kind: 'signedout' }
  | { kind: 'signedin'; profile: Profile }

export default function App() {
  const claim = window.location.pathname.match(/^\/ph\/([A-Za-z0-9]+)/)
  if (claim) return <ParentClaim token={claim[1]} />

  const [state, setState] = useState<State>({ kind: 'loading' })

  async function refresh() {
    try {
      const profile = await getMyProfile()
      setState(profile ? { kind: 'signedin', profile } : { kind: 'signedout' })
    } catch { setState({ kind: 'signedout' }) }
  }

  useEffect(() => {
    refresh()
    const { data: sub } = supabase.auth.onAuthStateChange(() => refresh())
    return () => sub.subscription.unsubscribe()
  }, [])

  if (state.kind === 'loading') return <Center>Đang tải…</Center>
  if (state.kind === 'signedout') return <Login onSignedIn={refresh} />
  return <SignedIn profile={state.profile} onSignedOut={refresh} />
}
