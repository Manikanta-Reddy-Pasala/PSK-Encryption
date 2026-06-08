import { useState } from 'react';
import { CHUNK_SIZE, importKeyFromHex, decryptChunk, DEFAULT_PSK } from './cryptoUtils';

export default function FileDecryptor({ customKey }) {
    const [file, setFile] = useState(null);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('');

    const handleDecrypt = async () => {
        if (!file) return;

        try {
            let handle = null;
            if (window.showSaveFilePicker) {
                try {
                    // Remove .enc extension if it exists, otherwise use original name
                    let suggestedName = file.name;
                    if (suggestedName.endsWith('.enc')) {
                        suggestedName = suggestedName.slice(0, -4);
                    } else {
                        suggestedName = 'decrypted_' + suggestedName;
                    }

                    handle = await window.showSaveFilePicker({
                        suggestedName: suggestedName,
                    });
                } catch (err) {
                    if (err.name === 'AbortError') return;
                    throw err;
                }
            } else {
                console.warn('File System Access API not supported in this browser. Fallback to Blob.');
            }

            const defaultKeyObj = await importKeyFromHex(DEFAULT_PSK);
            let customKeyObj = null;
            if (customKey) {
                try {
                    customKeyObj = await importKeyFromHex(customKey);
                } catch (e) {
                    console.warn("Invalid custom key format", e);
                }
            }

            const writable = handle ? await handle.createWritable() : null;

            let offset = 0;
            const chunks = [];

            setStatus('Decrypting...');

            // In encryption, chunks are CHUNK_SIZE + 12 (IV) + 16 (Auth Tag)
            const ENCRYPTED_CHUNK_SIZE = CHUNK_SIZE + 12 + 16;

            while (offset < file.size) {
                const chunkBlob = file.slice(offset, offset + ENCRYPTED_CHUNK_SIZE);
                const chunkBuffer = await chunkBlob.arrayBuffer();

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

                if (writable) {
                    await writable.write(decryptedData);
                } else {
                    chunks.push(decryptedData);
                }

                offset += ENCRYPTED_CHUNK_SIZE;
                setProgress(Math.min(100, Math.round((offset / file.size) * 100)));
            }

            if (writable) {
                await writable.close();
            } else {
                const blob = new Blob(chunks);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                let downloadName = file.name;
                if (downloadName.endsWith('.enc')) {
                    downloadName = downloadName.slice(0, -4);
                } else {
                    downloadName = 'decrypted_' + downloadName;
                }
                a.download = downloadName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }

            setStatus('Decryption complete!');
            setProgress(100);
        } catch (e) {
            console.error(e);
            setStatus('Error during decryption: ' + e.message);
        }
    };

    return (
        <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '20px', backgroundColor: '#f9f9f9' }}>
            <h3>Decrypt File</h3>
            <p style={{ fontSize: '0.9em', color: '#555' }}>Select an encrypted file to decrypt it with the current PSK.</p>
            <div style={{ marginBottom: '10px' }}>
                <input type="file" onChange={e => setFile(e.target.files[0])} />
            </div>
            <button onClick={handleDecrypt} disabled={!file}>Decrypt & Download</button>
            {status && <p style={{ marginTop: '10px' }}><strong>Status:</strong> {status}</p>}
            {progress > 0 && <progress value={progress} max="100" style={{ width: '100%', marginTop: '10px' }} />}
        </div>
    );
}
