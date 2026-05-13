import { useEffect, useRef } from "react"
import type { Artifact } from "../types"
import { useIsDark } from "../lib/ThemeContext"

const DARK_VARS = `
  --bg: #0a0c0e; --surface: #13161a; --surface2: #1a1e24; --surface3: #22272f;
  --border: #2a2f38; --border-bright: #3d4554; --accent: #c8922a;
  --text: #e8eaf0; --text-muted: #8892a4; --text-dim: #525c6e;
  color-scheme: dark;
`
const LIGHT_VARS = `
  --bg: #f5f6f8; --surface: #ffffff; --surface2: #eef0f3; --surface3: #e4e7eb;
  --border: #d0d4dc; --border-bright: #b0b8c8; --accent: #b07820;
  --text: #0d0f12; --text-muted: #505868; --text-dim: #8892a4;
  color-scheme: light;
`

function themeStyle(isDark: boolean) {
    return `
    <style>
      :root { ${isDark ? DARK_VARS : LIGHT_VARS} }
      body {
        margin: 0; padding: 16px;
        background: var(--bg);
        color: var(--text);
        font-family: system-ui, sans-serif;
      }
      * { box-sizing: border-box; }
    </style>`
}

function buildSrcDoc(artifact: Artifact, isDark: boolean): string {
    if (artifact.type === "application/vnd.ant.react") {
        const cleaned = artifact.content
            .replace(/import\s+.*?from\s+['"]react['"]/g, '')
            .replace(/export default function\s+(\w+)/, (_, name) => `function ${name}`)
            .replace(/export default\s+(\w+)/, '')

        const nameMatch = artifact.content.match(/export default function\s+(\w+)/)
        const componentName = nameMatch ? nameMatch[1] : null
        const renderCall = componentName
            ? `ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(${componentName}));`
            : `console.error('Could not find default export to render');`

        return `<!DOCTYPE html>
<html class="${isDark ? "dark" : ""}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.development.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.development.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.2/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config = { darkMode: 'class' }</script>
  ${themeStyle(isDark)}
</head>
<body>
  <div id="root"></div>
  <script>
    window.addEventListener('message', (e) => {
      if (e.data?.type === 'theme') {
        document.documentElement.className = e.data.isDark ? 'dark' : ''
        const s = document.getElementById('__theme_vars__')
        if (s) s.textContent = ':root{' + (e.data.isDark ? \`${DARK_VARS}\` : \`${LIGHT_VARS}\`) + '}'
      }
    })
  </script>
  <style id="__theme_vars__"></style>
  <script type="text/babel">
    const { useState, useEffect, useRef, useCallback } = React;
    ${cleaned}
    ${renderCall}
  </script>
</body>
</html>`
    }

    if (artifact.type === "image/svg+xml") {
        return `<!DOCTYPE html>
<html class="${isDark ? "dark" : ""}">
<head>
  ${themeStyle(isDark)}
  <style>
    body { display: flex; align-items: center; justify-content: center; }
    svg { max-width: 100%; height: auto; }
  </style>
</head>
<body>${artifact.content}</body>
</html>`
    }

    if (artifact.type === "text/html") {
        return artifact.content
    }

    return `<pre style="margin:0;padding:16px;font-size:13px;overflow:auto">${artifact.content}</pre>`
}

interface Props {
    artifact: Artifact
}

export default function ArtifactRenderer({ artifact }: Props) {
    const isDark = useIsDark()
    const iframeRef = useRef<HTMLIFrameElement>(null)

    // post theme updates to already-loaded iframe
    useEffect(() => {
        iframeRef.current?.contentWindow?.postMessage({ type: "theme", isDark }, "*")
    }, [isDark])

    return (
        <div className="artifact-card">
            <div className="artifact-header">
                <span className="artifact-badge">
                    {artifact.type.split("/").pop()?.replace("vnd.ant.", "")}
                </span>
                <span className="artifact-title">{artifact.title}</span>
            </div>
            <iframe
                ref={iframeRef}
                srcDoc={buildSrcDoc(artifact, isDark)}
                sandbox="allow-scripts"
                title={artifact.title}
                className="artifact-iframe"
            />
        </div>
    )
}
