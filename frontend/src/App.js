import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import DownloadIcon from './icons/download.jsx';
import CoffeeWidget from './components/CoffeeWidget';
import DarkModeToggle from './components/DarkModeToggle';
import DownloadSpinner from './components/DownloadSpinner';
import { FiUser, FiCalendar, FiHeart, FiRepeat, FiMessageCircle, FiX } from 'react-icons/fi';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const TweetCard = ({ title, thumbnail }) => {
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
      {thumbnail && (
        <div className="tweet-media">
          <img src={thumbnail} alt="Tweet media" />
          <div className="tweet-media-overlay">
            <div className="play-button"></div>
          </div>
        </div>
      )}
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
    </div>
  );
};

function App() {
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);
  const [thumbnailUrl, setThumbnailUrl] = useState(null);
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
    setThumbnailUrl(null);

    // Basic URL validation
    if (!url.trim()) {
      setError('Please enter a URL');
      setLoading(false);
      return;
    }

    try {
      const urlPattern = /^https?:\/\/((?:www\.)?(?:twitter\.com|x\.com))/i;
      if (!urlPattern.test(url)) {
        setError('Please enter a valid Twitter/X URL');
        setLoading(false);
        return;
      }

      const response = await axios.post(
        `${API_URL}/get-video-info`,
        { url: url.trim() },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          withCredentials: false
        }
      );

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      const videoData = response.data;
      setVideoInfo(videoData);
      setThumbnailUrl(videoData.thumbnail);

    } catch (err) {
      console.error('Error details:', err);
      setError(
        err.response?.data?.error || 
        err.message || 
        'An error occurred while fetching the video'
      );
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

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      // Check if device is iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

      const file = new File([blob], `${videoInfo.title || 'video'}.mp4`, { type: 'video/mp4' });

      if (isIOS && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: videoInfo.title || 'Video',
            text: 'Check out this video',
          });
          console.log('Video shared successfully');
        } catch (err) {
          console.error('Error sharing video:', err);
          setError('Sharing failed');
        }
      } else {
        // For devices that don't support file sharing, fallback to normal download
        const link = document.createElement('a');
        link.href = url;
        link.download = `${videoInfo.title || 'video'}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

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
            {url && (
              <button
                type="button"
                className="url-clear-button"
                onClick={() => setUrl('')}
                aria-label="Clear input"
              >
                <FiX />
              </button>
            )}
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
            Paste an X (Twitter) video link above to load download options
          </p>
        )}

        {error && <div className="error-message">{error}</div>}

        {videoInfo && (
          <div className="video-info">
            <TweetCard 
              title={videoInfo.title}
              thumbnail={thumbnailUrl}
            />
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
        <p>© 2024 X (Twitter) Video Downloader. For personal use only.</p>
        <p>No videos, URLs, or personal data are stored on our servers.</p>
        <p className="disclaimer">
          This tool is not affiliated with Twitter/X.
        </p>
      </footer>
    </div>
  );
}

export default App;
