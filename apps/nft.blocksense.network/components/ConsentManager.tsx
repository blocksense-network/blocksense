'use client';

import { useEffect, useState } from 'react';
import { GoogleAnalytics, GoogleTagManager } from '@next/third-parties/google';

export const ConsentManager = () => {
  const [consent, setConsent] = useState<'accepted' | 'rejected' | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('cookieConsent');
    if (stored === 'accepted' || stored === 'rejected') {
      setConsent(stored);
    } else {
      setConsent(null);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookieConsent', 'accepted');
    setConsent('accepted');
  };

  const handleReject = () => {
    localStorage.setItem('cookieConsent', 'rejected');
    setConsent('rejected');
  };

  if (consent === null) {
    return (
      <article className="cookie-banner fixed bottom-5 right-5 left-5 md:bottom-6 md:right-6 md:left-auto flex flex-col gap-6 p-6 bg-[var(--black)] border border-[var(--gray-dark)] rounded-2xl md:max-w-[30.625rem] md:gap-8 z-50">
        <section className="cookie-banner__content">
          <p className="text-sm text-[var(--grey-medium)]">
            We use cookies and similar technologies to remember your
            preferences, enable essential site features, and collect anonymous
            analytics data via Google Analytics. By clicking Accept All, you
            consent to our use of cookies and data processing as described in
            our Privacy Policy. Click Reject All to cookies.
          </p>
        </section>
        <section className="flex md:gap-2.5 gap-2">
          <button
            // onClick={handleAccept}
            onClick={handleAccept}
            className="bg-[var(--white)] text-[#2B2929] px-6 py-3.5 rounded-full"
          >
            Manage Preferences
          </button>
          <button
            onClick={handleAccept}
            className="bg-[var(--white)] text-[#2B2929] px-6 py-3.5 rounded-full"
          >
            Accept All
          </button>
          <button
            onClick={handleReject}
            className="text-white underline px-4 py-3.5"
          >
            Reject All
          </button>
        </section>
      </article>
    );
  }

  return consent === 'accepted' ? (
    <>
      <GoogleTagManager gtmId="GTM-WB9ZRVTV" />
      <GoogleAnalytics gaId="G-7E3PF0WSSM" />
    </>
  ) : null;
};
