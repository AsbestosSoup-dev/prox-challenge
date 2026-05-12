import json

import pymupdf
from pathlib import Path

import numpy as np
from sentence_transformers import SentenceTransformer

if __name__ == "__main__":
    BACKEND_DIR = Path(__file__).parent
    FILES_DIR = BACKEND_DIR / "files"
    CACHE_DIR = BACKEND_DIR / "cache"
    PAGES_DIR = CACHE_DIR / "pages"

    PAGES_DIR.mkdir(parents=True, exist_ok=True)

    metadata = []

    files = list(FILES_DIR.glob("*.pdf"))

    for file in files:
        with pymupdf.open(file) as pdf:
            for page in pdf:
                page_num = page.number
                text = page.get_text()
                pixmap = page.get_pixmap(dpi=150)
                pixmap.save(f"{PAGES_DIR}/{file.stem}-{page_num + 1:03d}.png")
                metadata.append({"filename": file.stem, "page": page_num + 1, "text": text})

    with open(CACHE_DIR / "metadata.json", "w") as metadata_file:
        json.dump(metadata, metadata_file)

    model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    texts = [page["text"] for page in metadata]
    embeddings = model.encode(texts)
    np.save(CACHE_DIR / "embeddings.npy", embeddings)
