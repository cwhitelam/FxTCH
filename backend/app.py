from flask import Flask, request, jsonify, send_file, Response, url_for
from flask_cors import CORS
import requests
import os
import subprocess
import json
from urllib.parse import urlparse
from dotenv import load_dotenv
import uuid

load_dotenv()

app = Flask(__name__)

port = int(os.getenv('PORT', '5001'))
ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', 'http://localhost:3000').split(',')

CORS(app, resources={
    r"/api/*": {
        "origins": ALLOWED_ORIGINS,
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    },
    r"/thumbnails/*": {
        "origins": ALLOWED_ORIGINS,
        "methods": ["GET"],
    }
})

def is_valid_twitter_url(url):
    try:
        parsed = urlparse(url)
        return any(domain in parsed.netloc.lower() for domain in ['twitter.com', 'x.com'])
    except:
        return False

def get_video_info(url):
    try:
        cmd = ['yt-dlp', '-j', url]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"yt-dlp error: {result.stderr}")
            return None

        video_info_json = result.stdout
        video_info = json.loads(video_info_json)

        title = video_info.get('title', 'Twitter Video')
        formats = []
        
        for fmt in video_info.get('formats', []):
            if fmt.get('vcodec') != 'none' and fmt.get('url'):
                formats.append({
                    'format_id': fmt.get('format_id'),
                    'quality': fmt.get('height') or 'Unknown',
                    'url': fmt.get('url'),
                    'ext': fmt.get('ext'),
                })

        return {
            'title': title,
            'formats': formats
        }
    except Exception as e:
        print(f"Error fetching video info: {str(e)}")
        return None

@app.route('/api/get-video-info', methods=['POST'])
def video_info():
    try:
        data = request.get_json()
        url = data.get('url')

        if not url:
            return jsonify({'error': 'URL is required'}), 400

        if not is_valid_twitter_url(url):
            return jsonify({'error': 'Invalid Twitter/X URL. Please use a twitter.com or x.com URL'}), 400

        info = get_video_info(url)
        if not info:
            return jsonify({'error': 'Could not fetch video information. Please make sure the URL contains a video'}), 400

        return jsonify(info)
    except Exception as e:
        print(f"Error processing request: {str(e)}")
        return jsonify({'error': 'An error occurred processing your request'}), 500

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
