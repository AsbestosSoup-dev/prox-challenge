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

// Schematic-style SVG of a multi-process welder front panel
function MachineSVG() {
    return (
        <svg
            viewBox="0 0 460 240"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ width: "100%", height: "auto", display: "block" }}
            aria-hidden="true"
        >
            {/* Machine body */}
            <rect x="8" y="20" width="444" height="200" rx="10" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5" />

            {/* Top handle rail */}
            <rect x="160" y="8" width="140" height="16" rx="8" fill="var(--surface2)" stroke="var(--border)" strokeWidth="1" />

            {/* Left panel — ports */}
            <rect x="22" y="36" width="100" height="168" rx="6" fill="var(--surface2)" stroke="var(--border)" strokeWidth="1" />

            {/* Negative port */}
            <circle cx="52" cy="72" r="14" fill="var(--bg)" stroke="var(--border-bright)" strokeWidth="1.5" />
            <circle cx="52" cy="72" r="7" fill="var(--surface3)" />
            <text x="52" y="76.5" textAnchor="middle" fill="var(--text-dim)" fontSize="9" fontFamily="monospace">−</text>
            <text x="52" y="94" textAnchor="middle" fill="var(--text-dim)" fontSize="9" fontFamily="monospace">WORK</text>

            {/* Positive port */}
            <circle cx="92" cy="72" r="14" fill="var(--bg)" stroke="var(--border-bright)" strokeWidth="1.5" />
            <circle cx="92" cy="72" r="7" fill="var(--surface3)" />
            <text x="92" y="76.5" textAnchor="middle" fill="var(--text-dim)" fontSize="9" fontFamily="monospace">+</text>
            <text x="92" y="94" textAnchor="middle" fill="var(--text-dim)" fontSize="9" fontFamily="monospace">GUN</text>

            {/* Gas port */}
            <rect x="44" y="106" width="36" height="20" rx="4" fill="var(--bg)" stroke="var(--border)" strokeWidth="1" />
            <text x="62" y="120" textAnchor="middle" fill="var(--text-dim)" fontSize="8" fontFamily="monospace">GAS</text>

            {/* Ground clamp port */}
            <rect x="44" y="136" width="36" height="20" rx="4" fill="var(--bg)" stroke="var(--border)" strokeWidth="1" />
            <text x="62" y="150" textAnchor="middle" fill="var(--text-dim)" fontSize="8" fontFamily="monospace">CLAMP</text>

            {/* Center panel — display */}
            <rect x="134" y="36" width="192" height="168" rx="6" fill="var(--bg)" stroke="var(--border)" strokeWidth="1" />

            {/* Process selector label row */}
            {["MIG","TIG","FLUX","STICK","ARC"].map((label, i) => (
                <g key={label}>
                    <rect
                        x={140 + i * 37}
                        y="44"
                        width="33"
                        height="18"
                        rx="3"
                        fill={i === 0 ? "var(--accent-dim)" : "var(--surface2)"}
                        stroke={i === 0 ? "var(--accent)" : "var(--border)"}
                        strokeWidth="0.75"
                    />
                    <text
                        x={156.5 + i * 37}
                        y="57"
                        textAnchor="middle"
                        fill={i === 0 ? "var(--accent)" : "var(--text-dim)"}
                        fontSize="7.5"
                        fontFamily="monospace"
                        fontWeight={i === 0 ? "600" : "400"}
                    >{label}</text>
                </g>
            ))}

            {/* Main digital display */}
            <rect x="140" y="70" width="180" height="60" rx="4" fill="#060809" stroke="var(--border)" strokeWidth="1" />
            {/* Segment display — amperage */}
            <text x="165" y="113" fill="var(--accent-bright)" fontSize="38" fontFamily="monospace" fontWeight="700" letterSpacing="-2">175</text>
            <text x="308" y="113" fill="var(--text-dim)" fontSize="14" fontFamily="monospace">A</text>

            {/* Voltage sub-display */}
            <rect x="140" y="138" width="84" height="30" rx="3" fill="#060809" stroke="var(--border)" strokeWidth="0.75" />
            <text x="152" y="158" fill="var(--text-muted)" fontSize="20" fontFamily="monospace" fontWeight="600">22.5</text>
            <text x="218" y="158" fill="var(--text-dim)" fontSize="10" fontFamily="monospace">V</text>

            {/* Wire speed sub-display */}
            <rect x="236" y="138" width="84" height="30" rx="3" fill="#060809" stroke="var(--border)" strokeWidth="0.75" />
            <text x="248" y="158" fill="var(--text-muted)" fontSize="20" fontFamily="monospace" fontWeight="600">280</text>
            <text x="314" y="158" fill="var(--text-dim)" fontSize="10" fontFamily="monospace">ipm</text>

            {/* Labels under sub-displays */}
            <text x="182" y="178" textAnchor="middle" fill="var(--text-dim)" fontSize="8" fontFamily="monospace" letterSpacing="0.5">VOLTAGE</text>
            <text x="278" y="178" textAnchor="middle" fill="var(--text-dim)" fontSize="8" fontFamily="monospace" letterSpacing="0.5">WIRE SPD</text>

            {/* Right panel — knobs */}
            <rect x="338" y="36" width="106" height="168" rx="6" fill="var(--surface2)" stroke="var(--border)" strokeWidth="1" />

            {/* Amperage knob */}
            <circle cx="368" cy="90" r="22" fill="var(--surface3)" stroke="var(--border-bright)" strokeWidth="1.5" />
            <circle cx="368" cy="90" r="14" fill="var(--surface2)" stroke="var(--border)" strokeWidth="1" />
            <line x1="368" y1="80" x2="368" y2="72" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
            <text x="368" y="120" textAnchor="middle" fill="var(--text-dim)" fontSize="8" fontFamily="monospace">AMPS</text>

            {/* Voltage knob */}
            <circle cx="414" cy="90" r="22" fill="var(--surface3)" stroke="var(--border-bright)" strokeWidth="1.5" />
            <circle cx="414" cy="90" r="14" fill="var(--surface2)" stroke="var(--border)" strokeWidth="1" />
            <line x1="414" y1="80" x2="421" y2="74" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
            <text x="414" y="120" textAnchor="middle" fill="var(--text-dim)" fontSize="8" fontFamily="monospace">VOLTS</text>

            {/* Power button */}
            <circle cx="368" cy="162" r="16" fill="var(--bg)" stroke="var(--border-bright)" strokeWidth="1.5" />
            <path d="M368 150 v6 M362 153 a10 10 0 1 0 12 0" stroke="var(--green)" strokeWidth="2" fill="none" strokeLinecap="round" />

            {/* Trigger / torch connector */}
            <rect x="396" y="148" width="32" height="28" rx="5" fill="var(--bg)" stroke="var(--border)" strokeWidth="1" />
            <circle cx="406" cy="158" r="3" fill="var(--border)" />
            <circle cx="416" cy="158" r="3" fill="var(--border)" />
            <circle cx="406" cy="168" r="3" fill="var(--border)" />
            <circle cx="416" cy="168" r="3" fill="var(--border)" />
            <text x="412" y="184" textAnchor="middle" fill="var(--text-dim)" fontSize="7.5" fontFamily="monospace">TORCH</text>

            {/* Bottom vent grille lines */}
            {Array.from({ length: 8 }, (_, k) => (
                <line key={k} x1={24 + k * 8} y1="208" x2={24 + k * 8} y2="216" stroke="var(--border)" strokeWidth="1" strokeLinecap="round" />
            ))}
            {Array.from({ length: 8 }, (_, k) => (
                <line key={k + 100} x1={336 + k * 8} y1="208" x2={336 + k * 8} y2="216" stroke="var(--border)" strokeWidth="1" strokeLinecap="round" />
            ))}

            {/* Brand label */}
            <text x="230" y="222" textAnchor="middle" fill="var(--text-dim)" fontSize="9" fontFamily="monospace" letterSpacing="2">VULCAN  OMNIPRO  220</text>
        </svg>
    )
}
