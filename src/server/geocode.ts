/* Reverse-geocodes a run's coordinates once, at job creation, so the catalog can
   say "Yellowstone National Park" instead of two numbers. Nominatim's usage
   policy requires an identifying User-Agent and asks for at most 1 request per
   second — one lookup per run is comfortably inside that. Failure is not an
   error: the catalog falls back to showing the coordinates. */

const ENDPOINT = "https://nominatim.openstreetmap.org/reverse";
const TIMEOUT_MS = 5_000;

interface NominatimAddress {
  tourism?: string;
  leisure?: string;
  natural?: string;
  protected_area?: string;
  national_park?: string;
  water?: string;
  village?: string;
  town?: string;
  city?: string;
  hamlet?: string;
  municipality?: string;
  county?: string;
  state?: string;
  country?: string;
}

/** Builds a short human label from Nominatim's address parts.
    Prefers a named feature (a park, a lake) over the enclosing town, because
    "Yellowstone National Park" is more useful than "Teton County". */
export function labelFromAddress(address: NominatimAddress | undefined): string | null {
  if (!address) return null;

  const feature = address.national_park ?? address.protected_area ?? address.tourism ?? address.leisure ?? address.natural ?? address.water;
  const place = address.city ?? address.town ?? address.village ?? address.hamlet ?? address.municipality;
  const region = address.state ?? address.county;

  const primary = feature ?? place ?? region;
  if (!primary) return address.country ?? null;

  // Avoid "Wyoming, Wyoming" when the primary already is the region.
  const parts = [primary, region && region !== primary ? region : null].filter(Boolean);
  return parts.join(", ");
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = `${ENDPOINT}?lat=${latitude}&lon=${longitude}&format=jsonv2&zoom=12&addressdetails=1`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Nominatim requires a real identifier; anonymous traffic gets blocked.
        "User-Agent": "Flybox/1.0 (https://flybox.zm1.org)",
        "Accept-Language": "en",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { address?: NominatimAddress; name?: string };
    return labelFromAddress(data.address) ?? data.name ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
