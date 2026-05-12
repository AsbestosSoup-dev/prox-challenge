import base64
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import numpy as np
from anthropic import AsyncAnthropic
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

from prompts import SYSTEM_PROMPT

K = 3
threshold = .4

ROOT_DIR = Path(__file__).parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
FILES_DIR = BACKEND_DIR / "files"
CACHE_DIR = BACKEND_DIR / "cache"
PAGES_DIR = CACHE_DIR / "pages"

load_dotenv(dotenv_path=ROOT_DIR / ".env")
client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

class Message(BaseModel):
    role: str
    content: str
    image_data: Optional[list[str]] = None
    image_type: Optional[list[str]] = None


class ChatRequest(BaseModel):
    messages: list[Message]


@asynccontextmanager
async def lifespan(app: FastAPI):
    with open(CACHE_DIR / "metadata.json", "r") as metadata_file:
        metadata = json.load(metadata_file)

    model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    embeddings = np.load(CACHE_DIR / "embeddings.npy")

    app.state.metadata = metadata
    app.state.model = model
    app.state.embeddings = embeddings
    yield


app = FastAPI(lifespan=lifespan)

origins = [
    "http://localhost:5173",
    os.getenv("FRONTEND_URL", "")
]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/chat")
async def chat(request: Request, chat_request: ChatRequest):
    model = request.app.state.model
    metadata = request.app.state.metadata
    embeddings = request.app.state.embeddings

    user_message = next(msg for msg in reversed(chat_request.messages) if msg.role == "user")
    query_embeddings = model.encode(user_message.content)
    similarities = cosine_similarity(query_embeddings.reshape(1, -1), embeddings).flatten()
    top_k = np.argsort(similarities)[-K:][::-1]
    filtered_top_k = filter(lambda _idx: similarities[_idx] >= threshold, top_k)  # testing

    rag_material = []
    for idx in filtered_top_k:
        entry = metadata[idx]
        text = entry["text"]
        source = entry["filename"]
        page = entry["page"]
        with open(f"{PAGES_DIR}/{source}-{page:03d}.png", "rb") as image_file:
            image_data_bytes = image_file.read()
            rag_material.append(
                {
                    "text": text,
                    "base64": base64.b64encode(image_data_bytes).decode("utf-8"),
                    "source": source,
                    "page": page
                })

    anthropic_messages = [] # anthropic formatting of chat history
    for message in chat_request.messages:
        content_list = []
        if message == user_message: # enrich with rag material
            for material in rag_material:
                content_list.append(
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": material["base64"]
                        }
                    }
                )
            concatenated_text = ""
            for material in rag_material:
                concatenated_text += f"[{material["source"]} p. {material['page']}]\n{material['text']}\n\n"
            if concatenated_text:
                content_list.append({"type": "text", "text": concatenated_text})
        if message.image_data is not None: # user uploaded images
            for image_data, image_type in zip(message.image_data, message.image_type):
                content_list.append(
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": image_type,
                            "data": image_data
                        }
                    }
                )
        if content_list:
            content_list.append({"type": "text", "text": message.content}) # user query
            anthropic_messages.append({"role": message.role, "content": content_list})
        else:
            anthropic_messages.append({"role": message.role, "content": message.content})

    async def stream_response():
        async with client.messages.stream(
                messages=anthropic_messages,
                max_tokens=4096,
                model="claude-sonnet-4-6",
                system=SYSTEM_PROMPT
        ) as stream:
            async for chunk in stream.text_stream:
                yield f"data: {json.dumps({'type': 'delta', 'text': chunk})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
    return StreamingResponse(stream_response(), media_type="text/event-stream")

