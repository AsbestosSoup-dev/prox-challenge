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

    const [completingTo100, setCompletingTo100] = useState(false)

    useEffect(() => {
        if (!completing) return
        if (!beadRef.current) return
        const trackWidth = beadRef.current.parentElement!.offsetWidth
        const beadWidth = beadRef.current.getBoundingClientRect().width
        const pct = trackWidth > 0 ? (beadWidth / trackWidth) * 100 : 0
        setFrozenPct(pct)
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

// ─── Spec card detection ──────────────────────────────────────────────────────
// Looks for patterns like "250 A", "10–100%", "14 lb", "60 Hz" in text
interface SpecEntry { label: string; value: string; unit: string }

const SPEC_VALUE_RE = /^(\d[\d,./–-]*)\s*([A-Za-z%°][A-Za-z%°/²³]*)?\s*$/

function extractSpecs(text: string): SpecEntry[] | null {
    // Only trigger when text looks like a spec list: multiple "label: value" lines
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean)
    const specs: SpecEntry[] = []
    for (const line of lines) {
        const colonIdx = line.indexOf(":")
        if (colonIdx < 3 || colonIdx > 40) continue
        const label = line.slice(0, colonIdx).replace(/^[-*•]\s*/, "").trim()
        const rest = line.slice(colonIdx + 1).trim()
        const m = SPEC_VALUE_RE.exec(rest)
        if (!m) continue
        specs.push({ label, value: m[1], unit: m[2] ?? "" })
    }
    return specs.length >= 2 ? specs : null
}

// ─── Inline rendering ─────────────────────────────────────────────────────────
function renderInline(text: string) {
    return text.split(/(\*\*[^*]+\*\*|\[[^\]]+\])/g).map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**"))
            return <strong key={i}>{part.slice(2, -2)}</strong>
        if (part.startsWith("[") && part.endsWith("]"))
            return <span key={i} className="citation">{part}</span>
        return part
    })
}

// ─── Block parser ─────────────────────────────────────────────────────────────
type Block =
    | { type: "p"; text: string }
    | { type: "h1"; text: string }
    | { type: "h2"; text: string }
    | { type: "h3"; text: string }
    | { type: "ul"; items: string[] }
    | { type: "ol"; items: string[] }
    | { type: "table"; rows: string[][] }
    | { type: "specs"; entries: SpecEntry[] }

function parseBlocks(text: string): Block[] {
    const normalized = text
        .replace(/(\n\n)(?=\d+[.)]\s)/g, "\n")
        .replace(/(\n\n)(?=[-*]\s)/g, "\n")
    const lines = normalized.split("\n")
    const blocks: Block[] = []

    let i = 0
    while (i < lines.length) {
        const line = lines[i].trim()
        if (!line || /^-{3,}$/.test(line)) { i++; continue }

        if (/^#{1,3}\s/.test(line)) {
            const level = line.match(/^(#{1,3})\s/)![1].length as 1 | 2 | 3
            const t = line.replace(/^#{1,3}\s+/, "")
            blocks.push({ type: `h${level}` as "h1" | "h2" | "h3", text: t })
            i++
            continue
        }

        if (/^[-*]\s/.test(line)) {
            const items: string[] = []
            while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) {
                items.push(lines[i].trim().replace(/^[-*]\s*/, ""))
                i++
            }
            blocks.push({ type: "ul", items })
            continue
        }

        if (/^\d+[.)]\s/.test(line)) {
            const items: string[] = []
            while (i < lines.length && /^\d+[.)]\s/.test(lines[i].trim())) {
                items.push(lines[i].trim().replace(/^\d+[.)]\s*/, ""))
                i++
            }
            blocks.push({ type: "ol", items })
            continue
        }

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

        // Paragraph — accumulate
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
        if (textLines.length) {
            const joined = textLines.join("\n")
            const specs = extractSpecs(joined)
            if (specs) {
                blocks.push({ type: "specs", entries: specs })
            } else {
                blocks.push({ type: "p", text: textLines.join(" ") })
            }
        }
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
                if (block.type === "specs") return (
                    <div key={i} className="spec-grid">
                        {block.entries.map((s, j) => (
                            <div key={j} className="spec-card">
                                <div className="spec-value">
                                    {s.value}
                                    {s.unit && <span className="spec-unit">{s.unit}</span>}
                                </div>
                                <div className="spec-label">{s.label}</div>
                            </div>
                        ))}
                    </div>
                )
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

// ─── Source pages ─────────────────────────────────────────────────────────────
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

// ─── Main component ───────────────────────────────────────────────────────────
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

    // ── User message ──────────────────────────────────────────────────────────
    if (message.role === "user") {
        const hasImages = (message.image_data?.length ?? 0) > 0
        return (
            <div className="turn-query">
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, maxWidth: "75%" }}>
                    {hasImages && (
                        <div className="query-images">
                            {message.image_data!.map((img, i) => {
                                const src = `data:${message.image_type?.[i] ?? "image/jpeg"};base64,${img}`
                                return (
                                    <img
                                        key={i}
                                        src={src}
                                        alt="uploaded"
                                        className="query-image"
                                        onClick={() => setLightbox({ src, alt: "uploaded image" })}
                                    />
                                )
                            })}
                        </div>
                    )}
                    <div className="query-pill">{message.content}</div>
                </div>
                {lightbox && <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
            </div>
        )
    }

    // ── Assistant — artifact loading ──────────────────────────────────────────
    const artifactInProgress = isStreaming && isArtifactInProgress(raw)

    if (artifactInProgress || showCompleting) {
        const textBefore = getTextBeforeArtifact(raw)
        return (
            <div className="turn-answer">
                {textBefore && <AssistantText text={textBefore} />}
                <ArtifactLoadingWidget raw={raw} completing={showCompleting} />
            </div>
        )
    }

    // ── Assistant — full render ───────────────────────────────────────────────
    const { before, artifacts, after } = parseArtifactsSplit(raw)
    const canShowArtifacts = showArtifact || !isStreaming
    const hasCitations = /\[\d+\]/.test(raw)

    return (
        <div className="turn-answer">
            {before && <AssistantText text={before} />}
            {canShowArtifacts && artifacts.map((artifact) => (
                <ArtifactRenderer key={artifact.identifier} artifact={artifact} />
            ))}
            {canShowArtifacts && after && <AssistantText text={after} />}
            {canShowArtifacts && hasCitations && message.source_pages && message.source_pages.length > 0 && (
                <SourcePages pages={message.source_pages} />
            )}
        </div>
    )
}
