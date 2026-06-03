import os
import uuid
import shutil
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from werkzeug.utils import secure_filename

app = FastAPI(title="Omni Installer Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False, # Changed to False because we allow all origins
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

class InitUploadRequest(BaseModel):
    filename: str
    total_size: int

class FinalizeUploadRequest(BaseModel):
    upload_id: str

# In-memory store for active uploads.
# In production, use a database or Redis.
active_uploads = {}

@app.post("/upload/init")
def init_upload(req: InitUploadRequest):
    upload_id = str(uuid.uuid4())
    temp_filepath = os.path.join(UPLOAD_DIR, f"{upload_id}.part")

    # Initialize an empty file
    with open(temp_filepath, "wb") as f:
        pass

    active_uploads[upload_id] = {
        "filename": secure_filename(req.filename), # FIX: Prevent Path Traversal
        "temp_filepath": temp_filepath,
        "expected_size": req.total_size,
        "received_size": 0
    }

    return {"upload_id": upload_id}

@app.post("/upload/chunk")
async def upload_chunk(
    upload_id: str = Form(...),
    chunk_index: int = Form(...),
    chunk: UploadFile = File(...)
):
    if upload_id not in active_uploads:
        raise HTTPException(status_code=404, detail="Upload ID not found")

    upload_info = active_uploads[upload_id]
    temp_filepath = upload_info["temp_filepath"]

    chunk_data = await chunk.read()

    # Append the chunk to the file
    with open(temp_filepath, "ab") as f:
        f.write(chunk_data)

    upload_info["received_size"] += len(chunk_data)

    return {"status": "success", "chunk_index": chunk_index}

@app.post("/upload/finalize")
def finalize_upload(req: FinalizeUploadRequest):
    upload_id = req.upload_id
    if upload_id not in active_uploads:
        raise HTTPException(status_code=404, detail="Upload ID not found")

    upload_info = active_uploads[upload_id]
    temp_filepath = upload_info["temp_filepath"]
    final_filepath = os.path.join(UPLOAD_DIR, upload_info["filename"])

    # Move/Rename from .part to final filename
    shutil.move(temp_filepath, final_filepath)

    # Cleanup memory
    del active_uploads[upload_id]

    return {
        "status": "success",
        "message": "File successfully assembled and saved",
        "final_filepath": final_filepath
    }

@app.get("/")
def read_root():
    return {"status": "Omni Installer Backend Running"}
