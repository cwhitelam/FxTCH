import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import { ReactComponent as DownloadIcon } from './icons/download.svg';
import { ReactComponent as ExternalIcon } from './icons/external.svg';
import CoffeeWidget from './components/CoffeeWidget';

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

function App() {
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [thumbnailBlobUrl, setThumbnailBlobUrl] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setVideoInfo(null);
    setThumbnailBlobUrl(null); // Reset thumbnail

    try {
      const response = await axios.post(`/api/get-video-info`, { url });
      const videoData = response.data;
      setVideoInfo(videoData);

      // Generate thumbnail immediately after video data is loaded
      const videoUrl = videoData.formats[0].url; // Adjust this if needed
      const thumbnailUrl = await generateThumbnail(videoUrl);

      if (thumbnailUrl) {
        setVideoInfo(prev => ({
          ...prev,
          thumbnail: thumbnailUrl
        }));
        setThumbnailBlobUrl(thumbnailUrl);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };


  const handleDownload = async (format) => {
    try {
      setDownloading(true);
      setDownloadProgress(0);

      const downloadUrl = `/api/download?url=${encodeURIComponent(format.url)}`;
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
        setDownloadProgress((receivedLength / contentLength) * 100);
      }

      const blob = new Blob(chunks, { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);

      // Generate thumbnail
      const thumbnailUrl = await generateThumbnail(url);
      if (thumbnailUrl) {
        setVideoInfo(prev => ({
          ...prev,
          thumbnail: thumbnailUrl
        }));
      }

      // Download the video
      const link = document.createElement('a');
      link.href = url;
      link.download = 'twitter_video.mp4';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Cleanup
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error('Download error:', err);
      setError('Download failed');
    } finally {
      setDownloading(false);
      setDownloadProgress(0);
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

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">Video Downloader</h1>
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
                  className="download-button"
                  disabled={downloading}
                >
                  {downloading ? (
                    <span className="download-progress">
                      Downloading... {Math.round(downloadProgress)}%
                    </span>
                  ) : (
                    <>
                      <div className="download-button-content">
                        <div className="download-icon-wrapper">
                          <DownloadIcon className="download-icon" />
                          <span>Download MP4</span>
                        </div>
                        <div className="quality-info">
                          <span className="resolution-badge">
                            {format.quality}
                          </span>
                          {parseInt(format.quality) >= 1080 && (
                            <span className="hd-badge">HD</span>
                          )}
                        </div>
                      </div>
                      <div className="external-icon-wrapper">
                        <ExternalIcon className="external-icon" />
                      </div>
                    </>
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

      <CoffeeWidget />
    </div>
  );
}

export default App;
