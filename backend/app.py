from flask import Flask, request, jsonify, send_file, Response
from flask_cors import CORS
import requests
import bs4
import re
from urllib.parse import urlparse
import os

app = Flask(__name__)

# Update CORS configuration to explicitly handle all methods
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "https://x-fetch-iota.vercel.app",
            "https://twitter-download-production.up.railway.app",
            "http://localhost:3000",
            "http://localhost:3001"
        ],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "expose_headers": ["Content-Type", "Authorization"],
        "supports_credentials": False,
        "max_age": 600,
        "send_wildcard": False,
        "automatic_options": True
    }
})

# Add OPTIONS handlers for all API endpoints
@app.route('/api/get-video-info', methods=['OPTIONS'])
@app.route('/api/download', methods=['OPTIONS'])
@app.route('/api/thumbnail', methods=['OPTIONS'])
def handle_options():
    response = app.make_default_options_response()
    response.headers.add('Access-Control-Allow-Origin', 'https://x-fetch-iota.vercel.app')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    return response

# Add a global after_request handler for CORS headers
@app.after_request
def add_cors_headers(response):
    if request.method == 'OPTIONS':
        response.headers.add('Access-Control-Allow-Origin', 'https://x-fetch-iota.vercel.app')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    return response

# Near the top of the file, update the port handling
port = int(os.getenv('PORT', '3001'))  # Changed to 3001

def is_valid_twitter_url(url):
    parsed = urlparse(url)
    return parsed.netloc in ['twitter.com', 'www.twitter.com', 'x.com', 'www.x.com']

def get_video_info(url):
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0'
        }
        api_url = f"https://twitsave.com/info?url={url}"
        response = requests.get(api_url, headers=headers, timeout=10)
        response.raise_for_status()
        data = bs4.BeautifulSoup(response.text, "html.parser")
        
        # Get download buttons for different qualities
        download_buttons = data.find_all("div", class_="origin-top-right")
        if not download_buttons:
            raise Exception("No download buttons found")
            
        download_button = download_buttons[0]
        quality_buttons = download_button.find_all("a")
        
        if not quality_buttons:
            raise Exception("No quality options found")
        
        # Get video title
        title_element = data.find("p", class_="m-2")
        if title_element:
            title = title_element.text.strip()
        else:
            title = "Twitter Video"
        
        # Get thumbnail from meta property
        thumbnail = None
        meta_image = data.find('meta', property='og:image')
        if meta_image and meta_image.get('content'):
            thumbnail = meta_image.get('content')
        else:
            # Fallback to find any image in the content
            img_tag = data.find('img')
            if img_tag and img_tag.get('src'):
                thumbnail = img_tag.get('src')
        
        # Get available formats
        formats = []
        for button in quality_buttons:
            url = button.get("href")
            quality = button.text.strip()
            if url and quality:
                formats.append({
                    'format_id': quality,
                    'quality': quality,
                    'url': url,
                    'ext': 'mp4'
                })
        
        return {
            'title': title,
            'thumbnail': thumbnail,
            'formats': formats
        }
    except Exception as e:
        print(f"Error fetching video info: {str(e)}")
        return None

@app.route('/api/get-video-info', methods=['POST'])
def video_info():
    data = request.get_json()
    url = data.get('url')

    if not url or not is_valid_twitter_url(url):
        return jsonify({'error': 'Invalid Twitter URL'}), 400

    info = get_video_info(url)
    if not info:
        return jsonify({'error': 'Could not fetch video information'}), 400

    return jsonify(info)

@app.route('/api/thumbnail', methods=['GET'])
def get_thumbnail():
    thumbnail_url = request.args.get('url')
    if not thumbnail_url:
        return jsonify({'error': 'No thumbnail URL provided'}), 400
    try:
        response = requests.get(thumbnail_url, stream=True)
        response.raise_for_status()
        return Response(
            response.iter_content(chunk_size=8192),
            content_type=response.headers.get('Content-Type', 'image/jpeg')
        )
    except Exception as e:
        print(f"Error fetching thumbnail: {str(e)}")
        return jsonify({'error': 'Error fetching thumbnail'}), 500

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
        print(f"Error: Port {port} is already in use. Try a different port.")
        # Try alternate port
        alt_port = 8000
        print(f"Attempting to use port {alt_port}...")
        app.run(host='0.0.0.0', port=alt_port)
