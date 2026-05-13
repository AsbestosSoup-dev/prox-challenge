import { useCallback, useRef } from "react"

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://127.0.0.1:8000"

export function useTTS(onError?: () => void) {
    const audioRef = useRef<HTMLAudioElement | null>(null)

    const speak = useCallback(async (text: string) => {
        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current = null
        }

        const cleaned = text
            .replace(/\[.*?\]/g, "")
            .replace(/\*\*/g, "")
            .trim()

        if (!cleaned) return

        try {
            const res = await fetch(`${BACKEND_URL}/speak`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: cleaned }),
            })
            if (!res.ok) { onError?.(); return }

            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const audio = new Audio(url)
            audioRef.current = audio
            audio.play()
            audio.onended = () => URL.revokeObjectURL(url)
        } catch {
            onError?.()
        }
    }, [onError])

    const stop = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current = null
        }
    }, [])

    return { speak, stop }
}
