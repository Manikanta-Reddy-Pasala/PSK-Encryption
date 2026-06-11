import os
import uuid
import shutil
import logging
import zipfile
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from werkzeug.utils import secure_filename

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Omni Installer Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False, # Changed to False because we allow all origins
    allow_methods=["*"],
    allow_headers=["*"],
)

# Set UPLOAD_DIR to the root of the repository (one level up from backend)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)
UPLOAD_DIR = os.path.join(ROOT_DIR, "uploads")
EXTRACT_DIR = os.path.join(UPLOAD_DIR, "extracted")

logger.debug(f"Ensuring upload directory exists at: {UPLOAD_DIR}")
os.makedirs(UPLOAD_DIR, exist_ok=True)
logger.debug(f"Ensuring extracted directory exists at: {EXTRACT_DIR}")
os.makedirs(EXTRACT_DIR, exist_ok=True)

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
    logger.info(f"Initializing upload for '{req.filename}' with ID {upload_id} (Expected size: {req.total_size} bytes)")
    logger.debug(f"Creating temporary upload file at absolute path: {temp_filepath}")

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
        logger.error(f"Upload chunk failed: Upload ID {upload_id} not found in active_uploads")
        raise HTTPException(status_code=404, detail="Upload ID not found")

    upload_info = active_uploads[upload_id]
    temp_filepath = upload_info["temp_filepath"]

    chunk_data = await chunk.read()

    logger.debug(f"Writing chunk {chunk_index} ({len(chunk_data)} bytes) to temporary file {temp_filepath}")

    # Append the chunk to the file
    with open(temp_filepath, "ab") as f:
        f.write(chunk_data)

    upload_info["received_size"] += len(chunk_data)

    logger.info(f"Received chunk {chunk_index} for upload {upload_id} ({len(chunk_data)} bytes)")
    logger.debug(f"Upload {upload_id} progress: {upload_info['received_size']}/{upload_info['expected_size']} bytes received")

    return {"status": "success", "chunk_index": chunk_index}

@app.post("/upload/finalize")
def finalize_upload(req: FinalizeUploadRequest):
    upload_id = req.upload_id
    if upload_id not in active_uploads:
        logger.error(f"Finalize upload failed: Upload ID {upload_id} not found in active_uploads")
        raise HTTPException(status_code=404, detail="Upload ID not found")

    upload_info = active_uploads[upload_id]
    temp_filepath = upload_info["temp_filepath"]
    final_filepath = os.path.join(UPLOAD_DIR, upload_info["filename"])

    logger.debug(f"Moving temporary file from {temp_filepath} to {final_filepath}")

    # Move/Rename from .part to final filename
    shutil.move(temp_filepath, final_filepath)
    logger.info(f"Finalized upload {upload_id}. File saved to {final_filepath}")
    logger.debug(f"Upload {upload_id} successfully saved to final absolute path: {final_filepath}")

    # If it is a zip file, unzip it
    extraction_path = None
    if final_filepath.lower().endswith(".zip"):
        extraction_path = os.path.join(EXTRACT_DIR, os.path.splitext(upload_info["filename"])[0])
        logger.debug(f"Ensuring extraction directory exists at absolute path: {extraction_path}")
        os.makedirs(extraction_path, exist_ok=True)
        logger.info(f"Zip file detected. Unzipping {final_filepath} to {extraction_path}...")
        try:
            with zipfile.ZipFile(final_filepath, 'r') as zip_ref:
                zip_ref.extractall(extraction_path)
            logger.info(f"Successfully unzipped files to {extraction_path}")
            logger.debug(f"Unzipping complete. All contents available at absolute path: {extraction_path}")
        except zipfile.BadZipFile:
            logger.error(f"Failed to unzip {final_filepath}. Not a valid zip file.")
            extraction_path = None

    # Cleanup memory
    del active_uploads[upload_id]

    return {
        "status": "success",
        "message": "File successfully assembled and saved" + (" and extracted" if extraction_path else ""),
        "final_filepath": final_filepath,
        "extraction_path": extraction_path
    }

@app.get("/")
def read_root():
    return {"status": "Omni Installer Backend Running"}
