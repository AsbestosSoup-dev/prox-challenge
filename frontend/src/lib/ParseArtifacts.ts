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