import { useState } from 'react';
import { CHUNK_SIZE, importKeyFromHex, encryptChunk, DEFAULT_PSK } from './cryptoUtils';

export default function FileEncryptor({ customKey }) {
    const [file, setFile] = useState(null);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('');

    const handleEncrypt = async () => {
        if (!file) return;
        const pskToUse = customKey || DEFAULT_PSK;

        try {
            let handle = null;
            if (window.showSaveFilePicker) {
                try {
                    handle = await window.showSaveFilePicker({
                        suggestedName: file.name + '.enc',
                    });
                } catch (err) {
                    if (err.name === 'AbortError') return;
                    throw err;
                }
            } else {
                console.warn('File System Access API not supported in this browser. Fallback to Blob.');
            }

            const key = await importKeyFromHex(pskToUse);
            const writable = handle ? await handle.createWritable() : null;

            let offset = 0;
            const chunks = [];

            setStatus('Encrypting...');

            while (offset < file.size) {
                const chunkBlob = file.slice(offset, offset + CHUNK_SIZE);
                const chunkBuffer = await chunkBlob.arrayBuffer();

                const encryptedData = await encryptChunk(chunkBuffer, key);

                if (writable) {
                    await writable.write(encryptedData);
                } else {
                    chunks.push(encryptedData);
                }

                offset += CHUNK_SIZE;
                setProgress(Math.min(100, Math.round((offset / file.size) * 100)));
            }

            if (writable) {
                await writable.close();
            } else {
                const blob = new Blob(chunks);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = file.name + '.enc';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }

            setStatus('Encryption complete!');
            setProgress(100);
        } catch (e) {
            console.error(e);
            setStatus('Error during encryption: ' + e.message);
        }
    };

    return (
        <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '20px', backgroundColor: '#f9f9f9' }}>
            <h3>Encrypt File</h3>
            <p style={{ fontSize: '0.9em', color: '#555' }}>
                Select a file (e.g., config zip or software archive) to encrypt it with the current PSK.
            </p>
            <div style={{ fontSize: '0.85em', color: '#666', marginBottom: '15px', padding: '10px', backgroundColor: '#eee', borderRadius: '5px' }}>
                <strong>How it works:</strong> The selected file is read locally in chunks (10MB). Each chunk is individually encrypted using AES-GCM (Advanced Encryption Standard with Galois/Counter Mode) with the provided Pre-Shared Key (PSK). A unique Initialization Vector (IV) and an Authentication Tag are generated for each chunk to ensure security and data integrity. The encrypted chunks are combined into a new file that you can download. All encryption happens securely inside your browser; the unencrypted file is never uploaded.
            </div>
            <div style={{ marginBottom: '10px' }}>
                <input type="file" onChange={e => setFile(e.target.files[0])} />
            </div>
            <button onClick={handleEncrypt} disabled={!file}>Encrypt & Download</button>
            {status && <p style={{ marginTop: '10px' }}><strong>Status:</strong> {status}</p>}
            {progress > 0 && <progress value={progress} max="100" style={{ width: '100%', marginTop: '10px' }} />}
        </div>
    );
}
