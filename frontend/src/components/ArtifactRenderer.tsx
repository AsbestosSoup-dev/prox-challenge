import type { Artifact } from "../types"

function buildSrcDoc(artifact: Artifact): string {
    if (artifact.type === "application/vnd.ant.react") {
        const cleaned = artifact.content
            .replace(/import\s+.*?from\s+['"]react['"]/g, '')
            .replace(/export default function\s+(\w+)/, (_, name) => `function ${name}`)
            .replace(/export default\s+(\w+)/, '')

        // Extract the component name from "export default function Name" or guess last function
        const nameMatch = artifact.content.match(/export default function\s+(\w+)/)
        const componentName = nameMatch ? nameMatch[1] : null

        const renderCall = componentName
            ? `ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(${componentName}));`
            : `console.error('Could not find default export to render');`

        return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.development.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.development.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.2/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { margin: 0; padding: 16px; background: #ffffff; font-family: sans-serif; }
    * { box-sizing: border-box; }
  </style>
</head>
<body>
  <div id="root"></div>
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
<html>
<head>
  <style>
    body { margin: 0; padding: 16px; display: flex; align-items: center; justify-content: center; background: #fff; }
    svg { max-width: 100%; height: auto; }
  </style>
</head>
<body>${artifact.content}</body>
</html>`
    }

    if (artifact.type === "text/html") {
        return artifact.content
    }

    return `<pre style="margin:0;padding:16px;font-size:13px;overflow:auto;background:#f8f8f8">${artifact.content}</pre>`
}

interface Props {
    artifact: Artifact
}

export default function ArtifactRenderer({ artifact }: Props) {
    return (
        <div className="artifact-card">
            <div className="artifact-header">
                <span className="artifact-badge">
                    {artifact.type.split("/").pop()?.replace("vnd.ant.", "")}
                </span>
                <span className="artifact-title">{artifact.title}</span>
            </div>
            <iframe
                srcDoc={buildSrcDoc(artifact)}
                sandbox="allow-scripts"
                title={artifact.title}
                className="artifact-iframe"
            />
        </div>
    )
}