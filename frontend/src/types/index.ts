export interface VideoFormat {
  format_id: string;
  url: string;
  quality: string;
}

export interface VideoInfo {
  title: string;
  thumbnail?: string;
  formats: VideoFormat[];
}

export interface ApiError {
  error: string;
  response?: {
    data?: {
      error?: string;
    };
  };
} 