// Define the gtag function globally
declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

let isInitialized = false;

// Initialize Google Analytics
export const initGA = () => {
  const measurementId = process.env['NEXT_PUBLIC_GA_MEASUREMENT_ID'];

  if (!measurementId) {
    console.warn(
      'Missing required Google Analytics key: NEXT_PUBLIC_GA_MEASUREMENT_ID',
    );
    return;
  }

  if (isInitialized) {
    return; // Prevent double initialization
  }

  // Add Google Analytics script to the head
  const script1 = document.createElement('script');
  script1.async = true;
  script1.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script1);

  // Initialize gtag
  const script2 = document.createElement('script');
  script2.textContent = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${measurementId}');
  `;
  document.head.appendChild(script2);

  isInitialized = true;
};

// Track page views - useful for single-page applications
export const trackPageView = (url: string) => {
  if (typeof window === 'undefined' || !window.gtag) return;

  const measurementId = process.env['NEXT_PUBLIC_GA_MEASUREMENT_ID'];
  if (!measurementId) return;

  window.gtag('config', measurementId, {
    page_path: url,
  });
};

// Track events
export const trackEvent = (
  action: string,
  category?: string,
  label?: string,
  value?: number,
) => {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
  });
};
