import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogType?: string;
  ogUrl?: string;
  ogImage?: string;
  noindex?: boolean;
}

export function useSEO({
  title,
  description,
  keywords,
  ogTitle,
  ogDescription,
  ogType = 'website',
  ogUrl,
  ogImage,
  noindex,
}: SEOProps) {
  useEffect(() => {
    // Update title
    document.title = title;

    // Helper to create or update meta tags
    const updateOrCreateMeta = (nameOrProperty: string, value: string, isProperty = false) => {
      const attribute = isProperty ? 'property' : 'name';
      let element = document.querySelector(`meta[${attribute}="${nameOrProperty}"]`);
      
      if (value) {
        if (!element) {
          element = document.createElement('meta');
          element.setAttribute(attribute, nameOrProperty);
          document.head.appendChild(element);
        }
        element.setAttribute('content', value);
      } else if (element) {
        element.remove();
      }
    };

    // Update meta tags
    updateOrCreateMeta('description', description);
    if (keywords) {
      updateOrCreateMeta('keywords', keywords);
    }
    updateOrCreateMeta('og:title', ogTitle || title, true);
    updateOrCreateMeta('og:description', ogDescription || description, true);
    updateOrCreateMeta('og:type', ogType, true);
    
    if (ogUrl) {
      updateOrCreateMeta('og:url', ogUrl, true);
    } else {
      updateOrCreateMeta('og:url', window.location.href, true);
    }
    
    if (ogImage) {
      updateOrCreateMeta('og:image', ogImage, true);
    }
    
    // Handle index/noindex
    updateOrCreateMeta('robots', noindex ? 'noindex, nofollow' : 'index, follow');

    // Canonical link
    let canonical = document.querySelector('link[rel="canonical"]');
    const href = ogUrl || window.location.href;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', href);
  }, [title, description, keywords, ogTitle, ogDescription, ogType, ogUrl, ogImage, noindex]);
}
