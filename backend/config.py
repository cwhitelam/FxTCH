import os

class Config:
    RAILWAY_FRONTEND_URL = os.getenv('RAILWAY_FRONTEND_URL', 'http://localhost:3000')
    RAILWAY_BACKEND_URL = os.getenv('RAILWAY_BACKEND_URL', 'http://localhost:5000') 