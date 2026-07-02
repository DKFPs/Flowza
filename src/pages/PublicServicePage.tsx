import React from 'react';
import { useParams } from 'react-router-dom';
import { useSEO } from '@/hooks/useSEO';

const PublicServicePage: React.FC = () => {
  const { businessSlug, serviceSlug } = useParams();

  // Dynamic SEO meta tags based on business and service
  useSEO({
    title: `${serviceSlug ? serviceSlug.charAt(0).toUpperCase() + serviceSlug.slice(1) : 'Serviço'} - ${businessSlug ? businessSlug.charAt(0).toUpperCase() + businessSlug.slice(1) : 'Flowza'}`,
    description: `Agende o serviço ${serviceSlug} no ${businessSlug}. Veja a duração do serviço, valores e os horários livres para fazer seu agendamento online imediato 24h.`,
    keywords: `${serviceSlug}, agendar ${serviceSlug} ${businessSlug}, agendamento online`,
    ogTitle: `${serviceSlug} no estabelecimento ${businessSlug}`,
    ogDescription: `Reserve o seu horário online com facilidade para o serviço ${serviceSlug} em ${businessSlug}.`,
    ogImage: `https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=800`
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="h-64 bg-gray-200 relative">
          <img 
            src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=800" 
            alt="Estabelecimento"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/30" />
        </div>
        
        <div className="p-8">
          <nav className="text-sm text-gray-500 mb-4">
            <a href={`/${businessSlug}`} className="hover:underline">{businessSlug}</a> / <span>{serviceSlug}</span>
          </nav>

          <h1 className="text-4xl font-extrabold text-gray-900 mb-4">Serviço Premium em São Paulo</h1>
          
          <div className="flex gap-6 mb-8 text-lg font-medium text-gray-700">
            <span className="flex items-center gap-2">
               ⏱️ 30 min
            </span>
            <span className="flex items-center gap-2">
               💰 R$ 100,00
            </span>
          </div>

          <article className="prose prose-gray max-w-none mb-8">
            <p>
              O nosso Serviço Premium é a nossa experiência completa de atendimento. Inclui produtos de alta performance, 
              atenção personalizada e o melhor resultado para o seu dia a dia. Perfeito para quem busca excelência 
              em São Paulo.
            </p>
          </article>

          <div className="flex gap-4">
            <button className="flex-1 bg-black text-white py-4 rounded-xl text-xl font-bold hover:scale-[1.02] transition-transform shadow-lg">
              Agendar este Serviço
            </button>
          </div>
        </div>
      </div>

      <footer className="mt-8 text-gray-400 text-sm">
        © 2026 {businessSlug} • Desenvolvido com SEO Automático
      </footer>
    </div>
  );
};

export default PublicServicePage;
