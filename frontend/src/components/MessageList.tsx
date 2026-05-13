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
                    <div className="welcome">
                        <p className="welcome-title">What do you need to know?</p>
                        <p className="welcome-sub">Ask anything about your Vulcan OmniPro 220</p>
                        <div className="suggestions">
                            {SUGGESTIONS.map((s) => (
                                <button
                                    key={s}
                                    className="suggestion-chip"
                                    onClick={() => onSuggestion(s)}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
                        {messages.map((msg, i) => (
                            <MessageBubble
                                key={i}
                                message={msg}
                                isStreaming={isStreaming && i === messages.length - 1}
                            />
                        ))}
                        {isPending && (
                            <div className="msg-row msg-assistant">
                                <div className="proxy-avatar">P</div>
                                <div className="typing-dots">
                                    <span /><span /><span />
                                </div>
                            </div>
                        )}
                    </>
                )}
                <div ref={bottomRef} />
            </div>
        </ScrollArea>
    )
}