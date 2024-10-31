import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import DownloadIcon from './icons/download.jsx';
import CoffeeWidget from './components/CoffeeWidget';
import DarkModeToggle from './components/DarkModeToggle';
import DownloadSpinner from './components/DownloadSpinner';
import { FiUser, FiCalendar, FiHeart, FiRepeat, FiMessageCircle } from 'react-icons/fi';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const TweetCard = ({ title }) => {
  const formatDate = (dateString) => {
    const date = new Date(dateString || Date.now());
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="tweet-card">
      <div className="tweet-header">
        <div className="tweet-user">
          <FiUser className="tweet-avatar" />
          <div className="tweet-user-info">
            <span className="tweet-name">X User</span>
            <span className="tweet-handle">@user</span>
          </div>
        </div>
        <div className="tweet-date">
          <FiCalendar className="tweet-date-icon" />
          {formatDate()}
        </div>
      </div>
      <div className="tweet-content">
        <p className="tweet-text">{title}</p>
      </div>
      <div className="tweet-stats">
        <div className="tweet-stat">
          <FiHeart /> <span>0</span>
        </div>
        <div className="tweet-stat">
          <FiRepeat /> <span>0</span>
        </div>
        <div className="tweet-stat">
          <FiMessageCircle /> <span>0</span>
        </div>
      </div>
      <div className="tweet-card-note">
        * not real
      </div>
    </div>
  );
};

function App() {
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme === 'dark';
  });
  const [downloadingFormat, setDownloadingFormat] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setVideoInfo(null);

    try {
      const response = await axios.post(
        `${API_URL}/get-video-info`,
        { url },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          withCredentials: false
        }
      );
      setVideoInfo(response.data);
    } catch (err) {
      console.error('Error details:', err);
      setError(err.response?.data?.error || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (format) => {
    try {
      setDownloading(true);
      setDownloadProgress(0);
      setDownloadingFormat(format.format_id);

      const downloadUrl = `${API_URL}/download?url=${encodeURIComponent(format.url)}`;
      const response = await fetch(downloadUrl);

      if (!response.ok) throw new Error('Download failed');

      const reader = response.body.getReader();
      const contentLength = parseInt(response.headers.get('Content-Length'), 10) || 0;

      let receivedLength = 0;
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          setDownloadProgress(100);
          break;
        }

        chunks.push(value);
        receivedLength += value.length;

        if (contentLength > 0) {
          const progressPercent = (receivedLength / contentLength) * 100;
          setDownloadProgress(Math.round(progressPercent));
        } else {
          setDownloadProgress(Math.round((receivedLength / 1000000) * 100));
        }
      }

      const blob = new Blob(chunks, { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `${videoInfo.title || 'twitter_video'}.${format.ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

    } catch (err) {
      console.error('Download error:', err);
      setError('Download failed');
    } finally {
      setDownloading(false);
      setDownloadProgress(0);
      setDownloadingFormat(null);
    }
  };

  return (
    <div className="app">
      <DarkModeToggle
        darkMode={darkMode}
        onToggle={() => setDarkMode(prev => !prev)}
      />
      <header className="header">
        <h1 className="title">
          <DownloadSpinner />
          FXTCHER
        </h1>
        <CoffeeWidget />
      </header>

      <main className="main-content">
        <form onSubmit={handleSubmit} className="download-form">
          <div className="url-input-wrapper">
            <i className="fa-solid--link url-icon"></i>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="x.com/user/status..."
              className="url-input"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="load-button"
          >
            {loading ? 'Loading...' : 'Load Video'}
          </button>
        </form>

        {!videoInfo && !error && !loading && (
          <p className="instructions">
            Paste a X (Twitter) video link above to load download options
          </p>
        )}

        {error && <div className="error-message">{error}</div>}

        {videoInfo && (
          <div className="video-info">
            <TweetCard title={videoInfo.title} />
            <div className="format-list">
              {videoInfo.formats.map((format) => (
                <div key={format.format_id} className="download-option">
                  <button
                    onClick={() => handleDownload(format)}
                    className={`download-button ${downloadingFormat === format.format_id ? 'downloading' : ''}`}
                    disabled={downloading}
                  >
                    {downloadingFormat === format.format_id ? (
                      <div className="download-button-content downloading">
                        <div className="download-progress-wrapper">
                          <div 
                            className="download-progress-fill"
                            style={{ width: `${downloadProgress}%` }}
                          />
                          <span className="download-status-text">
                            {downloadProgress}%
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="download-button-content">
                        <DownloadIcon className="download-icon" />
                        <span>Download</span>
                        <span className="type-text">{format.ext.toUpperCase()}</span>
                        <span className="resolution-badge">{format.quality}p</span>
                        {parseInt(format.quality) >= 1080 && (
                          <span className="hd-badge">HD</span>
                        )}
                      </div>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>© 2024 FXTCHER. For personal use only.</p>
        <p>No videos, URLs, or personal data are stored on our servers.</p>
        <p className="disclaimer">
          This tool is not affiliated with Twitter/X.
        </p>
      </footer>
    </div>
  );
}

export default App;
