import { Suspense, lazy, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, isConfigured } from './lib/supabase'
import { fetchCategories } from './lib/db'
import { demoEnabled, enableDemo } from './lib/mockDb'
import type { Category } from './lib/types'
import SetupGuide from './components/SetupGuide'
import TabBar, { type Tab } from './components/TabBar'
import Toast, { useToast } from './components/Toast'
import Login from './pages/Login'
import Add from './pages/Add'
import List from './pages/List'

// 重依赖页面按需加载：Import 带 PapaParse，Dashboard 带 Recharts
const Import = lazy(() => import('./pages/Import'))
const Dashboard = lazy(() => import('./pages/Dashboard'))

export default function App() {
  const [demo, setDemo] = useState(demoEnabled())
  if (!isConfigured) {
    if (demo) return <Shell />
    return (
      <SetupGuide
        onDemo={() => {
          enableDemo()
          setDemo(true)
        }}
      />
    )
  }
  return <AuthGate />
}

function AuthGate() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!ready) return null
  if (!session) return <Login />
  return <Shell />
}

function Shell() {
  const [tab, setTab] = useState<Tab>('add')
  const [categories, setCategories] = useState<Category[]>([])
  const { toast, message } = useToast()

  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch((e) => toast(`加载分类失败：${e.message}`))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <main className="flex-1 pb-24">
        <Suspense fallback={<p className="py-16 text-center text-sm text-stone">加载中…</p>}>
          {tab === 'add' && <Add categories={categories} toast={toast} />}
          {tab === 'list' && <List categories={categories} toast={toast} />}
          {tab === 'import' && <Import categories={categories} toast={toast} />}
          {tab === 'dash' && <Dashboard categories={categories} toast={toast} />}
        </Suspense>
      </main>
      <TabBar tab={tab} onChange={setTab} />
      <Toast message={message} />
    </div>
  )
}
