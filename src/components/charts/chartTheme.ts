import type React from 'react'
import { useResolvedTheme } from '../../lib/theme'

// SVG 属性不认 CSS 变量，两组常量与 src/index.css 的 @theme / 深色覆写保持同步
const LIGHT = {
  paper: '#FAFAF7',
  raised: '#FFFFFF',
  ink: '#1A1A18',
  stone: '#8A8A82',
  hairline: '#E8E6DF',
  seal: '#C0392B',
  income: '#2E7D5B',
}

const DARK = {
  paper: '#1B1B19',
  raised: '#252522',
  ink: '#EDEBE3',
  stone: '#8A8A82',
  hairline: '#33332E',
  seal: '#D96A57',
  income: '#4FA97E',
}

// 分类色是 dataviz 色板的 light 列；深色用同色相 dark 步进（validate_palette.js
// 对 #1B1B19 面校验过），不迁移数据库。缺映射的色两端通用，原样返回。
// 关键修复：#4A3AA7（居住紫）在深面上仅 1.92:1 → #9085E9
const DARK_STEP: Record<string, string> = {
  '#EB6834': '#D95926',
  '#2A78D6': '#3987E5',
  '#E87BA4': '#D55181',
  '#1BAF7A': '#199E70',
  '#4A3AA7': '#9085E9',
  '#EDA100': '#C98500',
  '#E34948': '#E66767',
  '#2E7D5B': '#4FA97E',
}

export type ChartColors = typeof LIGHT

export function useChartTheme(): {
  C: ChartColors
  catColor: (hex: string) => string
  tooltipStyle: React.CSSProperties
} {
  const dark = useResolvedTheme() === 'dark'
  const C = dark ? DARK : LIGHT
  return {
    C,
    catColor: (hex: string) => (dark ? (DARK_STEP[hex.toUpperCase()] ?? hex) : hex),
    tooltipStyle: {
      background: C.raised,
      border: `1px solid ${C.hairline}`,
      borderRadius: 10,
      fontSize: 12,
      color: C.ink,
      boxShadow: dark ? '0 4px 12px rgba(0, 0, 0, 0.45)' : '0 4px 12px rgba(26, 26, 24, 0.08)',
      padding: '6px 10px',
    },
  }
}
