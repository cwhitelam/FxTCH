import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import DownloadIcon from './icons/download.jsx';
// import { ReactComponent as ExternalIcon } from './icons/external.svg';
import CoffeeWidget from './components/CoffeeWidget';
import DarkModeToggle from './components/DarkModeToggle';
import DownloadSpinner from './components/DownloadSpinner';

const generateThumbnail = async (videoUrl) => {
  try {
    const response = await fetch(videoUrl);
    const blob = await response.blob();
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    video.src = URL.createObjectURL(blob);

    return new Promise((resolve) => {
      video.onloadeddata = () => {
        // Set canvas size to match video dimensions
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Seek to 1 second or 25% of the video
        video.currentTime = Math.min(1, video.duration * 0.25);

        video.onseeked = () => {
          // Draw the video frame on canvas
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          // Convert canvas to blob
          canvas.toBlob((thumbnailBlob) => {
            const thumbnailUrl = URL.createObjectURL(thumbnailBlob);
            URL.revokeObjectURL(video.src);
            resolve(thumbnailUrl);
          }, 'image/jpeg', 0.7);
        };
      };

      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve(null);
      };
    });
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    return null;
  }
};

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

function App() {
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [thumbnailBlobUrl, setThumbnailBlobUrl] = useState(null);
  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme === 'dark';
  });
  const [isProgressBarVisible, setIsProgressBarVisible] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setVideoInfo(null);
    setThumbnailBlobUrl(null);

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
      const videoData = response.data;
      setVideoInfo(videoData);

      if (videoData.thumbnail) {
        try {
          // Fetch the thumbnail through our backend proxy
          const thumbnailResponse = await axios.get(
            `${API_URL}/thumbnail?url=${encodeURIComponent(videoData.thumbnail)}`,
            { responseType: 'blob' }
          );
          const thumbnailUrl = URL.createObjectURL(thumbnailResponse.data);
          setThumbnailBlobUrl(thumbnailUrl);
        } catch (err) {
          console.error('Error fetching thumbnail:', err);
          // Don't set error state, just log it since thumbnail is non-critical
        }
      }
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
      setIsProgressBarVisible(true);

      const downloadUrl = `${API_URL}/download?url=${encodeURIComponent(format.url)}`;

      // Use the Fetch API with a custom progress handler
      const response = await fetch(downloadUrl);

      if (!response.ok) throw new Error('Download failed');

      const reader = response.body.getReader();
      const contentLength = +response.headers.get('Content-Length');

      let receivedLength = 0;
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        chunks.push(value);
        receivedLength += value.length;

        const progress = (receivedLength / contentLength) * 100;
        setDownloadProgress(Math.round(progress));
      }

      const blob = new Blob(chunks, { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);

      // Download the video
      const link = document.createElement('a');
      link.href = url;
      link.download = 'twitter_video.mp4';
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
      setIsProgressBarVisible(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let blobUrl = null;

    if (videoInfo && videoInfo.thumbnail) {
      // Fetch the thumbnail image and convert it to a blob
      fetch(videoInfo.thumbnail)
        .then(response => response.blob())
        .then(blob => {
          blobUrl = URL.createObjectURL(blob);
          if (isMounted) {
            setThumbnailBlobUrl(blobUrl);
          }
        })
        .catch(() => {
          // Handle errors if necessary
        });
    }

    return () => {
      isMounted = false;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [videoInfo]);

  const ProgressBar = ({ progress }) => (
    <div className="progress-bar-container">
      <div
        className="progress-bar-fill"
        style={{ width: `${progress}%` }}
      />
    </div>
  );

  return (
    <div className="app">
      {isProgressBarVisible && (
        <ProgressBar progress={downloadProgress} />
      )}
      <DarkModeToggle
        darkMode={darkMode}
        onToggle={() => setDarkMode(prev => !prev)}
      />
      <header className="header">
        <h1 className="title">
          <DownloadSpinner />
          FXTCH
        </h1>
        <CoffeeWidget />
      </header>

      <main className="main-content">
        <form onSubmit={handleSubmit} className="download-form">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter Twitter video URL here"
            className="url-input"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            className="load-button"
          >
            {loading ? 'Loading...' : 'Load Videos'}
          </button>
        </form>

        {!videoInfo && !error && !loading && (
          <p className="instructions">
            Paste a Twitter video link above to load download options
          </p>
        )}

        {error && <div className="error-message">{error}</div>}

        {videoInfo && (
          <div className="video-info">
            <h2 className="video-title">{videoInfo.title}</h2>

            {thumbnailBlobUrl && (
              <div className="video-thumbnail">
                <img src={thumbnailBlobUrl} alt="Video preview" />
              </div>
            )}

            <div className="format-list">
              {videoInfo.formats.map((format) => (
                <button
                  key={format.format_id}
                  onClick={() => handleDownload(format)}
                  className={`download-button ${downloading ? 'downloading' : ''}`}
                  disabled={downloading}
                >
                  {downloading ? (
                    <div className="download-status">
                      <span className="download-status-text">
                        Downloading... {downloadProgress}%
                      </span>
                    </div>
                  ) : (
                    <div className="download-button-content">
                      <DownloadIcon className="download-icon" />
                      <span>Download</span>
                      <span className="type-text">MP4</span>
                      <span className="resolution-badge">{format.quality}</span>
                      {parseInt(format.quality) >= 1080 && (
                        <span className="hd-badge">HD</span>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>© 2024 Twitter Video Downloader. For personal use only.</p>
        <p className="disclaimer">
          This tool is not affiliated with Twitter/X.
        </p>
      </footer>
    </div>
  );
}

export default App;
