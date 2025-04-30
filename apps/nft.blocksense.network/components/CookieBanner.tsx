'use client';

import { useState, useEffect } from 'react';

export const CookieBanner = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const cookiesAccepted = localStorage.getItem('cookiesAccepted');
    if (!cookiesAccepted) {
      setIsVisible(true);
    }
  }, []);

  const handleCookieAction = () => {
    localStorage.setItem('cookiesAccepted', 'true');
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <article className="cookie-banner fixed bottom-5 right-5 left-5 md:bottom-6 md:right-6 md:left-auto flex flex-col gap-6 p-6 bg-[var(--black)] border border-[var(--gray-dark)] rounded-2xl md:max-w-[30.625rem] md:gap-8 z-50">
      <section className="cookie-banner__content">
        <p className="cookie-banner__text text-sm text-[var(--grey-medium)]">
          We use cookies and similar technologies on our website to enhance your
          experience and personalize content and ads. By continuing to use our
          website/app, you consent to the use of these technologies and the
          processing of your personal data for personalized and non-personalized
          advertising. By clicking 'Accept', you consent to the use of cookies
          and the processing of your data as described above.
        </p>
      </section>
      <section className="cookie-banner__buttons flex md:gap-2.5 gap-2">
        <button
          onClick={handleCookieAction}
          className="bg-[var(--white)] text-[#2B2929] px-6 py-3.5 rounded-full cursor-pointer"
        >
          Accept All
        </button>
        <button
          onClick={handleCookieAction}
          className=" text-white underline px-4 py-3.5 cursor-pointer"
        >
          Reject All
        </button>
      </section>
    </article>
  );
};
