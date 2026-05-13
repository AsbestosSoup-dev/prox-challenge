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
// Based on manual page 8 + product photos.
// Layout (portrait): handle top, VULCAN/OMNIPRO header, LCD center with
// HOME+BACK flanking, three knobs below (Left/Control/Right), power switch,
// bottom connector row (torch socket, negative, positive).
function MachineSVG() {
    // viewBox: 260 wide × 380 tall — portrait, fits the actual panel proportions
    const W = 260
    const H = 390
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

    return (
        <svg
            viewBox={`0 0 ${W} ${H}`}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ width: "100%", maxWidth: 200, height: "auto", display: "block", margin: "0 auto" }}
            aria-hidden="true"
        >
            {/* ── Outer body ─────────────────────────────────────────── */}
            <rect x="10" y="28" width={W - 20} height={H - 36} rx="10"
                fill={surf} stroke={border} strokeWidth="1.5" />

            {/* ── Carry handle (tube, top center) ────────────────────── */}
            {/* Left leg */}
            <rect x="68" y="16" width="10" height="24" rx="5" fill={surf2} stroke={border} strokeWidth="1" />
            {/* Right leg */}
            <rect x={W - 78} y="16" width="10" height="24" rx="5" fill={surf2} stroke={border} strokeWidth="1" />
            {/* Bar */}
            <rect x="70" y="10" width={W - 140} height="14" rx="7" fill={surf3} stroke={borderBr} strokeWidth="1" />

            {/* ── Header band ────────────────────────────────────────── */}
            {/* Orange left accent strip (mimics orange side panel peeking in) */}
            <rect x="10" y="28" width="18" height="44" rx="5"
                fill="#c85a00" stroke="none" />
            {/* "VULCAN" text */}
            <text x="38" y="50" fill={textMut} fontSize="10" fontFamily={mono}
                fontWeight="700" letterSpacing="1.5">VULCAN</text>
            {/* "OMNIPRO" orange + "220" */}
            <text x={W - 22} y="43" fill={accent} fontSize="8" fontFamily={mono}
                fontWeight="600" letterSpacing="0.5" textAnchor="end">OMNIPRO</text>
            <text x={W - 22} y="54" fill={accentBr} fontSize="11" fontFamily={mono}
                fontWeight="700" letterSpacing="0.5" textAnchor="end">220</text>

            {/* Thin divider */}
            <line x1="14" y1="74" x2={W - 14} y2="74" stroke={border} strokeWidth="0.75" />

            {/* ── LCD display ────────────────────────────────────────── */}
            {/* LCD outer bezel */}
            <rect x="44" y="82" width={W - 88} height="88" rx="5"
                fill={surf2} stroke={borderBr} strokeWidth="1" />
            {/* LCD screen (white-ish, like a real transflective LCD) */}
            <rect x="50" y="88" width={W - 100} height="76" rx="3"
                fill="#dde8e0" stroke="#aab8b0" strokeWidth="0.75" />
            {/* Process name on LCD */}
            <text x={cx} y="118" textAnchor="middle"
                fill="#1a2820" fontSize="13" fontFamily={mono} fontWeight="600"
                letterSpacing="0.5">MIG Steel C25</text>
            {/* Weld icon — simplified torch silhouette */}
            <g transform={`translate(${cx - 14}, 122)`}>
                {/* torch body */}
                <rect x="2" y="6" width="24" height="8" rx="3" fill="#3a5040" />
                {/* nozzle */}
                <rect x="22" y="8" width="8" height="4" rx="2" fill="#2a3830" />
                {/* arc sparks */}
                <line x1="30" y1="10" x2="36" y2="6" stroke="#c8922a" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="30" y1="10" x2="36" y2="10" stroke="#c8922a" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="30" y1="10" x2="36" y2="14" stroke="#c8922a" strokeWidth="1.5" strokeLinecap="round" />
                {/* handle */}
                <rect x="0" y="4" width="6" height="12" rx="2" fill="#2a3830" />
            </g>
            {/* Bottom info bar on LCD */}
            <rect x="50" y="154" width={W - 100} height="10" rx="0"
                fill="#b8c8c0" />
            {/* Small setting icons row */}
            {[0,1,2,3,4,5,6,7,8].map(i => (
                <rect key={i} x={53 + i * 15} y="156" width="10" height="6"
                    rx="1" fill={i === 3 ? "#6a8878" : "#c8d8d0"} />
            ))}

            {/* HOME button — left of LCD */}
            <rect x="16" y="96" width="24" height="22" rx="4"
                fill={surf3} stroke={borderBr} strokeWidth="1" />
            <text x="28" y="111" textAnchor="middle"
                fill={textDim} fontSize="7" fontFamily={mono}>HOME</text>

            {/* BACK button — right of LCD */}
            <rect x={W - 40} y="96" width="24" height="22" rx="4"
                fill={surf3} stroke={borderBr} strokeWidth="1" />
            <text x={W - 28} y="111" textAnchor="middle"
                fill={textDim} fontSize="7" fontFamily={mono}>BACK</text>

            {/* ── Three knobs row ─────────────────────────────────────── */}
            {/* Left knob: wire feed / current (⊕ A) */}
            {/* Center knob: main control (larger) */}
            {/* Right knob: voltage (V) */}

            {/* knob helper: outer ring, inner knob body, indicator line */}
            {/* Left knob */}
            <circle cx="58" cy="224" r="26" fill={surf2} stroke={border} strokeWidth="1" />
            <circle cx="58" cy="224" r="20" fill={surf3} stroke={borderBr} strokeWidth="1.5" />
            <circle cx="58" cy="224" r="12" fill={surf2} stroke={border} strokeWidth="0.75" />
            {/* orange arrow indicator */}
            <polygon points="54,208 58,200 62,208" fill={accent} />
            <text x="58" y="258" textAnchor="middle" fill={textDim} fontSize="8" fontFamily={mono}>⊕  A</text>

            {/* Center main control knob (larger) */}
            <circle cx={cx} cy="222" r="30" fill={surf2} stroke={border} strokeWidth="1" />
            <circle cx={cx} cy="222" r="23" fill={surf3} stroke={borderBr} strokeWidth="1.5" />
            <circle cx={cx} cy="222" r="14" fill={surf2} stroke={border} strokeWidth="0.75" />
            <polygon points={`${cx-5},205 ${cx},196 ${cx+5},205`} fill={accent} />
            <text x={cx} y="260" textAnchor="middle" fill={textDim} fontSize="8" fontFamily={mono}>CONTROL</text>

            {/* Right knob: voltage */}
            <circle cx={W - 58} cy="224" r="26" fill={surf2} stroke={border} strokeWidth="1" />
            <circle cx={W - 58} cy="224" r="20" fill={surf3} stroke={borderBr} strokeWidth="1.5" />
            <circle cx={W - 58} cy="224" r="12" fill={surf2} stroke={border} strokeWidth="0.75" />
            <polygon points={`${W-62},208 ${W-58},200 ${W-54},208`} fill={accent} />
            <text x={W - 58} y="258" textAnchor="middle" fill={textDim} fontSize="8" fontFamily={mono}>V</text>

            {/* ── Middle section: Storage | Power Switch | Cooling fins ── */}
            {/* Background band */}
            <rect x="14" y="268" width={W - 28} height="46" rx="4"
                fill={surf2} stroke={border} strokeWidth="0.75" />

            {/* Storage compartment door — left third */}
            <rect x="18" y="272" width="62" height="38" rx="4"
                fill={surf3} stroke={borderBr} strokeWidth="1" />
            {/* Finger-pull hole */}
            <circle cx="49" cy="295" r="8" fill={bg} stroke={border} strokeWidth="1" />
            <circle cx="49" cy="295" r="4" fill={surf} stroke={borderBr} strokeWidth="0.75" />

            {/* Power switch — center */}
            {/* Switch housing */}
            <rect x="94" y="276" width="30" height="34" rx="3"
                fill={surf3} stroke={borderBr} strokeWidth="1" />
            {/* I (on) rocker — top half, green tint */}
            <rect x="96" y="278" width="26" height="13" rx="2" fill="#1a2a1a" stroke={border} strokeWidth="0.5" />
            <text x="109" y="288" textAnchor="middle" fill={green} fontSize="9" fontFamily={mono} fontWeight="700">I</text>
            {/* O (off) rocker — bottom half */}
            <rect x="96" y="293" width="26" height="13" rx="2" fill={surf2} stroke={border} strokeWidth="0.5" />
            <text x="109" y="303" textAnchor="middle" fill={textDim} fontSize="9" fontFamily={mono}>O</text>

            {/* Cooling fins — right third, horizontal slats */}
            {Array.from({ length: 6 }, (_, k) => (
                <rect key={k}
                    x="132" y={274 + k * 6}
                    width={W - 148} height="4"
                    rx="1"
                    fill={surf} stroke={border} strokeWidth="0.5" />
            ))}

            {/* Spool Gun Gas Outlet — small barbed nipple above fins */}
            <circle cx={W - 22} cy="264" r="5" fill={surf3} stroke={borderBr} strokeWidth="1" />
            <circle cx={W - 22} cy="264" r="2.5" fill={bg} />
            <text x={W - 22} y="258" textAnchor="middle" fill={textDim} fontSize="6" fontFamily={mono}>GAS</text>

            {/* ── Connector strip ──────────────────────────────────────── */}
            {/* Lower sub-panel */}
            <rect x="10" y="318" width={W - 20} height="50" rx="4"
                fill={surf3} stroke={borderBr} strokeWidth="1" />

            {/* 1. Multi-pin control socket (torch/trigger) — far left */}
            <circle cx="35" cy="343" r="14" fill={surf2} stroke={borderBr} strokeWidth="1.5" />
            <circle cx="35" cy="343" r="9" fill={bg} stroke={border} strokeWidth="0.75" />
            {[0,1,2,3,4].map(i => {
                const angle = (i / 5) * Math.PI * 2 - Math.PI / 2
                return <circle key={i} cx={35 + 5 * Math.cos(angle)} cy={343 + 5 * Math.sin(angle)} r="1.5" fill={borderBr} />
            })}
            <circle cx="35" cy="343" r="1.5" fill={borderBr} />
            <text x="35" y="362" textAnchor="middle" fill={textDim} fontSize="6" fontFamily={mono}>CTRL</text>

            {/* 2. Wire Feed Power Cable stud — gold */}
            <circle cx="72" cy="343" r="12" fill={surf2} stroke={borderBr} strokeWidth="1.5" />
            <circle cx="72" cy="343" r="7" fill="#7a6020" stroke="#a08030" strokeWidth="1" />
            <text x="72" y="362" textAnchor="middle" fill={textDim} fontSize="6" fontFamily={mono}>WIRE</text>

            {/* Torch icon label between wire and neg */}
            <text x="103" y="340" textAnchor="middle" fill={textDim} fontSize="9" fontFamily={mono}>⊙</text>

            {/* 3. Negative socket — gold */}
            <circle cx="130" cy="343" r="12" fill={surf2} stroke={borderBr} strokeWidth="1.5" />
            <circle cx="130" cy="343" r="7" fill="#7a6020" stroke="#a08030" strokeWidth="1" />
            <text x="130" y="347" textAnchor="middle" fill="#d4a830" fontSize="10" fontFamily={mono} fontWeight="700">−</text>
            <text x="130" y="362" textAnchor="middle" fill={textDim} fontSize="6" fontFamily={mono}>NEG</text>

            {/* 4. Positive socket — gold */}
            <circle cx="175" cy="343" r="12" fill={surf2} stroke={borderBr} strokeWidth="1.5" />
            <circle cx="175" cy="343" r="7" fill="#7a6020" stroke="#a08030" strokeWidth="1" />
            <text x="175" y="347" textAnchor="middle" fill="#d4a830" fontSize="10" fontFamily={mono} fontWeight="700">+</text>
            <text x="175" y="362" textAnchor="middle" fill={textDim} fontSize="6" fontFamily={mono}>POS</text>

            {/* 5. Far-right stud */}
            <circle cx="218" cy="343" r="12" fill={surf2} stroke={borderBr} strokeWidth="1.5" />
            <circle cx="218" cy="343" r="7" fill="#7a6020" stroke="#a08030" strokeWidth="1" />
        </svg>
    )
}
