/**
 * Utility for parsing and extracting YouTube Video IDs from various URL formats.
 */

export interface YouTubeParseResult {
  videoId: string | null;
  error?: string;
  isPlaylist?: boolean;
}

export function parseYouTubeVideoId(input: string): YouTubeParseResult {
  if (!input || typeof input !== 'string') {
    return { videoId: null, error: 'Please enter a valid YouTube URL or Video ID.' };
  }

  const trimmed = input.trim();

  // Detect playlist URLs
  if (trimmed.includes('list=') && !trimmed.includes('v=')) {
    return {
      videoId: null,
      isPlaylist: true,
      error: 'Playlist URLs are not supported in this version. Please enter a single video URL.',
    };
  }

  // 1. Direct 11-character Video ID (e.g. dQw4w9WgXcQ)
  const directIdRegex = /^[a-zA-Z0-9_-]{11}$/;
  if (directIdRegex.test(trimmed)) {
    return { videoId: trimmed };
  }

  // 2. Standard URL formats:
  // - https://www.youtube.com/watch?v=VIDEO_ID
  // - https://m.youtube.com/watch?v=VIDEO_ID
  // - https://youtu.be/VIDEO_ID
  // - https://www.youtube.com/shorts/VIDEO_ID
  // - https://www.youtube.com/embed/VIDEO_ID
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /[?&]v=([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      return { videoId: match[1] };
    }
  }

  return {
    videoId: null,
    error: 'Invalid YouTube URL. Supported formats: youtube.com/watch?v=..., youtu.be/..., youtube.com/shorts/...',
  };
}
