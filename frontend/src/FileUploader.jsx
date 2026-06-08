import { useState } from 'react';
import { ENCRYPTED_CHUNK_SIZE, importKeyFromHex, decryptChunk, DEFAULT_PSK } from './cryptoUtils';

export default function FileUploader({ customKey }) {
    const [file, setFile] = useState(null);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('');

    const handleUpload = async () => {
        if (!file) return;

        try {
            const defaultKeyObj = await importKeyFromHex(DEFAULT_PSK);
            let customKeyObj = null;
            if (customKey) {
                try {
                    customKeyObj = await importKeyFromHex(customKey);
                } catch (e) {
                    console.warn("Invalid custom key format", e);
                }
            }

            setStatus('Initializing upload...');
            const initResponse = await fetch('http://localhost:8000/upload/init', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: file.name.replace(/\.enc$/, ''),
                    total_size: file.size
                })
            });

            if (!initResponse.ok) throw new Error('Failed to initialize upload');
            const { upload_id } = await initResponse.json();

            let offset = 0;
            let chunkIndex = 0;

            setStatus('Decrypting and uploading chunks...');

            while (offset < file.size) {
                // The last chunk might be smaller than ENCRYPTED_CHUNK_SIZE
                const end = Math.min(offset + ENCRYPTED_CHUNK_SIZE, file.size);
                const chunkBlob = file.slice(offset, end);
                const chunkBuffer = await chunkBlob.arrayBuffer();

                // Decrypt
                let decryptedData = null;

                if (customKeyObj) {
                    try {
                        decryptedData = await decryptChunk(chunkBuffer, customKeyObj);
                    } catch (err) {
                        console.warn("Decryption with custom key failed, falling back to default key", err);
                    }
                }

                if (!decryptedData) {
                    try {
                        decryptedData = await decryptChunk(chunkBuffer, defaultKeyObj);
                    } catch (err) {
                        throw new Error("Decryption failed with both custom and default keys.", { cause: err });
                    }
                }

                // Upload decrypted chunk
                const formData = new FormData();
                formData.append('chunk', new Blob([decryptedData]));
                formData.append('chunk_index', chunkIndex);
                formData.append('upload_id', upload_id);

                const uploadResponse = await fetch('http://localhost:8000/upload/chunk', {
                    method: 'POST',
                    body: formData
                });

                if (!uploadResponse.ok) throw new Error(`Failed to upload chunk ${chunkIndex}`);

                offset += ENCRYPTED_CHUNK_SIZE;
                chunkIndex++;
                setProgress(Math.min(100, Math.round((offset / file.size) * 100)));
            }

            setStatus('Finalizing upload...');
            const finalizeResponse = await fetch('http://localhost:8000/upload/finalize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ upload_id })
            });

            if (!finalizeResponse.ok) throw new Error('Failed to finalize upload');

            setStatus('Decryption & Upload complete!');
            setProgress(100);
        } catch (e) {
            console.error(e);
            setStatus('Error: ' + e.message);
        }
    };

    return (
        <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '20px', backgroundColor: '#eaf8e6' }}>
            <h3>Decrypt & Upload Archive</h3>
            <p style={{ fontSize: '0.9em', color: '#555' }}>Select an encrypted archive (.enc) to decrypt chunk-by-chunk and stream to the server.</p>
            <div style={{ marginBottom: '10px' }}>
                <input type="file" accept=".enc" onChange={e => setFile(e.target.files[0])} />
            </div>
            <button onClick={handleUpload} disabled={!file}>Decrypt & Upload</button>
            {status && <p style={{ marginTop: '10px' }}><strong>Status:</strong> {status}</p>}
            {progress > 0 && <progress value={progress} max="100" style={{ width: '100%', marginTop: '10px' }} />}
        </div>
    );
}
