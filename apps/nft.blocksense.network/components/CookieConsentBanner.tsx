'use client';
import { useConsent } from '../hooks/use-consent';
import { Button } from '../radixUiComponents/button';
import { Cookie, ExternalLink } from 'lucide-react';

export default function CookieConsentBanner() {
  const { bannerVisible, acceptAll, rejectAll, showPreferencesModal } =
    useConsent();

  if (!bannerVisible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-white dark:bg-background border-t border-border shadow-lg z-50 transition-transform duration-300"
      role="dialog"
      aria-labelledby="cookie-banner-title"
      aria-describedby="cookie-banner-description"
    >
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1">
            <h3
              id="cookie-banner-title"
              className="text-lg font-semibold text-foreground mb-2 flex items-center"
            >
              <Cookie className="mr-2 h-5 w-5 text-warning" />
              Cookie Consent
            </h3>
            <p
              id="cookie-banner-description"
              className="text-sm text-muted-foreground"
            >
              We use cookies to analyze site usage and improve your experience.
              You can manage your preferences or accept all cookies.
              <a
                href="/privacy-policy"
                className="text-primary hover:text-primary/80 underline ml-1 inline-flex items-center"
              >
                Learn more
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:ml-6">
            <Button
              variant="outline"
              size="sm"
              onClick={showPreferencesModal}
              className="text-sm"
            >
              Manage Preferences
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={rejectAll}
              className="text-sm"
            >
              Reject All
            </Button>
            <Button size="sm" onClick={acceptAll} className="text-sm">
              Accept All
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
