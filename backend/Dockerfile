FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Make port available
EXPOSE ${PORT:-5000}

# Run the application with gunicorn
CMD gunicorn app:app --bind 0.0.0.0:${PORT:-5000} --workers=2 --threads=4 --timeout=120