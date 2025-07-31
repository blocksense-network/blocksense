export interface GeoLocation {
  country: string;
  countryCode: string;
  isEU: boolean;
}

const EU_COUNTRIES = [
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  'IS',
  'LI',
  'NO',
];

export const detectUserLocation = async (): Promise<GeoLocation> => {
  try {
    // Try using a free IP geolocation service
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();

    return {
      country: data.country_name || 'Unknown',
      countryCode: data.country_code || '',
      isEU: EU_COUNTRIES.includes(data.country_code),
    };
  } catch (error) {
    console.warn('Geo-location detection failed:', error);

    // Fallback: check timezone for rough EU detection
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const euTimezones = [
      'Europe/',
      'Atlantic/Azores',
      'Atlantic/Madeira',
      'Atlantic/Canary',
    ];

    const isLikelyEU = euTimezones.some(tz => timezone.startsWith(tz));

    return {
      country: 'Unknown',
      countryCode: '',
      isEU: isLikelyEU,
    };
  }
};

export const shouldShowGDPRBanner = (location: GeoLocation): boolean => {
  return location.isEU;
};
