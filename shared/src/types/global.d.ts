export {};

declare global {
  interface Window {
    fbq?: any;
    ttq?: any;
    gtag?: any;
    dataLayer?: any[];
  }
}
