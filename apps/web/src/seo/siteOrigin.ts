// The origin every absolute URL in the metadata is built on. Behind a proxy, or while the public
// routes are written out at build time, the request's own origin is not the public one: set
// `PLAYHOOT_SITE_URL` on the server for those.
export function siteOrigin(requestUrl: URL): string {
  const configured = process.env.PLAYHOOT_SITE_URL;
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Misconfigured: fall back to the request.
    }
  }
  return requestUrl.origin;
}
