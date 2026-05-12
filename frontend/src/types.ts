export interface SourcePage {
    source: string
    page: number
    base64: string
}

export interface Message {
    role: "user" | "assistant"
    content: string
    image_data?: string[]
    image_type?: string[]
    source_pages?: SourcePage[]
}

export interface Artifact {
    identifier: string
    type: string
    title: string
    content: string
}

export interface Chat {
    id: string
    title: string
    messages: Message[]
    createdAt: Date
}

export interface TokenUsage {
    inputTokens: number
    outputTokens: number
}