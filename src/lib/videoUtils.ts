/**
 * Extracts a YouTube video ID from various YouTube URL formats.
 * Returns null if the URL is not a YouTube link.
 */
export function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function getYouTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export function getYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}

/**
 * Auto-detect media type from URL.
 */
export function detectMediaType(url: string): "image" | "video" {
  if (getYouTubeId(url)) return "video";
  const lower = url.toLowerCase();
  if (lower.match(/\.(mp4|webm|ogg|mov)(\?|$)/)) return "video";
  return "image";
}
