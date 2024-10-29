import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      const response = await axios.post('http://localhost:5000/api/get-video-info', { url });
      setVideoInfo(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (formatId) => {
    try {
      window.location.href = `http://localhost:5000/api/download?url=${encodeURIComponent(url)}&format=${formatId}`;
    } catch (err) {
      setError('Download failed');
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Twitter Video Downloader</h1>
      </header>
      
      <main className="container">
        <form onSubmit={handleSubmit} className="url-form">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste Twitter video URL here"
            className="url-input"
          />
          <button type="submit" disabled={loading} className="load-button">
            {loading ? 'Loading...' : 'Load Video'}
          </button>
        </form>

        {error && <div className="error-message">{error}</div>}

        {videoInfo && (
          <div className="video-info">
            <h2>{videoInfo.title}</h2>
            {videoInfo.thumbnail && (
              <img src={videoInfo.thumbnail} alt="Video thumbnail" className="thumbnail" />
            )}
            <div className="format-list">
              <h3>Available Formats:</h3>
              {videoInfo.formats.map((format) => (
                <button
                  key={format.format_id}
                  onClick={() => handleDownload(format.format_id)}
                  className="download-button"
                >
                  Download {format.quality}p
                  {format.filesize ? ` (${(format.filesize / 1024 / 1024).toFixed(1)} MB)` : ''}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App; 