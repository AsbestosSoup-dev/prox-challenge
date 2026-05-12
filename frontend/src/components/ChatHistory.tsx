import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { History, Plus, Trash2 } from "lucide-react"
import type { Chat } from "../types"

interface Props {
    chats: Chat[]
    activeChatId: string | null
    onSelectChat: (chat: Chat) => void
    onNewChat: () => void
    onDeleteChat: (id: string) => void
}

export default function ChatHistory({
                                        chats,
                                        activeChatId,
                                        onSelectChat,
                                        onNewChat,
                                        onDeleteChat,
                                    }: Props) {
    return (
        <Sheet>
            <SheetTrigger asChild>
                <button className="icon-btn" aria-label="Chat history">
                    <History size={20} />
                </button>
            </SheetTrigger>

            <SheetContent side="left" className="sheet-panel">
                <SheetHeader>
                    <SheetTitle className="sheet-title">Chats</SheetTitle>
                </SheetHeader>

                <button className="new-chat-btn" onClick={onNewChat}>
                    <Plus size={16} />
                    New chat
                </button>

                <Separator className="my-3" />

                <ScrollArea className="chat-list-scroll">
                    {chats.length === 0 ? (
                        <p className="chat-list-empty">No previous chats</p>
                    ) : (
                        <ul className="chat-list">
                            {chats.map((chat) => (
                                <li
                                    key={chat.id}
                                    className={`chat-list-item ${chat.id === activeChatId ? "chat-list-item--active" : ""}`}
                                >
                                    <button
                                        className="chat-list-btn"
                                        onClick={() => onSelectChat(chat)}
                                    >
                                        <span className="chat-list-title">{chat.title}</span>
                                        <span className="chat-list-date">
                      {new Date(chat.createdAt).toLocaleDateString()}
                    </span>
                                    </button>
                                    <button
                                        className="chat-delete-btn"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onDeleteChat(chat.id)
                                        }}
                                        aria-label="Delete chat"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </ScrollArea>
            </SheetContent>
        </Sheet>
    )
}