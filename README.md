# Proxy – Vulcan OmniPro 220 AI Assistant

A multimodal AI assistant for the Vulcan OmniPro 220 welder, built on the Claude Agent SDK. Ask it anything about the machine — it answers with text, interactive diagrams, calculators, and source pages from the manual.

**Live demo:** https://prox-challenge-eosin.vercel.app

![App screenshot](product.webp)

## Features

- **Deep technical accuracy** — answers questions that require cross-referencing multiple manual sections, including duty cycle matrices, polarity setups, wire feed calibration, and troubleshooting
- **Multimodal responses** — generates interactive React artifacts on the fly: wiring diagrams, duty cycle calculators, troubleshooting flowcharts, settings configurators
- **Source page surfacing** — when a response is grounded in a specific manual page, the relevant page images are shown inline
- **Voice I/O** — microphone input (speech-to-text) and spoken responses (text-to-speech) via ElevenLabs, optional
- **Streaming** — responses stream token by token with a live artifact loading animation

## Running locally

**Requirements:** Python 3.12+, [Bun](https://bun.sh)

```bash
git clone <repo>
cd <repo>
cp .env.example .env   # add your ANTHROPIC_API_KEY
./start.sh
```

Open [http://localhost:5173](http://localhost:5173).

The start script sets up the Python virtualenv, installs dependencies for both backend and frontend, and starts both servers. `Ctrl+C` stops everything.

### Environment variables

```
ANTHROPIC_API_KEY=...         # required
ELEVENLABS_API_KEY=...        # optional — enables voice input and TTS
```

## Architecture

```
PDF manuals
   └─ pdf_processing.py
        ├─ Rasterizes every page to PNG (PyMuPDF)
        │      └─ saved to backend/cache/pages/
        ├─ Extracts text per page
        │      └─ saved to backend/cache/metadata.json
        └─ Generates sentence-transformer embeddings
               └─ saved to backend/cache/embeddings.npy

User query
   └─ FastAPI /chat endpoint
        ├─ Embeds query → cosine similarity → top-k pages
        ├─ Attaches page metadata as text context
        ├─ Attaches page images as vision context
        └─ Streams response via Claude Agent SDK (SSE)
             └─ React frontend
                  ├─ Renders text responses and <antartifact> blocks as live iframes
                  └─ Surfaces source page thumbnails when cited
```

### Key design decisions

**Image-first RAG.** The OmniPro 220 manual contains critical information that only exists as images — the welding process selection chart, weld diagnosis photos, wiring schematics, polarity diagrams. Text extraction alone misses all of this. Every page is rasterized and sent to Claude as a vision input alongside the text, so the model can read diagrams directly.

**Claude Artifacts.** The agent is prompted to generate `<antartifact>` blocks containing self-contained React components. The frontend detects these, sandboxes them in iframes with injected CSS variables for light/dark theming, and renders them inline. This enables interactive outputs — calculators, flowcharts, schematic diagrams — that are far more useful than text descriptions for a physical machine setup context.

**Streaming with artifact animation.** Artifact generation takes several seconds. Rather than show nothing, the UI renders a live "welding bead" progress animation while tokens stream in, transitioning smoothly to the rendered artifact when complete.
