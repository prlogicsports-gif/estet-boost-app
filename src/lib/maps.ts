/** Endereço de mapa que abre direto no aplicativo certo: Apple Mapas no iPhone/iPad, Google Maps nos demais. */
export function mapsUrl(address: string): string {
  const query = encodeURIComponent(address);
  const apple = typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent);
  return apple
    ? `https://maps.apple.com/?q=${query}`
    : `https://www.google.com/maps/search/?api=1&query=${query}`;
}
