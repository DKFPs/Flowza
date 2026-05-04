import React from 'react';
import { useParams } from 'react-router-dom';

const CityServiceLandingPage: React.FC = () => {
  const { city, service } = useParams();

  // No mundo real, aqui buscaríamos negócios que oferecem esse serviço nessa cidade
  const mockNearBusinesses = [
    { name: "Flowza Studio Concept", rating: 4.9, address: "Rua Augusta, 100" },
    { name: "Premium Wellness", rating: 4.7, address: "Av. Paulista, 1500" }
  ];

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-gray-900 text-white py-16 px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-black mb-4">
          {service} em {city}
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          Encontre os melhores profissionais de {service} em {city}. 
          Agendamento online imediato e avaliações reais de clientes.
        </p>
      </header>

      <main className="max-w-4xl mx-auto py-12 px-4">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">Profissionais Disponíveis</h2>
          <span className="text-gray-500 font-mono text-sm">{mockNearBusinesses.length} resultados encontrados</span>
        </div>

        <div className="grid gap-6">
          {mockNearBusinesses.map((biz, idx) => (
            <div key={idx} className="flex gap-6 p-6 border rounded-2xl hover:shadow-xl transition-all group">
              <div className="w-24 h-24 bg-gray-100 rounded-xl flex-shrink-0 overflow-hidden">
                 <img src={`https://picsum.photos/seed/${biz.name}/200`} alt={biz.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h3 className="text-xl font-bold group-hover:text-blue-600 cursor-pointer">{biz.name}</h3>
                  <div className="flex items-center bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-sm font-bold">
                    ★ {biz.rating}
                  </div>
                </div>
                <p className="text-gray-500 mb-4">{biz.address}</p>
                <div className="flex gap-3">
                  <button className="bg-black text-white px-6 py-2 rounded-lg font-bold text-sm">Agendar</button>
                  <button className="border border-gray-300 px-6 py-2 rounded-lg font-bold text-sm hover:bg-gray-50">Ver Perfil</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* SEO Content Section - Importante para o Google */}
        <section className="mt-20 border-t pt-12 text-gray-600 leading-relaxed">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Por que agendar {service} em {city} pelo nosso sistema?</h2>
          <p className="mb-4">
            Nossa plataforma conecta você aos profissionais mais qualificados de {city}. 
            Seja para um {service} rápido ou um procedimento mais detalhado, 
            garantimos a facilidade do agendamento online 24h por dia.
          </p>
          <p>
            Não perca tempo em filas ou tentando ligar. Compare preços, veja fotos dos serviços 
            anteriores e escolha o melhor horário para você.
          </p>
        </section>
      </main>

      <footer className="bg-gray-50 py-12 px-4 border-t mt-20">
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-8">
          <div>
            <h4 className="font-bold mb-4">Categorias Populares</h4>
            <ul className="text-sm space-y-2 text-gray-500">
              <li>Consultoria em {city}</li>
              <li>Estética em {city}</li>
              <li>Negócios Locais em {city}</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-4">Sobre Flowza</h4>
            <p className="text-sm text-gray-500">Ajudamos negócios locais a crescerem automaticamente através de tecnologia de agendamento e fidelização.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default CityServiceLandingPage;
