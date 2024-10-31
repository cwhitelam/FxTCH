FROM python:3.9-slim

WORKDIR /app

# Install system dependencies including yt-dlp
RUN apt-get update && apt-get install -y \
    gcc \
    python3-pip \
    && rm -rf /var/lib/apt/lists/* \
    && pip3 install yt-dlp

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Make port available
EXPOSE ${PORT:-5000}

# Run the application with gunicorn
CMD gunicorn --bind 0.0.0.0:$PORT app:app --workers=2 --threads=4 --timeout=120