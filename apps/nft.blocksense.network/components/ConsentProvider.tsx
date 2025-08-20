import { ReactNode } from 'react';
import { ConsentProvider as Provider } from '../hooks/use-consent';
import CookieConsentBanner from './CookieConsentBanner';
import { PrivacyPreferencesModal } from './PrivacyPreferencesModal';

interface ConsentProviderProps {
  children: ReactNode;
}

export const ConsentProvider = ({ children }: ConsentProviderProps) => {
  return (
    <Provider>
      {children}
      <CookieConsentBanner />
      <PrivacyPreferencesModal />
    </Provider>
  );
};
