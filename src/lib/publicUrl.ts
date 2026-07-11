export function publicUrl(path: string, requestUrl: string) {
  const safePath = path.startsWith("/") && !path.startsWith("//") ? path : "/";
  const baseUrl = process.env.APP_URL || requestUrl;
  return new URL(safePath, baseUrl);
}
