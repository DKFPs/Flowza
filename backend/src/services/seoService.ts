
export interface SEOMetadata {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
  schemaMarkup?: any;
}

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

export function generateSchemaMarkup(type: 'LocalBusiness' | 'Service', data: any) {
  if (type === 'LocalBusiness') {
    return {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": data.businessName,
      "image": data.image || "https://flowza.app/default-og.jpg",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": data.city,
        "addressRegion": data.state || "SP",
        "addressCountry": "BR"
      },
      "url": `https://flowza.app/${data.slug}`,
      "telephone": data.phone
    };
  }
  
  if (type === 'Service') {
    return {
      "@context": "https://schema.org",
      "@type": "Service",
      "serviceType": data.serviceName,
      "provider": {
        "@type": "LocalBusiness",
        "name": data.businessName
      },
      "areaServed": {
        "@type": "City",
        "name": data.city
      },
      "hasOfferCatalog": {
        "@type": "OfferCatalog",
        "name": "Serviços de Agendamento",
        "itemListElement": [
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": data.serviceName
            }
          }
        ]
      }
    };
  }
}

export function generateAutoSEO(
  type: 'business' | 'service' | 'location-service',
  data: { 
    businessName: string; 
    serviceName?: string; 
    city?: string; 
    customDesc?: string;
    slug: string;
    category?: string;
  },
  plan: 'FREE' | 'PRO' | 'BUSINESS' | 'PREMIUM'
): SEOMetadata {
  const citySuffix = data.city ? ` em ${data.city}` : '';
  
  let title = '';
  let description = '';
  let schema = null;

  if (type === 'service' && data.serviceName) {
    title = `${data.serviceName}${citySuffix} - ${data.businessName}`;
    description = `Agende ${data.serviceName}${citySuffix} com ${data.businessName}. Atendimento profissional e qualidade garantida.`;
    schema = generateSchemaMarkup('Service', data);
  } else if (type === 'location-service' && data.serviceName && data.city) {
    title = `Melhor ${data.serviceName} em ${data.city} | Agendamento Online`;
    description = `Procurando ${data.serviceName} em ${data.city}? Veja os melhores profissionais e agende seu horário online agora mesmo.`;
    schema = generateSchemaMarkup('Service', data);
  } else {
    title = `${data.businessName}${citySuffix} - Agendamento Online`;
    description = `Agende seus horários com ${data.businessName}${citySuffix}. Praticidade e rapidez no seu atendimento.`;
    schema = generateSchemaMarkup('LocalBusiness', data);
  }

  // Se o plano permitir e houver descrição customizada, substitui
  if (plan !== 'FREE' && data.customDesc) {
    description = data.customDesc;
  }

  return {
    title,
    description,
    canonical: `https://flowza.app/${data.slug}`,
    ogImage: `https://flowza.app/api/og/${data.slug}`,
    schemaMarkup: schema
  };
}
