import type { Artifact } from "../types"

function extractAttr(tag: string, attr: string): string {
    const m = tag.match(new RegExp(`${attr}="([^"]+)"`))
    return m ? m[1] : ""
}

export function parseArtifacts(raw: string): { text: string; artifacts: Artifact[] } {
    const artifacts: Artifact[] = []

    const text = raw
        .replace(/<antartifact\b([^>]*)>([\s\S]*?)<\/antartifact>/g, (_, attrs, content) => {
            artifacts.push({
                identifier: extractAttr(attrs, "identifier"),
                type: extractAttr(attrs, "type"),
                title: extractAttr(attrs, "title"),
                content: content.trim(),
            })
            return ""
        })
        .replace(/\n{3,}/g, "\n\n")
        .trim()

    return { text, artifacts }
}

export function parseArtifactsSplit(raw: string): { before: string; artifacts: Artifact[]; after: string } {
    const artifacts: Artifact[] = []
    const artifactRegex = /<antartifact\b([^>]*)>([\s\S]*?)<\/antartifact>/g

    let lastIndex = 0
    let before = ""
    let after = ""
    let match: RegExpExecArray | null

    while ((match = artifactRegex.exec(raw)) !== null) {
        if (artifacts.length === 0) {
            before = raw.slice(0, match.index).replace(/\n{3,}/g, "\n\n").trim()
        }
        artifacts.push({
            identifier: extractAttr(match[1], "identifier"),
            type: extractAttr(match[1], "type"),
            title: extractAttr(match[1], "title"),
            content: match[2].trim(),
        })
        lastIndex = match.index + match[0].length
    }

    if (artifacts.length > 0) {
        after = raw.slice(lastIndex).replace(/\n{3,}/g, "\n\n").trim()
    } else {
        before = raw.replace(/\n{3,}/g, "\n\n").trim()
    }

    return { before, artifacts, after }
}