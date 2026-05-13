import { useEffect, useRef } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import MessageBubble from "./MessageBubble"
import type { Message } from "../types"

const SUGGESTIONS = [
    "What's the duty cycle at max amperage?",
    "How do I set up for MIG welding?",
    "Walk me through flux-cored polarity",
    "My arc keeps sputtering — what's wrong?",
]

interface Props {
    messages: (Message & { _raw?: string })[]
    isStreaming: boolean
    isPending: boolean
    onSuggestion: (text: string) => void
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

export default function MessageList({ messages, isStreaming, isPending, onSuggestion }: Props) {
    const bottomRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    const isEmpty = messages.length === 0

    return (
        <ScrollArea className="messages-scroll">
            <div className="messages-inner">
                {isEmpty ? (
                    <EmptyState onSuggestion={onSuggestion} />
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
                        {isPending && (
                            <div className="typing-dots">
                                <span /><span /><span />
                            </div>
                        )}
                    </>
                )}
                <div ref={bottomRef} />
            </div>
        </ScrollArea>
    )
}

function EmptyState({ onSuggestion }: { onSuggestion: (s: string) => void }) {
    return (
        <div className="welcome">
            <div className="welcome-machine">
                <MachineSVG />
            </div>
            <p className="welcome-title">What do you need to know?</p>
            <p className="welcome-sub">Vulcan OmniPro 220</p>
            <div className="suggestions">
                {SUGGESTIONS.map((s) => (
                    <button key={s} className="suggestion-chip" onClick={() => onSuggestion(s)}>
                        {s}
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
function MachineSVG() {
    const W = 260
    const H = 420
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
    const accentBr = "var(--accent-bright)"
    const green    = "var(--green)"
    const mono     = "'JetBrains Mono', monospace"

    // knob helper — outer ring → body → inner cap → downward orange triangle indicator
    const Knob = ({ cx: kx, cy: ky, r = 20, label }: { cx: number; cy: number; r?: number; label: string }) => (
        <g>
            <circle cx={kx} cy={ky} r={r + 4} fill={surf2} stroke={border} strokeWidth="1" />
            <circle cx={kx} cy={ky} r={r} fill={surf3} stroke={borderBr} strokeWidth="1.5" />
            <circle cx={kx} cy={ky} r={r * 0.55} fill={surf2} stroke={border} strokeWidth="0.75" />
            {/* Downward-pointing orange triangle (like in manual diagram) */}
            <polygon
                points={`${kx - 5},${ky + r - 8} ${kx + 5},${ky + r - 8} ${kx},${ky + r + 1}`}
                fill={accent}
            />
            <text x={kx} y={ky + r + 16} textAnchor="middle" fill={textDim} fontSize="7" fontFamily={mono}>{label}</text>
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
            <rect x="12" y="30" width={W - 24} height={H - 44} rx="12"
                fill={surf} stroke={border} strokeWidth="1.5" />

            {/* ── Carry handle ────────────────────────────────────────── */}
            <rect x="74" y="18" width="8" height="20" rx="4" fill={surf2} stroke={border} strokeWidth="1" />
            <rect x={W - 82} y="18" width="8" height="20" rx="4" fill={surf2} stroke={border} strokeWidth="1" />
            <rect x="74" y="10" width={W - 148} height="13" rx="6" fill={surf3} stroke={borderBr} strokeWidth="1" />

            {/* ── 2. Top control panel ─────────────────────────────────── */}
            <rect x="16" y="34" width={W - 32} height="170" rx="6"
                fill="#1a1e24" stroke={border} strokeWidth="1" />

            {/* VULCAN logo top-left of panel */}
            <text x="26" y="52" fill="white" fontSize="9" fontFamily={mono} fontWeight="800" letterSpacing="1">VULCAN</text>
            {/* Warning / indicator icons beside logo */}
            <text x="26" y="63" fill={textDim} fontSize="7" fontFamily={mono}>⚠  ▮▮</text>

            {/* OMNIPRO 220 top-right */}
            <text x={W - 22} y="50" textAnchor="end" fill={textMut} fontSize="7" fontFamily={mono} letterSpacing="0.5">OMNIPRO®</text>
            <text x={W - 22} y="62" textAnchor="end" fill={accent} fontSize="12" fontFamily={mono} fontWeight="700">220</text>

            {/* HOME button — square, left side below logo */}
            <rect x="20" y="70" width="22" height="20" rx="3"
                fill={surf3} stroke={borderBr} strokeWidth="1" />
            <text x="31" y="84" textAnchor="middle" fill={textDim} fontSize="6" fontFamily={mono}>HOME</text>

            {/* BACK button — square, right side */}
            <rect x={W - 42} y="70" width="22" height="20" rx="3"
                fill={surf3} stroke={borderBr} strokeWidth="1" />
            <text x={W - 31} y="84" textAnchor="middle" fill={textDim} fontSize="6" fontFamily={mono}>BACK</text>

            {/* LCD — inset, center of panel */}
            <rect x="48" y="66" width={W - 96} height="70" rx="4"
                fill="#dde8e2" stroke="#9ab0a8" strokeWidth="1" />
            {/* Process name */}
            <text x={cx} y="96" textAnchor="middle"
                fill="#1a2820" fontSize="11" fontFamily={mono} fontWeight="600">MIG Steel C25</text>
            {/* Torch icon */}
            <g transform={`translate(${cx - 18}, 98)`}>
                <rect x="4" y="5" width="20" height="7" rx="3" fill="#3a5040" />
                <rect x="21" y="6" width="7" height="5" rx="2" fill="#2a3830" />
                <line x1="28" y1="8.5" x2="33" y2="5" stroke="#c8922a" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="28" y1="8.5" x2="34" y2="8.5" stroke="#c8922a" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="28" y1="8.5" x2="33" y2="12" stroke="#c8922a" strokeWidth="1.5" strokeLinecap="round" />
                <rect x="0" y="3" width="7" height="11" rx="2" fill="#2a3830" />
            </g>
            {/* Settings bar at LCD bottom */}
            <rect x="48" y="128" width={W - 96} height="8" rx="0" fill="#b0c4bc" />
            {[0,1,2,3,4,5,6,7].map(i => (
                <rect key={i} x={51 + i * 17} y="130" width="12" height="4"
                    rx="1" fill={i === 3 ? "#6a8878" : "#c8d8d0"} />
            ))}

            {/* ⊕ A label left of knobs row */}
            <text x="24" y="175" textAnchor="middle" fill={textDim} fontSize="7" fontFamily={mono}>⊕ A</text>
            {/* V label right of knobs row */}
            <text x={W - 24} y="175" textAnchor="middle" fill={textDim} fontSize="7" fontFamily={mono}>V</text>

            {/* Three knobs — evenly spaced, same size, below LCD */}
            <Knob cx={58}  cy={168} r={18} label="LEFT" />
            <Knob cx={cx}  cy={168} r={18} label="CTRL" />
            <Knob cx={W - 58} cy={168} r={18} label="RIGHT" />

            {/* ── 3. VULCAN fascia band ────────────────────────────────── */}
            <rect x="12" y="206" width={W - 24} height="28" rx="4"
                fill={surf2} stroke={border} strokeWidth="1" />
            <text x={cx} y="225" textAnchor="middle"
                fill={borderBr} fontSize="14" fontFamily={mono} fontWeight="900" letterSpacing="4">VULCAN</text>

            {/* ── 4. Middle section ────────────────────────────────────── */}
            <rect x="12" y="236" width={W - 24} height="62" rx="4"
                fill={surf2} stroke={border} strokeWidth="1" />

            {/* LEFT: MIG/Spool Gun Cable Socket — rectangular hole with rounded corners */}
            {/* The "hole" is a recessed rectangle; socket circle sits near the right inner edge */}
            <rect x="18" y="242" width="68" height="50" rx="5"
                fill={bg} stroke={borderBr} strokeWidth="1" />
            {/* socket circle — centered vertically, near right side of hole */}
            <circle cx="71" cy="267" r="13" fill={surf3} stroke={borderBr} strokeWidth="1.5" />
            <circle cx="71" cy="267" r="9" fill={bg} stroke={border} strokeWidth="0.75" />
            {[0,1,2,3,4].map(i => {
                const a = (i / 5) * Math.PI * 2 - Math.PI / 2
                return <circle key={i} cx={71 + 5 * Math.cos(a)} cy={267 + 5 * Math.sin(a)} r="1.5" fill={borderBr} />
            })}
            <circle cx="71" cy="267" r="1.5" fill={borderBr} />
            <text x="44" y="300" textAnchor="middle" fill={textDim} fontSize="6" fontFamily={mono}>MIG/GUN</text>

            {/* CENTER: Power switch */}
            <rect x="98" y="248" width="30" height="36" rx="3"
                fill={surf3} stroke={borderBr} strokeWidth="1" />
            <rect x="100" y="250" width="26" height="15" rx="2" fill="#182018" stroke={border} strokeWidth="0.5" />
            <text x="113" y="261" textAnchor="middle" fill={green} fontSize="9" fontFamily={mono} fontWeight="700">I</text>
            <rect x="100" y="267" width="26" height="13" rx="2" fill={surf2} stroke={border} strokeWidth="0.5" />
            <text x="113" y="277" textAnchor="middle" fill={textDim} fontSize="9" fontFamily={mono}>O</text>

            {/* RIGHT: Horizontal cooling fins */}
            <rect x="136" y="240" width={W - 150} height="54" rx="4"
                fill={surf3} stroke={border} strokeWidth="0.75" />
            {Array.from({ length: 8 }, (_, k) => (
                <rect key={k} x="139" y={243 + k * 6} width={W - 157} height="4"
                    rx="1" fill={surf} stroke={border} strokeWidth="0.5" />
            ))}

            {/* ── 5. Bottom connector base ─────────────────────────────── */}
            <rect x="12" y="300" width={W - 24} height="56" rx="6"
                fill="#141820" stroke={borderBr} strokeWidth="1.5" />

            {/* Spool Gun Gas Outlet — far left, small circle */}
            <circle cx="28" cy="326" r="7" fill={surf3} stroke={borderBr} strokeWidth="1" />
            <circle cx="28" cy="326" r="3.5" fill={bg} />
            <text x="28" y="343" textAnchor="middle" fill={textDim} fontSize="5.5" fontFamily={mono}>GAS</text>

            {/* Negative Socket (−) — dead center of section */}
            <circle cx={cx} cy="322" r="17" fill={surf2} stroke={borderBr} strokeWidth="1.5" />
            <circle cx={cx} cy="322" r="12" fill="#8a6818" stroke="#c09030" strokeWidth="1.5" />
            <circle cx={cx} cy="322" r="5.5" fill="#5a4010" />
            <text x={cx} y="308" textAnchor="middle" fill={textMut} fontSize="8" fontFamily={mono} fontWeight="700">−</text>
            <text x={cx} y="347" textAnchor="middle" fill={textDim} fontSize="6" fontFamily={mono}>NEG</text>

            {/* Wire Feed Power Cable — smaller, between NEG and POS, lower */}
            {/* sits below vertical center, between cx and POS */}
            <circle cx="185" cy="334" r="10" fill={surf2} stroke={borderBr} strokeWidth="1.25" />
            <circle cx="185" cy="334" r="6.5" fill="#8a6818" stroke="#c09030" strokeWidth="1" />
            <circle cx="185" cy="334" r="3" fill="#5a4010" />
            <text x="185" y="350" textAnchor="middle" fill={textDim} fontSize="5.5" fontFamily={mono}>WIRE</text>

            {/* Positive Socket (+) — right */}
            <circle cx="222" cy="322" r="17" fill={surf2} stroke={borderBr} strokeWidth="1.5" />
            <circle cx="222" cy="322" r="12" fill="#8a6818" stroke="#c09030" strokeWidth="1.5" />
            <circle cx="222" cy="322" r="5.5" fill="#5a4010" />
            <text x="222" y="308" textAnchor="middle" fill={textMut} fontSize="8" fontFamily={mono} fontWeight="700">+</text>
            <text x="222" y="347" textAnchor="middle" fill={textDim} fontSize="6" fontFamily={mono}>POS</text>
        </svg>
    )
}
