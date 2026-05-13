import { useRef, useState, useEffect } from "react"
import { Textarea } from "@/components/ui/textarea"
import { ImageIcon, Mic, Send } from "lucide-react"

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://127.0.0.1:8000"

const HINTS = [
    "What's the duty cycle at max amperage?",
    "How do I set up for MIG welding?",
    "Walk me through flux-cored polarity",
    "My arc keeps sputtering — what's wrong?",
]

function SuggestionHint() {
    const [index, setIndex] = useState(0)
    const [visible, setVisible] = useState(true)

    useEffect(() => {
        const cycle = setInterval(() => {
            setVisible(false)
            setTimeout(() => {
                setIndex(i => (i + 1) % HINTS.length)
                setVisible(true)
            }, 400)
        }, 3000)
        return () => clearInterval(cycle)
    }, [])

    return (
        <p className={`suggestion-hint${visible ? " suggestion-hint--visible" : ""}`}>
            {HINTS[index]}
        </p>
    )
}

interface Props {
    value: string
    onChange: (value: string) => void
    onSend: () => void
    isStreaming: boolean
    pendingImages: { data: string; type: string }[]
    onImagesAdd: (images: { data: string; type: string }[]) => void
    onImageRemove: (index: number) => void
}

function readFilesAsBase64(files: File[]): Promise<{ data: string; type: string }[]> {
    return Promise.all(
        files.map(
            (file) =>
                new Promise<{ data: string; type: string }>((resolve) => {
                    const reader = new FileReader()
                    reader.onload = () => {
                        resolve({ data: (reader.result as string).split(",")[1], type: file.type })
                    }
                    reader.readAsDataURL(file)
                })
        )
    )
}

export default function InputBar({
    value,
    onChange,
    onSend,
    isStreaming,
    pendingImages,
    onImagesAdd,
    onImageRemove,
}: Props) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isRecording, setIsRecording] = useState(false)
    const [isTranscribing, setIsTranscribing] = useState(false)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const recordingStartRef = useRef<number>(0)
    const valueRef = useRef(value)
    valueRef.current = value

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const mediaRecorder = new MediaRecorder(stream)
            chunksRef.current = []

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data)
            }

            mediaRecorder.onstop = async () => {
                stream.getTracks().forEach((t) => t.stop())
                const blob = new Blob(chunksRef.current, { type: "audio/webm" })
                setIsTranscribing(true)
                try {
                    const formData = new FormData()
                    formData.append("audio", blob, "recording.webm")
                    const res = await fetch(`${BACKEND_URL}/transcribe`, {
                        method: "POST",
                        body: formData,
                    })
                    const json = await res.json()
                    if (json.text) {
                        onChange((valueRef.current ? valueRef.current + " " : "") + json.text)
                    }
                } catch {
                    // silently fail
                } finally {
                    setIsTranscribing(false)
                }
            }

            mediaRecorder.start(100)
            mediaRecorderRef.current = mediaRecorder
            recordingStartRef.current = Date.now()
            setIsRecording(true)
        } catch {
            // mic permission denied or not available
        }
    }

    const stopRecording = () => {
        // Clear visual state immediately
        setIsRecording(false)
        const elapsed = Date.now() - recordingStartRef.current
        const doStop = () => {
            mediaRecorderRef.current?.stop()
            mediaRecorderRef.current = null
        }
        // ensure at least 300ms of audio so the blob isn't empty
        const remaining = 300 - elapsed
        if (remaining > 0) setTimeout(doStop, remaining)
        else doStop()
    }

    const handleMicClick = () => {
        if (isTranscribing) return
        if (isRecording) stopRecording()
        else startRecording()
    }

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"))
        if (files.length) onImagesAdd(await readFilesAsBase64(files))
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    const handlePaste = async (e: React.ClipboardEvent) => {
        const imageFiles = Array.from(e.clipboardData.items)
            .filter((item) => item.type.startsWith("image/"))
            .map((item) => item.getAsFile())
            .filter((f): f is File => f !== null)
        if (imageFiles.length) {
            e.preventDefault()
            onImagesAdd(await readFilesAsBase64(imageFiles))
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            onSend()
        }
    }

    const canSend = value.trim().length > 0 && !isStreaming

    return (
        <div className="input-area">
            <SuggestionHint />
            {pendingImages.length > 0 && (
                <div className="pending-images">
                    {pendingImages.map((img, i) => (
                        <div key={i} className="pending-thumb">
                            <img src={`data:${img.type};base64,${img.data}`} alt="" />
                            <button className="thumb-remove" onClick={() => onImageRemove(i)}>×</button>
                        </div>
                    ))}
                </div>
            )}

            <div className="input-row">
                <button className="icon-btn" onClick={() => fileInputRef.current?.click()}>
                    <ImageIcon size={20} />
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    style={{ display: "none" }}
                />

                <Textarea
                    value={value}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder={isRecording ? "Recording…" : isTranscribing ? "Transcribing…" : "Ask about OmniPro 220…"}
                    className="chat-textarea"
                    rows={1}
                    disabled={isStreaming}
                />

                <div title={isRecording ? "Tap to stop" : "Tap to record"}>
                    <button
                        className={`icon-btn${isRecording ? " icon-btn--active" : ""}${isTranscribing ? " icon-btn--busy" : ""}`}
                        onClick={handleMicClick}
                        disabled={isTranscribing}
                    >
                        <Mic size={20} />
                    </button>
                </div>

                <button className="send-btn" onClick={onSend} disabled={!canSend}>
                    <Send size={18} />
                </button>
            </div>
        </div>
    )
}
