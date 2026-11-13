export const PUBLIC_ORIGIN = "https://chaqueeuro.fr";

export const canonicalUrl = (url: URL) =>
  new URL(url.pathname.replace(/(.)\/$/, "$1"), PUBLIC_ORIGIN).href;
