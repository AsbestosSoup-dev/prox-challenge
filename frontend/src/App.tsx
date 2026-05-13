import {useCallback, useRef, useState} from "react"
import {Moon, Sun, Volume2, VolumeX} from "lucide-react"
import MessageList from "./components/MessageList"
import InputBar from "./components/InputBar"
import ChatHistory from "./components/ChatHistory"
import type {Chat, Message} from "./types"
import proxLogo from "./assets/prox.svg?url"
import {useTTS} from "./lib/useTTS"

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://127.0.0.1:8000"

function generateId(): string {
    return Math.random().toString(36).slice(2)
}

function generateChatTitle(firstMessage: string): string {
    return firstMessage.length > 40 ? firstMessage.slice(0, 40) + "…" : firstMessage
}

export default function App() {
    const [isDark, setIsDark] = useState(true)
    const [audioEnabled, setAudioEnabled] = useState(false)
    const [messages, setMessages] = useState<(Message & { _raw?: string })[]>([])
    const [input, setInput] = useState("")
    const [isStreaming, setIsStreaming] = useState(false)
    const [isPending, setIsPending] = useState(false)
    const [pendingImages, setPendingImages] = useState<{ data: string; type: string }[]>([])
    const [chats, setChats] = useState<Chat[]>([])
    const [activeChatId, setActiveChatId] = useState<string | null>(null)
    const rawBufferRef = useRef("")
    const pendingPagesRef = useRef<any[] | null>(null)
    const { speak, stop } = useTTS()

    const startNewChat = useCallback(() => {
        if (messages.length > 0 && activeChatId) {
            setChats((prev) =>
                prev.map((c) => (c.id === activeChatId ? {...c, messages} : c))
            )
        }
        setMessages([])
        setInput("")
        setPendingImages([])
        setActiveChatId(null)
    }, [messages, activeChatId])

    const selectChat = useCallback((chat: Chat) => {
        setMessages(chat.messages)
        setActiveChatId(chat.id)
        setInput("")
        setPendingImages([])
    }, [])

    const deleteChat = useCallback((id: string) => {
        setChats((prev) => prev.filter((c) => c.id !== id))
        if (activeChatId === id) {
            setMessages([])
            setActiveChatId(null)
        }
    }, [activeChatId])

    const sendMessage = useCallback(async () => {
        const text = input.trim()
        if (!text || isStreaming) return

        const userMsg: Message = {
            role: "user",
            content: text,
            ...(pendingImages.length > 0 && {
                image_data: pendingImages.map((i) => i.data),
                image_type: pendingImages.map((i) => i.type),
            }),
        }

        const newMessages = [...messages, userMsg]
        setMessages(newMessages)
        setInput("")
        setPendingImages([])
        stop()
        setIsStreaming(true)
        setIsPending(true)
        rawBufferRef.current = ""
        pendingPagesRef.current = null

        let chatId = activeChatId
        if (!chatId) {
            chatId = generateId()
            setActiveChatId(chatId)
            const newChat: Chat = {
                id: chatId,
                title: generateChatTitle(text),
                messages: [],
                createdAt: new Date(),
            }
            setChats((prev) => [newChat, ...prev])
        }

        try {
            const response = await fetch(`${BACKEND_URL}/chat`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({messages: newMessages}),
            })

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`)
            }

            const reader = response.body!.getReader()
            const decoder = new TextDecoder()
            let sseBuffer = ""

            while (true) {
                const {done, value} = await reader.read()
                if (done) break

                sseBuffer += decoder.decode(value, { stream: true })
                const lines = sseBuffer.split("\n")
                sseBuffer = lines.pop() ?? ""

                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue
                    try {
                        const event = JSON.parse(line.slice(6))

                        if (event.type === "pages") {
                            pendingPagesRef.current = event.pages
                        } else if (event.type === "delta") {
                            rawBufferRef.current += event.text
                            const raw = rawBufferRef.current
                            const pages = pendingPagesRef.current
                            setIsPending(false)
                            setMessages((prev) => {
                                const last = prev[prev.length - 1]
                                const placeholder: Message & { _raw: string } = last?.role === "assistant"
                                    ? { ...last, _raw: last._raw ?? "" }
                                    : { role: "assistant", content: "", _raw: "" }
                                const updated = last?.role === "assistant" ? [...prev] : [...prev, placeholder]
                                updated[updated.length - 1] = {
                                    ...updated[updated.length - 1],
                                    ...(pages !== null && { source_pages: pages }),
                                    _raw: raw,
                                    content: raw
                                        .replace(/<antartifact[\s\S]*?<\/antartifact>/g, "")
                                        .trim(),
                                } as any
                                return updated
                            })
                        } else if (event.type === "done") {
                            setIsStreaming(false)
                            if (audioEnabled) {
                                const textOnly = rawBufferRef.current
                                    .replace(/<antartifact[\s\S]*?<\/antartifact>/g, "")
                                    .trim()
                                speak(textOnly)
                            }
                        }
                    } catch {
                        // skip malformed lines
                    }
                }
            }
        } catch (err) {
            console.error(err)
            setMessages((prev) => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                last.content = "Something went wrong. Please try again."
                return updated
            })
            setIsStreaming(false)
            setIsPending(false)
        }
    }, [input, messages, isStreaming, pendingImages, activeChatId, audioEnabled, speak, stop])

    return (
        <div className={`app ${isDark ? "dark" : "light"}`}>
            <div className="header-outer">


                <header className="header">
                    <div className="header-left">
                        <ChatHistory
                            chats={chats}
                            activeChatId={activeChatId}
                            onSelectChat={selectChat}
                            onNewChat={startNewChat}
                            onDeleteChat={deleteChat}
                        />
                        <img src={proxLogo} alt="Prox" className="prox-logo"/>
                        <span className="header-model">OmniPro 220</span>
                    </div>

                    <div className="header-center">
                        <span className="header-title">Ask Proxy</span>
                    </div>

                    <div className="header-right">
                        <button
                            className={`icon-btn${audioEnabled ? " icon-btn--active" : ""}`}
                            onClick={() => {
                                if (audioEnabled) stop()
                                setAudioEnabled((a) => !a)
                            }}
                        >
                            {audioEnabled ? <Volume2 size={18}/> : <VolumeX size={18}/>}
                        </button>
                        <button className="icon-btn" onClick={() => setIsDark((d) => !d)}>
                            {isDark ? <Moon size={18}/> : <Sun size={18}/>}
                        </button>
                    </div>
                </header>
            </div>

            <MessageList
                messages={messages}
                isStreaming={isStreaming}
                isPending={isPending}
                onSuggestion={(s) => setInput(s)}
            />

            <div className="input-outer">
            <InputBar
                value={input}
                onChange={setInput}
                onSend={sendMessage}
                isStreaming={isStreaming}
                pendingImages={pendingImages}
                onImagesAdd={(imgs) => setPendingImages((prev) => [...prev, ...imgs])}
                onImageRemove={(i) => setPendingImages((prev) => prev.filter((_, j) => j !== i))}
            />
            </div>
        </div>
    )
}