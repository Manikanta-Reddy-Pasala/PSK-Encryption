# Omni Installer - Secure Software Archive

This repository contains the Omni Installer, a secure utility designed to encrypt, decrypt, and upload large (10-12GB+) software archives and system configurations using Pre-Shared Keys (PSK).

## Architecture

The project is structured as a monorepo containing:
1. **Frontend (`/frontend`)**: A modern React application built with Vite. It handles client-side PSK generation, chunked file reading, and secure AES-GCM encryption/decryption using the Web Crypto API.
2. **Backend (`/backend`)**: A highly concurrent Python FastAPI backend that receives decrypted file chunks and continuously appends them to disk, allowing massive files to be uploaded without exhausting server memory.

### Security & File Handling
Because standard ZIP encryption is unsuitable for streaming massive files in a browser, this application treats the archives as raw binary data.
- Files are sliced into 10MB chunks.
- Each chunk is individually encrypted/decrypted via **AES-256-GCM** using the provided PSK.
- This allows secure, chunked streaming from the client directly to the backend without ever loading the entire 10GB file into RAM.

## Getting Started

You only need one command to set up the environment, install all dependencies, and start both the frontend and backend servers.

### Prerequisites
- Node.js (v16+)
- Python (3.10+)

### Running the Application

Execute the unified start script from the root of the repository:

```bash
./start.sh
```

This script will automatically:
1. Create a Python virtual environment (`venv`) if it doesn't exist.
2. Install Python dependencies (`fastapi`, `uvicorn`, `werkzeug`, etc.).
3. Install Node.js dependencies (`npm install`).
4. Start the FastAPI backend on `http://localhost:8000`.
5. Start the React frontend on `http://localhost:3000`.

*Note: To stop the servers, simply press `Ctrl+C` in the terminal running the start script.*

## Usage Guide

1. **PSK Management:**
   - Generate a secure 256-bit random PSK in the UI.
   - Download it as a `.key` file.
   - You can also load existing PSKs from `.key` or `.txt` files, or paste them as a hex string.

2. **Pre-Deployment (Encryption):**
   - Select a ZIP file (e.g., Software Archive or System Config).
   - Click "Encrypt & Download". The browser will chunk the file, encrypt it with your PSK, and save a `.enc` file locally.

3. **Decryption & Upload:**
   - On the target machine, select the `.enc` archive.
   - Provide the correct PSK.
   - Click "Decrypt & Upload". The browser will decrypt the file chunk-by-chunk and stream it directly to the backend server.
   - Uploaded files are securely reassembled and stored in the `backend/uploads` directory.
