'use client';
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { ConsentContext, ConsentPreferences } from '../types/consent';
import {
  initializeConsentMode,
  updateConsentMode,
  saveConsentPreferences,
  getConsentPreferences,
  hasConsentDecision,
  getDefaultPreferences,
} from '../lib/consent';
import { detectUserLocation, shouldShowGDPRBanner } from '../lib/geo';

const ConsentContextProvider = createContext<ConsentContext | undefined>(
  undefined,
);

export const useConsent = () => {
  const context = useContext(ConsentContextProvider);
  if (!context) {
    throw new Error('useConsent must be used within a ConsentProvider');
  }
  return context;
};

interface ConsentProviderProps {
  children: ReactNode;
}

export const ConsentProvider = ({ children }: ConsentProviderProps) => {
  const [preferences, setPreferences] = useState<ConsentPreferences>(
    getDefaultPreferences(),
  );
  const [consentGiven, setConsentGiven] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(false);
  const [preferencesModalVisible, setPreferencesModalVisible] = useState(false);
  const [isEuUser, setIsEuUser] = useState(false);

  // Initialize consent system
  useEffect(() => {
    const initialize = async () => {
      // Initialize Google Consent Mode
      initializeConsentMode();

      // Check geo-location
      const location = await detectUserLocation();
      const shouldShowBanner = shouldShowGDPRBanner(location);
      setIsEuUser(location.isEU);

      // Check existing consent
      const existingPreferences = getConsentPreferences();
      if (existingPreferences) {
        setPreferences(existingPreferences);
        setConsentGiven(true);
        updateConsentMode(
          existingPreferences.analytics,
          existingPreferences.marketing,
        );
      } else if (shouldShowBanner) {
        setBannerVisible(true);
      }
    };

    initialize();
  }, []);

  const updateConsent = useCallback(
    (analytics: boolean, marketing: boolean) => {
      updateConsentMode(analytics, marketing);
    },
    [],
  );

  const showBanner = useCallback(() => {
    setBannerVisible(true);
  }, []);

  const hideBanner = useCallback(() => {
    setBannerVisible(false);
  }, []);

  const showPreferencesModal = useCallback(() => {
    setPreferencesModalVisible(true);
  }, []);

  const hidePreferencesModal = useCallback(() => {
    setPreferencesModalVisible(false);
  }, []);

  const acceptAll = useCallback(() => {
    const newPreferences: ConsentPreferences = {
      essential: true,
      analytics: true,
      marketing: true,
      timestamp: Date.now(),
    };

    setPreferences(newPreferences);
    setConsentGiven(true);
    saveConsentPreferences(newPreferences);
    updateConsent(true, true);
    hideBanner();
  }, [updateConsent, hideBanner]);

  const rejectAll = useCallback(() => {
    const newPreferences: ConsentPreferences = {
      essential: true,
      analytics: false,
      marketing: false,
      timestamp: Date.now(),
    };

    setPreferences(newPreferences);
    setConsentGiven(true);
    saveConsentPreferences(newPreferences);
    updateConsent(false, false);
    hideBanner();
  }, [updateConsent, hideBanner]);

  const savePreferences = useCallback(
    (newPreferences: Partial<ConsentPreferences>) => {
      const updatedPreferences: ConsentPreferences = {
        ...preferences,
        ...newPreferences,
        essential: true, // Always true
        timestamp: Date.now(),
      };

      setPreferences(updatedPreferences);
      setConsentGiven(true);
      saveConsentPreferences(updatedPreferences);
      updateConsent(updatedPreferences.analytics, updatedPreferences.marketing);
      hidePreferencesModal();
      if (bannerVisible) {
        hideBanner();
      }
    },
    [
      preferences,
      updateConsent,
      hidePreferencesModal,
      bannerVisible,
      hideBanner,
    ],
  );

  const value: ConsentContext = {
    preferences,
    consentGiven,
    bannerVisible,
    preferencesModalVisible,
    isEuUser,
    showBanner,
    hideBanner,
    showPreferencesModal,
    hidePreferencesModal,
    acceptAll,
    rejectAll,
    savePreferences,
    updateConsent,
  };

  return (
    <ConsentContextProvider.Provider value={value}>
      {children}
    </ConsentContextProvider.Provider>
  );
};
