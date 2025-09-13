export function getLiveKitURL(url: string, region?: string): string {
  if (!region) {
    return url;
  }

  try {
    const liveKitUrl = new URL(url);
    if (region && region !== 'default') {
      liveKitUrl.hostname = `${region}.${liveKitUrl.hostname}`;
    }
    return liveKitUrl.toString();
  } catch {
    // If URL parsing fails, return original URL
    return url;
  }
}