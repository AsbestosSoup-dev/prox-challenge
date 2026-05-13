import { useEffect, useRef, useState, useCallback } from "react"
import { createPortal } from "react-dom"

interface Props {
    src: string
    alt?: string
    onClose: () => void
}

export default function Lightbox({ src, alt, onClose }: Props) {
    const [scale, setScale] = useState(1)
    const [offset, setOffset] = useState({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)

    const scaleRef = useRef(1)
    const offsetRef = useRef({ x: 0, y: 0 })
    const lastPinchRef = useRef<number | null>(null)
    const dragStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

    // swipe-down to dismiss
    const swipeStartRef = useRef<{ y: number; time: number } | null>(null)
    const [dismissY, setDismissY] = useState(0)
    const [dismissing, setDismissing] = useState(false)

    const commit = useCallback((newScale: number, newOffset: { x: number; y: number }) => {
        const s = Math.max(1, Math.min(6, newScale))
        const ox = s === 1 ? 0 : newOffset.x
        const oy = s === 1 ? 0 : newOffset.y
        scaleRef.current = s
        offsetRef.current = { x: ox, y: oy }
        setScale(s)
        setOffset({ x: ox, y: oy })
    }, [])

    // double-tap to zoom
    const lastTapRef = useRef(0)
    const handleTap = useCallback((e: React.MouseEvent) => {
        const now = Date.now()
        if (now - lastTapRef.current < 300) {
            if (scaleRef.current > 1) {
                commit(1, { x: 0, y: 0 })
            } else {
                commit(2.5, { x: 0, y: 0 })
            }
            e.stopPropagation()
        }
        lastTapRef.current = now
    }, [commit])

    // pinch zoom + drag via pointer events
    const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

        if (pointersRef.current.size === 1) {
            dragStartRef.current = { x: e.clientX, y: e.clientY, ox: offsetRef.current.x, oy: offsetRef.current.y }
            swipeStartRef.current = scaleRef.current === 1 ? { y: e.clientY, time: Date.now() } : null
        }
        if (pointersRef.current.size === 2) {
            swipeStartRef.current = null
            const pts = [...pointersRef.current.values()]
            lastPinchRef.current = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)
        }
    }, [])

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

        if (pointersRef.current.size === 2) {
            const pts = [...pointersRef.current.values()]
            const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)
            if (lastPinchRef.current !== null) {
                const ratio = dist / lastPinchRef.current
                commit(scaleRef.current * ratio, offsetRef.current)
            }
            lastPinchRef.current = dist
        } else if (pointersRef.current.size === 1 && dragStartRef.current) {
            if (scaleRef.current > 1) {
                setIsDragging(true)
                const dx = e.clientX - dragStartRef.current.x
                const dy = e.clientY - dragStartRef.current.y
                commit(scaleRef.current, { x: dragStartRef.current.ox + dx, y: dragStartRef.current.oy + dy })
            } else if (swipeStartRef.current) {
                const dy = e.clientY - swipeStartRef.current.y
                if (dy > 0) setDismissY(dy)
            }
        }
    }, [commit])

    const onPointerUp = useCallback((e: React.PointerEvent) => {
        pointersRef.current.delete(e.pointerId)
        setIsDragging(false)
        lastPinchRef.current = null

        if (swipeStartRef.current) {
            const dy = dismissY
            const dt = Date.now() - swipeStartRef.current.time
            swipeStartRef.current = null
            if (dy > 120 || (dy > 60 && dt < 250)) {
                setDismissing(true)
                setTimeout(onClose, 250)
            } else {
                setDismissY(0)
            }
        }
    }, [dismissY, onClose])

    // close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
        window.addEventListener("keydown", handler)
        return () => window.removeEventListener("keydown", handler)
    }, [onClose])

    // lock body scroll
    useEffect(() => {
        const prev = document.body.style.overflow
        document.body.style.overflow = "hidden"
        return () => { document.body.style.overflow = prev }
    }, [])

    const backdropOpacity = Math.max(0, 1 - dismissY / 300)

    return createPortal(
        <div
            className="lightbox-backdrop"
            style={{ opacity: backdropOpacity }}
            onClick={onClose}
        >
            <div
                className="lightbox-content"
                style={{
                    transform: dismissing
                        ? "translateY(100vh)"
                        : `translateY(${dismissY}px)`,
                    transition: dismissing ? "transform 0.25s ease-in" : dismissY === 0 ? "transform 0.2s ease-out" : "none",
                }}
                onClick={e => e.stopPropagation()}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
            >
                <img
                    src={src}
                    alt={alt ?? ""}
                    className="lightbox-img"
                    draggable={false}
                    style={{
                        transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`,
                        transition: isDragging ? "none" : "transform 0.2s ease-out",
                        cursor: scale > 1 ? "grab" : "zoom-in",
                    }}
                    onClick={handleTap}
                />
            </div>
            <button className="lightbox-close" onClick={onClose} aria-label="Close">✕</button>
        </div>,
        document.body
    )
}
