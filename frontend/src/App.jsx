import React, { useState } from 'react';
import './App.css';
import FileEncryptor from './FileEncryptor';
import FileDecryptor from './FileDecryptor';
import FileUploader from './FileUploader';

function App() {
  const [psk, setPsk] = useState('');
  const [pskInput, setPskInput] = useState('');

  const generatePSK = () => {
    // Generate a robust 32-byte (256-bit) random key, suitable for AES-256
    const randomBuffer = new Uint8Array(32);
    window.crypto.getRandomValues(randomBuffer);
    const keyString = Array.from(randomBuffer).map(b => b.toString(16).padStart(2, '0')).join('');
    setPsk(keyString);
    setPskInput(keyString);
  };

  const downloadPSK = () => {
    if (!psk) return;
    const blob = new Blob([psk], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'system_psk.key';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePskFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    setPsk(text.trim());
    setPskInput(text.trim());
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Omni Installer</h1>

        <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '20px', backgroundColor: '#eef' }}>
          <h2>PSK Management</h2>
          <div style={{ marginBottom: '15px' }}>
            <button onClick={generatePSK}>Generate Random PSK</button>
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label>Load PSK from File: </label>
            <input type="file" accept=".key,.txt" onChange={handlePskFile} />
          </div>
          <div>
            <label>Or Enter PSK Hex: </label>
            <input
              type="text"
              value={pskInput}
              onChange={e => { setPskInput(e.target.value); setPsk(e.target.value); }}
              style={{ width: '400px', padding: '5px' }}
              placeholder="64-character hex string"
            />
          </div>

          {psk && (
            <div style={{ marginTop: '15px' }}>
              <button onClick={downloadPSK}>Download PSK (.key)</button>
            </div>
          )}
        </div>

        <FileEncryptor psk={psk} />
        <FileDecryptor psk={psk} />
        <FileUploader psk={psk} />
      </header>
    </div>
  );
}

export default App;
