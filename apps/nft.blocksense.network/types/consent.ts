export interface ConsentState {
  ad_storage: 'granted' | 'denied';
  analytics_storage: 'granted' | 'denied';
  ad_user_data: 'granted' | 'denied';
  ad_personalization: 'granted' | 'denied';
}

export interface ConsentPreferences {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: number;
}

export interface ConsentContext {
  preferences: ConsentPreferences;
  consentGiven: boolean;
  bannerVisible: boolean;
  preferencesModalVisible: boolean;
  isEuUser: boolean;
  showBanner: () => void;
  hideBanner: () => void;
  showPreferencesModal: () => void;
  hidePreferencesModal: () => void;
  acceptAll: () => void;
  rejectAll: () => void;
  savePreferences: (preferences: Partial<ConsentPreferences>) => void;
  updateConsent: (analytics: boolean, marketing: boolean) => void;
}

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}
