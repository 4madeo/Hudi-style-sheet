export type LogoDevFormat = "svg" | "png" | "webp" | "jpg";

export type LogoDevUrlOptions = {
  format?: LogoDevFormat;
  size?: number;
  token?: string;
  fallback?: "404" | "monogram";
};

/** Builds a Logo.dev image URL without ever accepting a secret API key. */
export function createLogoDevUrl(domain: string, options: LogoDevUrlOptions = {}) {
  const {
    format = "svg",
    size = 512,
    token,
    fallback = "404",
  } = options;
  const params = new URLSearchParams({
    format,
    size: String(Math.max(16, Math.min(800, Math.round(size)))),
    fallback,
  });
  if (token) params.set("token", token);
  return `https://img.logo.dev/${encodeURIComponent(domain)}?${params.toString()}`;
}
