import { useCallback, useRef, useState } from 'react'

export function useToast() {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const toast = useCallback((msg: string) => {
    clearTimeout(timer.current)
    setMessage(msg)
    timer.current = setTimeout(() => setMessage(null), 2200)
  }, [])
  return { toast, message }
}

export default function Toast({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-6">
      <div className="rounded-full bg-ink px-4 py-2 text-sm text-paper shadow-lg">{message}</div>
    </div>
  )
}
