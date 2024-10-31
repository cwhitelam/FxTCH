from flask import Flask, request, jsonify, send_file, Response, url_for
from flask_cors import CORS
import requests
import os
import subprocess
import json
from urllib.parse import urlparse
from dotenv import load_dotenv
import logging

load_dotenv()

app = Flask(__name__)

# Set default port to 5001
port = int(os.getenv('PORT', '5001'))

# Updated CORS for allowed origins
ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', 'http://localhost:3000').split(',')

CORS(app, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:3000",
            "https://fxtcher.com",
            "https://www.fxtcher.com",
            "https://fxtch-client-production.up.railway.app"
        ],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": False
    },
    r"/thumbnails/*": {
        "origins": ALLOWED_ORIGINS,
        "methods": ["GET"],
    }
})

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def is_valid_twitter_url(url):
    try:
        parsed = urlparse(url)
        valid_domains = ['twitter.com', 'www.twitter.com', 'x.com', 'www.x.com']
        return any(domain in parsed.netloc.lower() for domain in valid_domains)
    except Exception as e:
        logger.error(f"URL validation error: {str(e)}")
        return False

def get_video_info(url):
    try:
        # Use yt-dlp to get video info in JSON format
        cmd = ['yt-dlp', '-j', url]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"yt-dlp error: {result.stderr}")
            return None

        video_info_json = result.stdout
        video_info = json.loads(video_info_json)

        # Extract title and thumbnail
        title = video_info.get('title', 'Twitter Video')
        thumbnail_url = video_info.get('thumbnail')

        # Extract video formats
        formats = []
        for fmt in video_info.get('formats', []):
            if fmt.get('vcodec') != 'none': 
                formats.append({
                    'format_id': fmt.get('format_id'),
                    'quality': fmt.get('height'),
                    'url': fmt.get('url'),
                    'ext': fmt.get('ext'),
                })

        # Return the data in the desired format
        return {
            'title': title,
            'thumbnail': thumbnail_url,
            'formats': formats
        }
    except Exception as e:
        print(f"Error fetching video info: {str(e)}")
        return None


def generate_thumbnail(video_url):
    try:
        import uuid
        from moviepy.editor import VideoFileClip

        # Create a unique filename for the thumbnail
        thumbnail_filename = f"{uuid.uuid4()}.jpg"
        thumbnail_path = os.path.join('thumbnails', thumbnail_filename)
        os.makedirs('thumbnails', exist_ok=True)

        # Download the video
        video_response = requests.get(video_url, stream=True)
        video_response.raise_for_status()
        video_temp_file = f"temp_{uuid.uuid4()}.mp4"
        with open(video_temp_file, 'wb') as f:
            for chunk in video_response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)

        # Generate thumbnail using moviepy
        clip = VideoFileClip(video_temp_file)
        duration = clip.duration
        thumbnail_time = min(1, duration * 0.25)  # 1 second or 25% of the video
        clip.save_frame(thumbnail_path, t=thumbnail_time)
        clip.reader.close()
        if clip.audio:
            clip.audio.reader.close_proc()

        # Clean up the temporary video file
        os.remove(video_temp_file)

        return thumbnail_filename
    except Exception as e:
        print(f"Error generating thumbnail: {str(e)}")
        return None

# This is the function you're asking about
@app.route('/thumbnails/<filename>')
def serve_thumbnail(filename):
    try:
        return send_file(os.path.join('thumbnails', filename), mimetype='image/jpeg')
    except Exception as e:
        print(f"Error serving thumbnail: {str(e)}")
        return jsonify({'error': 'Thumbnail not found'}), 404

@app.route('/api/get-video-info', methods=['POST'])
def video_info():
    try:
        data = request.get_json()
        url = data.get('url')
        
        logger.info(f"Received request for URL: {url}")

        if not url:
            logger.error("No URL provided")
            return jsonify({'error': 'URL is required'}), 400

        if not is_valid_twitter_url(url):
            logger.error(f"Invalid URL format: {url}")
            return jsonify({'error': 'Invalid Twitter/X URL. Please use a twitter.com or x.com URL'}), 400

        info = get_video_info(url)
        if not info:
            logger.error("Could not fetch video information")
            return jsonify({'error': 'Could not fetch video information. Please make sure the URL contains a video'}), 400

        logger.info("Successfully fetched video info")
        return jsonify(info)

    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/download', methods=['GET'])
def download_video_route():
    video_url = request.args.get('url')
    if not video_url:
        print("Error: Missing video URL")
        return jsonify({'error': 'Missing video URL'}), 400

    print(f"Downloading video from URL: {video_url}")

    try:
        # Download directly from the URL and stream to client
        video_response = requests.get(video_url, stream=True)
        video_response.raise_for_status()

        # Get the content length for progress tracking
        content_length = video_response.headers.get('content-length')

        # Create response and set headers
        response = Response(
            video_response.iter_content(chunk_size=8192),
            content_type=video_response.headers.get('content-type', 'video/mp4')
        )

        # Set content length if available
        if content_length:
            response.headers['Content-Length'] = content_length

        # Set download headers
        response.headers['Content-Disposition'] = 'attachment; filename=twitter_video.mp4'

        print("Streaming video to client...")
        return response

    except Exception as e:
        print(f"Download error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/health')
def health_check():
    return jsonify({'status': 'healthy'}), 200

if __name__ == '__main__':
    try:
        app.run(host='0.0.0.0', port=port)
    except OSError as e:
        print(f"Port {port} is in use, trying alternate port...")
        alt_port = 5001
        print(f"Attempting to use port {alt_port}")
        app.run(host='0.0.0.0', port=alt_port)
