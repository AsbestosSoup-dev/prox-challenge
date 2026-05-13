import { useEffect, useRef, useState } from "react"
import { parseArtifactsSplit } from "../lib/ParseArtifacts"
import ArtifactRenderer from "./ArtifactRenderer"
import Lightbox from "./Lightbox"
import type { Message, SourcePage } from "../types"

interface Props {
    message: Message & { _raw?: string }
    isStreaming?: boolean
}

function getTextBeforeArtifact(raw: string): string {
    const openIdx = raw.indexOf("<antartifact")
    if (openIdx === -1) return raw
    return raw.slice(0, openIdx).trim()
}

function isArtifactInProgress(raw: string): boolean {
    return raw.includes("<antartifact") && !raw.includes("</antartifact>")
}

function getArtifactMeta(raw: string): { title: string; type: string } {
    const tag = raw.slice(raw.indexOf("<antartifact"))
    const title = tag.match(/title="([^"]+)"/)?.[1] ?? ""
    const type = tag.match(/type="([^"]+)"/)?.[1] ?? ""
    return { title, type }
}

function artifactLabel(type: string, title: string): string {
    if (title) return title
    if (type.includes("react")) return "Interactive component"
    if (type.includes("svg")) return "Diagram"
    if (type.includes("html")) return "Visual layout"
    return "Artifact"
}

const ESTIMATED_SECONDS = 20
const COMPLETE_MS = 500

function ArtifactLoadingWidget({ raw, completing }: { raw: string; completing: boolean }) {
    const [elapsed, setElapsed] = useState(0)
    const startRef = useRef(Date.now())
    const beadRef = useRef<HTMLDivElement>(null)
    const headRef = useRef<HTMLDivElement>(null)
    const [frozenPct, setFrozenPct] = useState<number | null>(null)
    const { title, type } = getArtifactMeta(raw)
    const label = artifactLabel(type, title)

    useEffect(() => {
        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
        }, 1000)
        return () => clearInterval(interval)
    }, [])

    // Step 1: when completing starts, freeze bead at current rendered width
    // Step 2: next frame, set width to 100% — CSS transition does the rest
    const [completingTo100, setCompletingTo100] = useState(false)

    useEffect(() => {
        if (!completing) return
        if (!beadRef.current) return
        const trackWidth = beadRef.current.parentElement!.offsetWidth
        const beadWidth = beadRef.current.getBoundingClientRect().width
        const pct = trackWidth > 0 ? (beadWidth / trackWidth) * 100 : 0
        setFrozenPct(pct)
        // next frame: trigger transition to 100%
        requestAnimationFrame(() => {
            requestAnimationFrame(() => setCompletingTo100(true))
        })
    }, [completing])

    const normalDur = `${ESTIMATED_SECONDS}s`

    return (
        <div className="artifact-loading">
            <div className="artifact-loading-header">
                <span className="artifact-loading-dots">
                    <span /><span /><span />
                </span>
                <span className="artifact-loading-label">
                    {completing ? "Done" : `Building ${label}${elapsed > 0 ? ` — ${elapsed}s` : "…"}`}
                </span>
            </div>
            <div className="artifact-weld-track">
                <div
                    ref={beadRef}
                    className="artifact-weld-bead"
                    style={completing && frozenPct !== null
                        ? {
                            animation: "none",
                            width: completingTo100 ? "100%" : `${frozenPct}%`,
                            transition: completingTo100 ? `width ${COMPLETE_MS}ms ease-in` : "none",
                          }
                        : { animationDuration: normalDur }
                    }
                />
                <div
                    ref={headRef}
                    className="artifact-weld-head"
                    style={completing && frozenPct !== null
                        ? {
                            animation: "none",
                            left: completingTo100 ? "100%" : `${frozenPct}%`,
                            transition: completingTo100 ? `left ${COMPLETE_MS}ms ease-in` : "none",
                          }
                        : { animationDuration: normalDur }
                    }
                >
                    <div className="artifact-weld-spark-core" />
                    {[0,1,2,3,4,5].map(i => (
                        <div key={i} className={`artifact-weld-particle artifact-weld-particle--${i}`} />
                    ))}
                </div>
            </div>
        </div>
    )
}

