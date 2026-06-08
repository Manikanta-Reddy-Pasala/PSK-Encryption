import { useState } from 'react';
import './App.css';
import FileEncryptor from './FileEncryptor';
import FileDecryptor from './FileDecryptor';
import FileUploader from './FileUploader';
import { DEFAULT_PSK } from './cryptoUtils';

function App() {
  const [customKey, setCustomKey] = useState('');

  const downloadKey = (keyString, filename) => {
    if (!keyString) return;
    const blob = new Blob([keyString], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCustomKeyFile = async (e) => {
    const file = e.target.files[0];
    if (!file) {
      setCustomKey('');
      return;
    }
    const text = await file.text();
    setCustomKey(text.trim());
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Omni Installer</h1>

        <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '20px', backgroundColor: '#eef' }}>
          <h2>Key Management</h2>
          <div style={{ marginBottom: '15px' }}>
            <button onClick={() => downloadKey(DEFAULT_PSK, 'default_psk.key')}>Download Default Key</button>
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label>Upload Custom Key: </label>
            <input type="file" accept=".key,.txt" onChange={handleCustomKeyFile} />
          </div>
          {customKey && (
            <div style={{ marginTop: '15px' }}>
              <p style={{ color: 'green', fontSize: '0.9em' }}>Custom Key Loaded Successfully</p>
              <button onClick={() => downloadKey(customKey, 'custom_psk.key')}>Download Custom Key</button>
            </div>
          )}
          {!customKey && (
            <div style={{ marginTop: '15px' }}>
              <p style={{ color: '#666', fontSize: '0.9em' }}>Using Default Key</p>
            </div>
          )}
        </div>

        <FileEncryptor customKey={customKey} />
        <FileDecryptor customKey={customKey} />
        <FileUploader customKey={customKey} />
      </header>
    </div>
  );
}

export default App;
