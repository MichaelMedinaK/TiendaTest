'use server';

import { executeAction } from '@/lib/action-runner';
import { ActionResult } from '@/lib/action-result';
import { DELIVERY_RATE_PER_KM } from '@/lib/constants';
import { ServiceUnavailableError, ValidationError } from '@/lib/errors';
import { INVENTORY_ROLES } from '@/lib/permissions';
import { requireRole } from '@/lib/session';
import { calculateShippingPrice } from '@/lib/shipping';
import { requireText } from '@/lib/validation';

// Nominatim (geocodificacion) y OSRM (rutas) son servicios publicos de OpenStreetMap sin clave de API.
// Para mucho volumen conviene un proveedor propio o de pago con la misma interfaz.
const GEOCODING_URL = 'https://nominatim.openstreetmap.org/search';
const ROUTING_URL = 'https://router.project-osrm.org/route/v1/driving';
const REQUEST_TIMEOUT_MS = 8000;
const GEOCODING_RETRY_DELAY_MS = 1100;
const USER_AGENT = 'TiendaTest/1.0 (cotizacion de delivery)';

interface Coordinates {
  lat: number;
  lng: number;
}

export interface DeliveryQuote {
  distanceKm: number;
  price: number;
  ratePerKm: number;
  /** Direccion tal como la resolvio el buscador, para confirmar que ubico el lugar correcto. */
  destination: string;
  originLabel: string;
}

/** Cotiza el delivery: distancia por carretera desde el punto fijo de la tienda hasta la direccion indicada. */
export async function quoteDelivery(address: string): Promise<ActionResult<DeliveryQuote>> {
  return executeAction('delivery.quoteDelivery', async (trace) => {
    await requireRole(...INVENTORY_ROLES);

    const destinationText = requireText(address, 'direccion', 300);
    const { coordinates: origin, label: originLabel } = readStoreOrigin();

    const destination = await geocodeAddress(destinationText);
    trace.addStep('direccion-ubicada');

    const distanceKm = await drivingDistanceKm(origin, destination.coordinates);
    trace.addStep(`distancia-calculada:${distanceKm}km`);

    return {
      distanceKm,
      price: calculateShippingPrice(distanceKm),
      ratePerKm: DELIVERY_RATE_PER_KM,
      destination: destination.displayName,
      originLabel,
    };
  });
}

function readStoreOrigin(): { coordinates: Coordinates; label: string } {
  const lat = Number(process.env.STORE_ORIGIN_LAT);
  const lng = Number(process.env.STORE_ORIGIN_LNG);
  const isValid =
    process.env.STORE_ORIGIN_LAT?.trim() &&
    process.env.STORE_ORIGIN_LNG?.trim() &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180;

  if (!isValid) {
    throw new ServiceUnavailableError(
      'Falta configurar el punto de salida de la tienda (STORE_ORIGIN_LAT y STORE_ORIGIN_LNG). Revisa docs/CONFIGURACION.md',
    );
  }

  return { coordinates: { lat, lng }, label: process.env.STORE_ORIGIN_LABEL?.trim() || 'la tienda' };
}

async function fetchJson<TResponse>(url: URL | string): Promise<TResponse> {
  let response: Response;

  try {
    response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'es' },
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new ServiceUnavailableError('No se pudo consultar el servicio de mapas. Intentalo de nuevo en unos segundos');
  }

  if (!response.ok) {
    throw new ServiceUnavailableError('El servicio de mapas no esta disponible por ahora. Intentalo mas tarde');
  }

  return (await response.json()) as TResponse;
}

// Prefijos y titulos que el buscador no siempre tiene en el nombre de la calle ("Avenida Teniente General X").
const STREET_PREFIXES =
  /\b(?:avenida|av|calle|pasaje|jiron|jr|teniente|general|coronel|capitan|doctor|presidente|brigadier|almirante)\b\.?\s*/gi;

/** Sin tildes, con abreviaturas expandidas y sin codigos postales con letra (ej. C1416) ni "Ciudad Autonoma de". */
function normalizeAddress(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\bCdad\.?(?=\s)/gi, 'Ciudad')
    .replace(/\bAv\.?(?=\s)/gi, 'Avenida')
    .replace(/\bTte\.?(?=\s)/gi, 'Teniente')
    .replace(/\bGral\.?(?=\s)/gi, 'General')
    .replace(/\bS\.(?=\s)/g, 'San')
    .replace(/\b[A-Z]\d{4}[A-Z]{0,3}\b/g, '')
    .replace(/\bCiudad Autonoma de\s+/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .trim();
}

/** Calles y localidad de una direccion; una esquina trae dos calles ("Calle A & Calle B, ciudad"). */
function splitAddress(normalized: string): { streets: string[]; locality: string } {
  const [streetsPart, ...rest] = normalized.split(',');
  const streets = streetsPart.split(/\s+(?:&|y|esquina)\s+/i).map((street) => street.trim());

  return { streets, locality: rest.join(',').trim() };
}

/**
 * Consultas a probar, de la mas fiel a la mas flexible: la direccion tal cual, normalizada, sin prefijos de
 * calle y, para esquinas, cada calle por separado dentro de la ciudad.
 */
function buildSearchQueries(address: string): string[] {
  const normalized = normalizeAddress(address);
  const { streets, locality } = splitAddress(normalized);
  const join = (parts: string[], separator: string) => parts.filter(Boolean).join(separator);
  const withLocality = (street: string) => join([street, locality], ', ');
  const stripPrefixes = (street: string) => street.replace(STREET_PREFIXES, '').trim();

  const queries = [
    address,
    normalized,
    withLocality(join(streets.map(stripPrefixes), ' & ')),
  ];

  if (streets.length > 1) {
    queries.push(...streets.map((street) => withLocality(stripPrefixes(street))));
    queries.push(...streets.map(withLocality));
  }

  return [...new Set(queries.filter(Boolean))];
}

async function searchAddress(query: string): Promise<{ lat: string; lon: string; display_name: string } | undefined> {
  const url = new URL(GEOCODING_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');

  const countryCodes = process.env.GEOCODING_COUNTRY_CODES?.trim();

  if (countryCodes) {
    url.searchParams.set('countrycodes', countryCodes);
  }

  const results = await fetchJson<{ lat: string; lon: string; display_name: string }[]>(url);
  return results[0];
}

async function geocodeAddress(address: string): Promise<{ coordinates: Coordinates; displayName: string }> {
  const queries = buildSearchQueries(address);

  for (const [index, query] of queries.entries()) {
    if (index > 0) {
      // Nominatim permite como maximo 1 consulta por segundo.
      await new Promise((resolve) => setTimeout(resolve, GEOCODING_RETRY_DELAY_MS));
    }

    const match = await searchAddress(query);
    const lat = Number(match?.lat);
    const lng = Number(match?.lon);

    if (match && Number.isFinite(lat) && Number.isFinite(lng)) {
      return { coordinates: { lat, lng }, displayName: match.display_name };
    }
  }

  throw new ValidationError('No se encontro la direccion. Agrega el barrio, la ciudad o un punto de referencia');
}

async function drivingDistanceKm(origin: Coordinates, destination: Coordinates): Promise<number> {
  const url = `${ROUTING_URL}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`;
  const route = await fetchJson<{ code: string; routes?: { distance: number }[] }>(url);
  const meters = route.routes?.[0]?.distance;

  if (route.code !== 'Ok' || typeof meters !== 'number') {
    throw new ValidationError('No se encontro una ruta por carretera hasta esa direccion');
  }

  return Math.round(meters / 100) / 10;
}