export default function MessageBubble({ message, isStreaming }: Props) {
    const [showCompleting, setShowCompleting] = useState(false)
    const [showArtifact, setShowArtifact] = useState(false)
    const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)
    const wasLoadingRef = useRef(false)

    const raw = message._raw ?? message.content
    const hadArtifact = isArtifactInProgress(raw) || raw.includes("</antartifact>")

    useEffect(() => {
        if (isStreaming && hadArtifact) {
            wasLoadingRef.current = true
        }
        if (!isStreaming && wasLoadingRef.current) {
            wasLoadingRef.current = false
            setShowCompleting(true)
            setTimeout(() => {
                setShowCompleting(false)
                setShowArtifact(true)
            }, COMPLETE_MS + 100)
        }
    }, [isStreaming, hadArtifact])

    if (message.role === "user") {
        return (
            <div className="msg-row msg-user">
                <div className="bubble bubble-user">
                    {message.image_data?.map((img, i) => {
                        const src = `data:${message.image_type?.[i] ?? "image/jpeg"};base64,${img}`
                        return (
                            <img
                                key={i}
                                src={src}
                                alt="uploaded"
                                className="uploaded-image"
                                onClick={() => setLightbox({ src, alt: "uploaded image" })}
                                style={{ cursor: "zoom-in" }}
                            />
                        )
                    })}
                    <span>{message.content}</span>
                </div>
                {lightbox && <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
            </div>
        )
    }

    const artifactInProgress = isStreaming && isArtifactInProgress(raw)

    // Show loading widget while streaming or briefly completing
    if (artifactInProgress || showCompleting) {
        const textBefore = getTextBeforeArtifact(raw)
        return (
            <div className="msg-row msg-assistant">
                <div className="proxy-avatar">P</div>
                <div className="assistant-body">
                    {textBefore && (
                        <div className="bubble bubble-assistant">
                            <AssistantText text={textBefore} />
                        </div>
                    )}
                    <ArtifactLoadingWidget raw={raw} completing={showCompleting} />
                    {/* post-artifact text is intentionally hidden until artifact renders */}
                </div>
            </div>
        )
    }

    const { before, artifacts, after } = parseArtifactsSplit(raw)
    // For history messages (not currently streaming), always show everything immediately
    const canShowArtifacts = showArtifact || !isStreaming

    return (
        <div className="msg-row msg-assistant">
            <div className="proxy-avatar">P</div>
            <div className="assistant-body">
                {before && (
                    <div className="bubble bubble-assistant">
                        <AssistantText text={before} />
                    </div>
                )}
                {canShowArtifacts && artifacts.map((artifact) => (
                    <ArtifactRenderer key={artifact.identifier} artifact={artifact} />
                ))}
                {canShowArtifacts && after && (
                    <div className="bubble bubble-assistant">
                        <AssistantText text={after} />
                    </div>
                )}
                {canShowArtifacts && message.source_pages && message.source_pages.length > 0 && (
                    <SourcePages pages={message.source_pages} />
                )}
            </div>
        </div>
    )
}

function SourcePages({ pages }: { pages: SourcePage[] }) {
    const [open, setOpen] = useState(false)
    const [visible, setVisible] = useState(false)
    const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)

    const toggle = () => {
        if (!open) {
            setOpen(true)
            requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
        } else {
            setVisible(false)
            setTimeout(() => setOpen(false), 280)
        }
    }

    return (
        <div className="source-pages">
            <button className="source-pages-toggle" onClick={toggle}>
                {open ? "▲" : "▼"} {pages.length} source page{pages.length !== 1 ? "s" : ""}
            </button>
            {open && (
                <div className={`source-pages-grid${visible ? " source-pages-grid--visible" : ""}`}>
                    {pages.map((p, i) => (
                        <div key={i} className="source-page-thumb" onClick={() => setLightbox({ src: `data:image/png;base64,${p.base64}`, alt: `${p.source} p.${p.page}` })}>
                            <img src={`data:image/png;base64,${p.base64}`} alt={`${p.source} p.${p.page}`} />
                            <span className="source-page-label">{p.source} p.{p.page}</span>
                        </div>
                    ))}
                </div>
            )}
            {lightbox && <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
        </div>
    )
}

