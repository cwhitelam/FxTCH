from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import yt_dlp
import os
from urllib.parse import urlparse
import tempfile

app = Flask(__name__)

# Update CORS configuration to be more permissive
CORS(app, supports_credentials=True, resources={
    r"/api/*": {
        "origins": ["http://localhost:3000"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

def is_valid_twitter_url(url):
    parsed = urlparse(url)
    return parsed.netloc in ['twitter.com', 'www.twitter.com', 'x.com', 'www.x.com']

def get_video_info(url):
    ydl_opts = {
        'format': 'best',
        'quiet': True,
        'no_warnings': True,
        'extract_flat': True
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(url, download=False)
            formats = []
            
            for f in info['formats']:
                if f.get('vcodec') != 'none':
                    formats.append({
                        'format_id': f['format_id'],
                        'quality': f.get('height', 'unknown'),
                        'ext': f.get('ext', 'mp4'),
                        'filesize': f.get('filesize', 0)
                    })
            
            return {
                'title': info.get('title', ''),
                'thumbnail': info.get('thumbnail', ''),
                'formats': formats
            }
        except Exception as e:
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

@app.route('/api/download', methods=['GET'])
def download_video():
    url = request.args.get('url')
    format_id = request.args.get('format')
    
    if not url or not format_id:
        return jsonify({'error': 'Missing parameters'}), 400
    
    if not is_valid_twitter_url(url):
        return jsonify({'error': 'Invalid Twitter URL'}), 400
    
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as tmp_file:
            ydl_opts = {
                'format': format_id,
                'outtmpl': tmp_file.name,
                'quiet': True
            }
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
            
            return send_file(
                tmp_file.name,
                mimetype='video/mp4',
                as_attachment=True,
                download_name='twitter_video.mp4'
            )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)