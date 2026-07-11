import { useSyncExternalStore } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'

const KEY = 'theme' // localStorage 只存 'light' | 'dark'，缺省即跟随系统
const media = matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

export function getThemeMode(): ThemeMode {
  const v = localStorage.getItem(KEY)
  return v === 'light' || v === 'dark' ? v : 'system'
}

function apply() {
  const mode = getThemeMode()
  const dark = mode === 'system' ? media.matches : mode === 'dark'
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  // manifest 的 theme_color 是静态的，只能运行时改 meta（与 index.css 的 paper 保持同步）
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#1B1B19' : '#FAFAF7')
  for (const l of listeners) l()
}

export function setThemeMode(mode: ThemeMode): void {
  if (mode === 'system') localStorage.removeItem(KEY)
  else localStorage.setItem(KEY, mode)
  apply()
}

export function initTheme(): void {
  media.addEventListener('change', apply) // 跟随系统档实时联动
  apply()
}

/** 解析后的当前主题（system 已落地为 light/dark），图表取色用 */
export function useResolvedTheme(): 'light' | 'dark' {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'),
  )
}