function renderInline(text: string) {
    return text.split(/(\*\*[^*]+\*\*|\[[^\]]+\])/g).map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**"))
            return <strong key={i}>{part.slice(2, -2)}</strong>
        if (part.startsWith("[") && part.endsWith("]"))
            return <span key={i} className="citation">{part}</span>
        return part
    })
}

type Block =
    | { type: "p"; text: string }
    | { type: "h1"; text: string }
    | { type: "h2"; text: string }
    | { type: "h3"; text: string }
    | { type: "ul"; items: string[] }
    | { type: "ol"; items: string[] }
    | { type: "table"; rows: string[][] }

function parseBlocks(text: string): Block[] {
    // Collapse double newlines between list items so they're treated as one block
    const normalized = text
        .replace(/(\n\n)(?=\d+[.)]\s)/g, "\n")
        .replace(/(\n\n)(?=[-*]\s)/g, "\n")
    const lines = normalized.split("\n")
    const blocks: Block[] = []

    let i = 0
    while (i < lines.length) {
        const line = lines[i].trim()

        if (!line || /^-{3,}$/.test(line)) { i++; continue }

        // Headings
        if (/^#{1,3}\s/.test(line)) {
            const level = line.match(/^(#{1,3})\s/)![1].length as 1 | 2 | 3
            const text = line.replace(/^#{1,3}\s+/, "")
            blocks.push({ type: `h${level}` as "h1" | "h2" | "h3", text })
            i++
            continue
        }

        // Bullet list
        if (/^[-*]\s/.test(line)) {
            const items: string[] = []
            while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) {
                items.push(lines[i].trim().replace(/^[-*]\s*/, ""))
                i++
            }
            blocks.push({ type: "ul", items })
            continue
        }

        // Numbered list
        if (/^\d+[.)]\s/.test(line)) {
            const items: string[] = []
            while (i < lines.length && /^\d+[.)]\s/.test(lines[i].trim())) {
                items.push(lines[i].trim().replace(/^\d+[.)]\s*/, ""))
                i++
            }
            blocks.push({ type: "ol", items })
            continue
        }

        // Table
        if (/^\|/.test(line)) {
            const rows: string[][] = []
            while (i < lines.length && /^\|/.test(lines[i].trim())) {
                const row = lines[i].trim()
                if (!/^\|[-| :]+\|$/.test(row)) {
                    rows.push(row.split("|").slice(1, -1).map(c => c.trim()))
                }
                i++
            }
            if (rows.length) blocks.push({ type: "table", rows })
            continue
        }

        // Paragraph — accumulate until blank line or list/table/heading start
        const textLines: string[] = []
        while (
            i < lines.length &&
            lines[i].trim() &&
            !/^[-*]\s/.test(lines[i].trim()) &&
            !/^\d+[.)]\s/.test(lines[i].trim()) &&
            !/^\|/.test(lines[i].trim()) &&
            !/^-{3,}$/.test(lines[i].trim()) &&
            !/^#{1,3}\s/.test(lines[i].trim())
        ) {
            textLines.push(lines[i].trim())
            i++
        }
        if (textLines.length) blocks.push({ type: "p", text: textLines.join(" ") })
    }

    return blocks
}

function AssistantText({ text }: { text: string }) {
    const blocks = parseBlocks(text)
    return (
        <>
            {blocks.map((block, i) => {
                if (block.type === "h1") return <h1 key={i} className="assistant-h1">{renderInline(block.text)}</h1>
                if (block.type === "h2") return <h2 key={i} className="assistant-h2">{renderInline(block.text)}</h2>
                if (block.type === "h3") return <h3 key={i} className="assistant-h3">{renderInline(block.text)}</h3>
                if (block.type === "ul") return (
                    <ul key={i} className="assistant-text assistant-list">
                        {block.items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
                    </ul>
                )
                if (block.type === "ol") return (
                    <ol key={i} className="assistant-text assistant-list">
                        {block.items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
                    </ol>
                )
                if (block.type === "table") return (
                    <table key={i} className="assistant-table">
                        <tbody>
                            {block.rows.map((row, j) => (
                                <tr key={j}>
                                    {row.map((cell, k) => j === 0
                                        ? <th key={k}>{renderInline(cell)}</th>
                                        : <td key={k}>{renderInline(cell)}</td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )
                return <p key={i} className="assistant-text">{renderInline(block.text)}</p>
            })}
        </>
    )
}