import Cookies from 'universal-cookie';
import { ConsentState, ConsentPreferences } from '../types/consent';
import { initGA } from './analytics';

const cookies = new Cookies();
const CONSENT_COOKIE_NAME = 'consent_preferences';
const CONSENT_EXPIRY_DAYS = 365;

export const initializeConsentMode = () => {
  // Initialize dataLayer if it doesn't exist
  window.dataLayer = window.dataLayer || [];

  // Define gtag function
  function gtag(...args: any[]) {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;

  // Set default consent state (denied for all)
  gtag('consent', 'default', {
    ad_storage: 'denied',
    analytics_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    region: [
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
    ],
  });
};

export const updateConsentMode = (analytics: boolean, marketing: boolean) => {
  if (!window.gtag) return;

  const consentState: ConsentState = {
    analytics_storage: analytics ? 'granted' : 'denied',
    ad_storage: marketing ? 'granted' : 'denied',
    ad_user_data: marketing ? 'granted' : 'denied',
    ad_personalization: marketing ? 'granted' : 'denied',
  };

  window.gtag('consent', 'update', consentState);

  // Initialize Google Analytics if analytics consent is given and GA is not yet loaded
  if (analytics && process.env['NEXT_PUBLIC_GA_MEASUREMENT_ID']) {
    initGA();
  }
};

export const saveConsentPreferences = (preferences: ConsentPreferences) => {
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + CONSENT_EXPIRY_DAYS);

  cookies.set(CONSENT_COOKIE_NAME, preferences, {
    expires: expirationDate,
    path: '/',
    sameSite: 'strict',
    secure: window.location.protocol === 'https:',
  });
};

export const getConsentPreferences = (): ConsentPreferences | null => {
  return cookies.get(CONSENT_COOKIE_NAME) || null;
};

export const hasConsentDecision = (): boolean => {
  return !!cookies.get(CONSENT_COOKIE_NAME);
};

export const removeConsentPreferences = () => {
  cookies.remove(CONSENT_COOKIE_NAME, { path: '/' });
};

export const getDefaultPreferences = (): ConsentPreferences => ({
  essential: true,
  analytics: false,
  marketing: false,
  timestamp: Date.now(),
});
