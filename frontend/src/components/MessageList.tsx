import { useEffect, useRef, useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import MessageBubble from "./MessageBubble"
import type { Message } from "../types"
import { useIsDark } from "../lib/ThemeContext"

const PENDING_MESSAGES = [
    "Searching manual…",
    "Reading diagrams…",
    "Cross-referencing specs…",
    "Generating response…",
]

function WeldingPending() {
    const [msgIdx, setMsgIdx] = useState(0)
    const [visible, setVisible] = useState(true)

    useEffect(() => {
        const t = setInterval(() => {
            setVisible(false)
            setTimeout(() => {
                setMsgIdx(i => (i + 1) % PENDING_MESSAGES.length)
                setVisible(true)
            }, 300)
        }, 2200)
        return () => clearInterval(t)
    }, [])

    return (
        <div className="welding-pending">
            <svg className="welding-arc" viewBox="0 0 64 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Electrode */}
                <rect x="10" y="2" width="4" height="16" rx="1.5" fill="var(--text-dim)" />
                {/* Workpiece */}
                <rect x="4" y="24" width="56" height="5" rx="2" fill="var(--surface3)" stroke="var(--border-bright)" strokeWidth="0.75" />
                {/* Arc column */}
                <line x1="12" y1="18" x2="12" y2="24" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" className="arc-column" />
                {/* Core glow */}
                <ellipse cx="12" cy="23" rx="3" ry="2" fill="var(--accent)" className="arc-core" />
                {/* Spark particles */}
                <circle cx="18" cy="20" r="1.2" fill="#f5c542" className="spark spark-1" />
                <circle cx="7"  cy="19" r="1"   fill="#f5a020" className="spark spark-2" />
                <circle cx="21" cy="23" r="0.9" fill="var(--accent)" className="spark spark-3" />
                <circle cx="5"  cy="22" r="1"   fill="#f5c542" className="spark spark-4" />
                <circle cx="15" cy="17" r="0.8" fill="#fff8e0" className="spark spark-5" />
                {/* Weld bead forming on workpiece */}
                <ellipse cx="12" cy="24" rx="6" ry="1.5" fill="var(--accent)" opacity="0.35" className="bead-glow" />
            </svg>
            <span className={`welding-pending-msg${visible ? " welding-pending-msg--visible" : ""}`}>
                {PENDING_MESSAGES[msgIdx]}
            </span>
        </div>
    )
}

const PROCESSES = [
    { id: "MIG",       label: "MIG",        query: "I want to set up for MIG welding. What do I need to know?" },
    { id: "TIG",       label: "TIG",        query: "I want to set up for TIG welding. Walk me through it." },
    { id: "Stick",     label: "Stick",      query: "I want to weld with Stick. What settings and polarity do I use?" },
    { id: "Flux-Core", label: "Flux-Core",  query: "I want to run flux-cored wire. What's the polarity setup and settings?" },
]

const LCD_LABELS: Record<string, string> = {
    "MIG":       "MIG",
    "TIG":       "TIG",
    "Stick":     "STICK",
    "Flux-Core": "FLUX-CORE",
}


interface Props {
    messages: (Message & { _raw?: string })[]
    isStreaming: boolean
    isPending: boolean
    onSuggestion: (text: string) => void
    activeProcess: string | null
    onProcessSelect: (process: string, query: string) => void
}

// Pair up messages into turns: [user, assistant?]
function groupIntoTurns(messages: (Message & { _raw?: string })[]) {
    const turns: Array<{ user: Message & { _raw?: string }; assistant?: Message & { _raw?: string }; idx: number }> = []
    let i = 0
    while (i < messages.length) {
        const msg = messages[i]
        if (msg.role === "user") {
            const next = messages[i + 1]
            turns.push({
                user: msg,
                assistant: next?.role === "assistant" ? next : undefined,
                idx: i,
            })
            i += next?.role === "assistant" ? 2 : 1
        } else {
            // orphan assistant (shouldn't happen, but handle gracefully)
            turns.push({ user: msg as any, assistant: msg, idx: i })
            i++
        }
    }
    return turns
}

export default function MessageList({ messages, isStreaming, isPending, onSuggestion, activeProcess, onProcessSelect }: Props) {
    const bottomRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    const isEmpty = messages.length === 0

    return (
        <ScrollArea className="messages-scroll">
            <div className="messages-inner">
                {isEmpty ? (
                    <EmptyState onSuggestion={onSuggestion} onProcessSelect={onProcessSelect} activeProcess={activeProcess} />
                ) : (
                    <>
                        {groupIntoTurns(messages).map((turn, t) => {
                            const isLastTurn = t === groupIntoTurns(messages).length - 1
                            return (
                                <div key={t} className="turn">
                                    <MessageBubble
                                        message={turn.user}
                                        isStreaming={false}
                                    />
                                    {turn.assistant && (
                                        <MessageBubble
                                            message={turn.assistant}
                                            isStreaming={isStreaming && isLastTurn && !!turn.assistant}
                                        />
                                    )}
                                </div>
                            )
                        })}
                        {isPending && <WeldingPending />}
                    </>
                )}
                <div ref={bottomRef} />
            </div>
        </ScrollArea>
    )
}

function EmptyState({ onSuggestion: _, onProcessSelect, activeProcess }: {
    onSuggestion: (s: string) => void
    onProcessSelect: (process: string, query: string) => void
    activeProcess: string | null
}) {
    return (
        <div className="welcome">
            <div className="welcome-machine">
                <MachineSVG lcdProcess={activeProcess} />
            </div>
            <p className="welcome-title">What do you need to know?</p>
            <p className="welcome-sub">Vulcan OmniPro 220</p>
            <p className="process-chips-label">Set up a process</p>
            <div className="process-chips">
                {PROCESSES.map((p) => (
                    <button
                        key={p.id}
                        className={`process-chip${activeProcess === p.id ? " process-chip--active" : ""}`}
                        onClick={() => onProcessSelect(p.id, p.query)}
                    >
                        {p.label}
                    </button>
                ))}
            </div>
        </div>
    )
}

// Accurate front panel schematic of the Vulcan OmniPro 220
// Source: manual page 8 diagram (labeled front panel controls).
// Sections top→bottom:
//   1. Handle (tubular, center-top)
//   2. Top control panel: VULCAN logo + ⚠ icons left, LCD center-right,
//      OMNIPRO 220 right, HOME knob+button below-left, BACK button right,
//      three downward-arrow knobs in a row below LCD (Left/Control/Right)
//   3. VULCAN fascia band
//   4. Middle section: MIG Gun socket area (left, with spool gun gas outlet),
//      Power switch (center), Cooling fins / Storage (right)
//   5. Bottom connector base: Gas Outlet (far-left small), torch icon,
//      Negative Socket, Wire Feed Power Cable, Positive Socket
function MachineSVG({ lcdProcess }: { lcdProcess?: string | null }) {
    const isDark = useIsDark()
    const W = 260
    const H = 370
    const cx = W / 2

    // Colors via CSS vars — SVG uses currentColor fallback
    const bg       = "var(--bg)"
    const surf     = "var(--surface)"
    const surf2    = "var(--surface2)"
    const surf3    = "var(--surface3)"
    const border   = "var(--border)"
    const borderBr = "var(--border-bright)"
    const textDim  = "var(--text-dim)"
    const textMut  = "var(--text-muted)"
    const accent   = "var(--accent)"

    const green    = "var(--green)"
    const mono     = "'JetBrains Mono', monospace"

    // Theme-dependent hardcoded colors
    const lcdBg      = isDark ? "#dde8e2" : "#c8ddd6"
    const lcdStroke  = isDark ? "#9ab0a8" : "#7a9890"
    const lcdText    = isDark ? "#1a2820" : "#0d1f18"
    const lcdBar     = isDark ? "#b0c4bc" : "#8aada4"
    const lcdBarTick = isDark ? "#c8d8d0" : "#a0b8b0"
    const lcdBarSel  = isDark ? "#6a8878" : "#4a6858"
    const torchBody  = isDark ? "#3a5040" : "#2a4030"
    const torchNeck  = isDark ? "#2a3830" : "#1a2820"
    const switchOn   = isDark ? "#182018" : "#2a3a2a"
    const connBase   = isDark ? "#141820" : surf3
    const panel      = isDark ? "#1a1e24" : surf2

    // knob helper — outer ring → body → inner cap → downward orange triangle indicator
    const Knob = ({ cx: kx, cy: ky, r = 20 }: { cx: number; cy: number; r?: number }) => (
        <g>
            <circle cx={kx} cy={ky} r={r + 4} fill={surf2} stroke={border} strokeWidth="1" />
            <circle cx={kx} cy={ky} r={r} fill={surf3} stroke={borderBr} strokeWidth="1.5" />
            <circle cx={kx} cy={ky} r={r * 0.55} fill={surf2} stroke={border} strokeWidth="0.75" />
            {/* Downward-pointing orange triangle (like in manual diagram) */}
            <polygon
                points={`${kx - 5},${ky + r - 8} ${kx + 5},${ky + r - 8} ${kx},${ky + r + 1}`}
                fill={accent}
            />
        </g>
    )

    return (
        <svg
            viewBox={`0 0 ${W} ${H}`}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ width: "100%", maxWidth: 210, height: "auto", display: "block", margin: "0 auto" }}
            aria-hidden="true"
        >
            {/* ── 1. Outer body ───────────────────────────────────────── */}
            <rect x="12" y="10" width={W - 24} height={H - 14} rx="12"
                fill={surf} stroke={border} strokeWidth="1.5" />

            {/* ── 2. Top control panel ─────────────────────────────────── */}
            <rect x="12" y="34" width="236" height="182" rx="6"
                fill={panel} stroke={border} strokeWidth="1" />

            {/* VULCAN logo top-left of panel */}
            <text x="26" y="52" fill={isDark ? "white" : textMut} fontSize="9" fontFamily={mono} fontWeight="800" letterSpacing="1">VULCAN</text>
            {/* Warning / indicator icons beside logo */}
            <text x="26" y="63" fill={textDim} fontSize="7" fontFamily={mono}>⚠  ▮▮</text>

            {/* OMNIPRO 220 top-right */}
            <text x={W - 22} y="50" textAnchor="end" fill={textMut} fontSize="7" fontFamily={mono} letterSpacing="0.5">OMNIPRO®</text>
            <text x={W - 22} y="62" textAnchor="end" fill={accent} fontSize="12" fontFamily={mono} fontWeight="700">220</text>

            {/* HOME button — horizontally centered between left edge and LCD, vertically centered on LCD */}
            <rect x="30" y="91" width="22" height="20" rx="3"
                fill={surf3} stroke={borderBr} strokeWidth="1" />

            {/* BACK button — horizontally centered between LCD right edge and right edge, vertically centered on LCD */}
            <rect x="208" y="91" width="22" height="20" rx="3"
                fill={surf3} stroke={borderBr} strokeWidth="1" />

            {/* LCD — narrow, centered */}
            <rect x="70" y="66" width="120" height="70" rx="4"
                fill={lcdBg} stroke={lcdStroke} strokeWidth="1" />
            {/* Process name */}
            <text x={cx} y="100" textAnchor="middle"
                fill={lcdText} fontSize="11" fontFamily={mono} fontWeight="600">
                {lcdProcess ? LCD_LABELS[lcdProcess] ?? lcdProcess : "OMNIPRO 220"}
            </text>
            {/* Torch icon */}
            <g transform={`translate(${cx - 18}, 102)`}>
                <rect x="4" y="5" width="20" height="7" rx="3" fill={torchBody} />
                <rect x="21" y="6" width="7" height="5" rx="2" fill={torchNeck} />
                <line x1="28" y1="8.5" x2="33" y2="5" stroke="#c8922a" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="28" y1="8.5" x2="34" y2="8.5" stroke="#c8922a" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="28" y1="8.5" x2="33" y2="12" stroke="#c8922a" strokeWidth="1.5" strokeLinecap="round" />
                <rect x="0" y="3" width="7" height="11" rx="2" fill={torchNeck} />
            </g>
            {/* Settings bar at LCD bottom */}
            <rect x="70" y="128" width="120" height="8" rx="4" fill={lcdBar} />
            {[0,1,2,3,4,5,6,7].map(i => (
                <rect key={i} x={73 + i * 13} y="130" width="10" height="4"
                    rx="1" fill={i === 3 ? lcdBarSel : lcdBarTick} />
            ))}

            {/* Three knobs — A and V smaller (r=15), CTRL larger (r=20) */}
            <Knob cx={58}  cy={180} r={15} />
            <Knob cx={cx}  cy={180} r={20} />
            <Knob cx={W - 58} cy={180} r={15} />

            {/* ── 3. VULCAN fascia band ────────────────────────────────── */}
            <rect x="12" y="218" width={W - 24} height="28" rx="4"
                fill={surf2} stroke={border} strokeWidth="1" />
            <text x={cx} y="237" textAnchor="middle"
                fill={borderBr} fontSize="14" fontFamily={mono} fontWeight="900" letterSpacing="4">VULCAN</text>

            {/* ── 4. Middle section ────────────────────────────────────── */}
            <rect x="12" y="248" width={W - 24} height="62" rx="4"
                fill={surf2} stroke={border} strokeWidth="1" />

            {/* LEFT: MIG/Spool Gun Cable Socket — rectangular hole with rounded corners */}
            <rect x="18" y="254" width="68" height="50" rx="5"
                fill={bg} stroke={borderBr} strokeWidth="1" />
            {/* socket circle — centered vertically, near right side of hole */}
            <circle cx="64" cy="279" r="13" fill={surf3} stroke={borderBr} strokeWidth="1.5" />
            <circle cx="64" cy="279" r="9" fill={bg} stroke={border} strokeWidth="0.75" />
            {[0,1,2,3,4].map(i => {
                const a = (i / 5) * Math.PI * 2 - Math.PI / 2
                return <circle key={i} cx={64 + 5 * Math.cos(a)} cy={279 + 5 * Math.sin(a)} r="1.5" fill={borderBr} />
            })}
            <circle cx="64" cy="279" r="1.5" fill={borderBr} />

            {/* CENTER: Power switch */}
            <rect x="98" y="260" width="30" height="36" rx="3"
                fill={surf3} stroke={borderBr} strokeWidth="1" />
            <rect x="100" y="262" width="26" height="15" rx="2" fill={switchOn} stroke={border} strokeWidth="0.5" />
            <text x="113" y="273" textAnchor="middle" fill={green} fontSize="9" fontFamily={mono} fontWeight="700">I</text>
            <rect x="100" y="279" width="26" height="13" rx="2" fill={surf2} stroke={border} strokeWidth="0.5" />
            <text x="113" y="289" textAnchor="middle" fill={textDim} fontSize="9" fontFamily={mono}>O</text>

            {/* RIGHT: Horizontal cooling fins */}
            <rect x="136" y="252" width={W - 150} height="54" rx="4"
                fill={surf3} stroke={border} strokeWidth="0.75" />
            {Array.from({ length: 8 }, (_, k) => (
                <rect key={k} x="139" y={255 + k * 6} width={W - 157} height="4"
                    rx="1" fill={surf} stroke={border} strokeWidth="0.5" />
            ))}

            {/* ── 5. Bottom connector base ─────────────────────────────── */}
            <rect x="12" y="312" width={W - 24} height="48" rx="6"
                fill={connBase} stroke={borderBr} strokeWidth="1.5" />

            {/* Spool Gun Gas Outlet */}
            <circle cx="52" cy="336" r="17" fill={surf2} stroke={borderBr} strokeWidth="1.5" />
            <circle cx="52" cy="336" r="12" fill="#8a6818" stroke="#c09030" strokeWidth="1.5" />
            <circle cx="52" cy="336" r="5.5" fill="#5a4010" />

            {/* Negative Socket (−) */}
            <circle cx="130" cy="336" r="17" fill={surf2} stroke={borderBr} strokeWidth="1.5" />
            <circle cx="130" cy="336" r="12" fill="#8a6818" stroke="#c09030" strokeWidth="1.5" />
            <circle cx="130" cy="336" r="5.5" fill="#5a4010" />

            {/* Wire Feed Power Cable — smaller, midpoint between NEG and POS */}
            <circle cx="169" cy="344" r="10" fill={surf2} stroke={borderBr} strokeWidth="1.25" />
            <circle cx="169" cy="344" r="6.5" fill="#8a6818" stroke="#c09030" strokeWidth="1" />
            <circle cx="169" cy="344" r="3" fill="#5a4010" />

            {/* Positive Socket (+) */}
            <circle cx="208" cy="336" r="17" fill={surf2} stroke={borderBr} strokeWidth="1.5" />
            <circle cx="208" cy="336" r="12" fill="#8a6818" stroke="#c09030" strokeWidth="1.5" />
            <circle cx="208" cy="336" r="5.5" fill="#5a4010" />
        </svg>
    )
}
