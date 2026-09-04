/* Reverse-geocodes once per run so the catalog can name a place. Nominatim requires an identifying User-Agent; failure is not an error, the catalog shows coordinates. */

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

/** Builds a short label from Nominatim's address parts, preferring a named feature over the enclosing town. */
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
