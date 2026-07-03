// 汎用ボタン。UI-RULE-001（非活性はグレーアウト＋クリック無反応）を内包。
// タップ領域は最小44×44px（設計書§7.4）。
import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
  disabled?: boolean
  children: ReactNode
}

export default function Button({ variant = 'secondary', disabled = false, children, className = '', ...rest }: Props) {
  const base =
    'min-w-[44px] min-h-[44px] px-5 py-2 rounded-lg font-bold text-sm transition focus-visible:outline-2 focus-visible:outline focus-visible:outline-accent'
  const look =
    variant === 'primary'
      ? 'bg-accent text-bg-base hover:brightness-110'
      : 'bg-surface-light text-text-main border border-line hover:border-accent'
  // UI-RULE-001：非活性は opacity-40 grayscale pointer-events-none ＋ aria-disabled
  const disabledCls = disabled ? 'opacity-40 grayscale pointer-events-none' : ''

  return (
    <button
      className={`${base} ${look} ${disabledCls} ${className}`}
      disabled={disabled}
      aria-disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  )
}
