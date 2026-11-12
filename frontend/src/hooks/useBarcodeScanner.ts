import { useEffect, useRef, useState, useCallback } from 'react'

interface UseBarcodeScannerOptions {
  onScan: (barcode: string) => void
  minLength?: number
  maxKeyIntervalMs?: number
  enabled?: boolean
}

export function useBarcodeScanner({
  onScan,
  minLength = 4,
  maxKeyIntervalMs = 60,
  enabled = true,
}: UseBarcodeScannerOptions) {
  const [lastScanned, setLastScanned] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState<boolean>(false)

  const bufferRef = useRef<string>('')
  const lastKeyTimeRef = useRef<number>(0)
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return

      const now = Date.now()
      const timeSinceLastKey = now - lastKeyTimeRef.current
      lastKeyTimeRef.current = now

      // If too much time has passed between keystrokes, flush previous buffer
      if (timeSinceLastKey > maxKeyIntervalMs && bufferRef.current.length > 0) {
        bufferRef.current = ''
        setIsScanning(false)
      }

      // Check for Enter key (scanner terminates with Enter)
      if (e.key === 'Enter') {
        const barcode = bufferRef.current.trim()

        if (barcode.length >= minLength) {
          // Prevent any default Enter actions like submitting active forms
          e.preventDefault()
          e.stopPropagation()

          setLastScanned(barcode)
          setIsScanning(false)
          bufferRef.current = ''

          onScanRef.current(barcode)
          return
        }

        bufferRef.current = ''
        setIsScanning(false)
        return
      }

      // We only accept single printable characters
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        // If typing is very fast, it is a barcode scan
        if (timeSinceLastKey <= maxKeyIntervalMs || bufferRef.current.length === 0) {
          bufferRef.current += e.key
          if (bufferRef.current.length >= 2) {
            setIsScanning(true)
          }
        } else {
          bufferRef.current = e.key
          setIsScanning(false)
        }
      }
    },
    [enabled, maxKeyIntervalMs, minLength]
  )

  useEffect(() => {
    if (!enabled) return

    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [enabled, handleKeyDown])

  return {
    lastScanned,
    isScanning,
  }
}

