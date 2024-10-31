from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import requests
import os
import subprocess
import json
from urllib.parse import urlparse
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

port = int(os.getenv('PORT', '5001'))

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
    }
})

def is_valid_twitter_url(url):
    try:
        parsed = urlparse(url)
        valid_domains = ['twitter.com', 'www.twitter.com', 'x.com', 'www.x.com']
        return any(domain in parsed.netloc.lower() for domain in valid_domains)
    except:
        return False

def get_video_info(url):
    try:
        cmd = ['yt-dlp', '-j', url]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            return None

        video_info_json = result.stdout
        video_info = json.loads(video_info_json)

        title = video_info.get('title', 'Twitter Video')
        formats = []
        qualities_seen = set()

        # Get all formats with video
        for fmt in video_info.get('formats', []):
            if fmt.get('vcodec') != 'none': 
                quality = fmt.get('height')
                if quality and quality not in qualities_seen:
                    qualities_seen.add(quality)
                    formats.append({
                        'format_id': fmt.get('format_id'),
                        'quality': quality,
                        'url': fmt.get('url'),
                        'ext': fmt.get('ext'),
                    })

        # Sort formats by quality (height) in descending order
        formats.sort(key=lambda x: int(x['quality']) if x['quality'] else 0, reverse=True)

        return {
            'title': title,
            'formats': formats
        }
    except:
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
        return jsonify({'error': str(e)}), 500

@app.route('/api/download', methods=['GET'])
def download_video_route():
    video_url = request.args.get('url')
    if not video_url:
        return jsonify({'error': 'Missing video URL'}), 400

    try:
        video_response = requests.get(video_url, stream=True)
        video_response.raise_for_status()

        response = Response(
            video_response.iter_content(chunk_size=8192),
            content_type=video_response.headers.get('content-type', 'video/mp4')
        )

        if content_length := video_response.headers.get('content-length'):
            response.headers['Content-Length'] = content_length

        response.headers['Content-Disposition'] = 'attachment; filename=twitter_video.mp4'
        return response

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/health')
def health_check():
    return jsonify({'status': 'healthy'}), 200

if __name__ == '__main__':
    try:
        app.run(host='0.0.0.0', port=port)
    except OSError as e:
        alt_port = 5001
        app.run(host='0.0.0.0', port=alt_port)
