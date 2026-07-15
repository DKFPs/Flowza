import React from 'react';
import { useParams } from 'react-router-dom';

const PublicBusinessPage: React.FC = () => {
  const { businessSlug } = useParams();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Bem-vindo ao Estabelecimento</h1>
        <p className="text-gray-600 mb-6">Slug do Negócio: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{businessSlug}</span></p>
        
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-left">Nossos Serviços</h2>
          <div className="grid gap-4">
            <a href={`/${businessSlug}/corte-premium`} className="block p-4 border rounded-lg hover:border-black transition-colors text-left">
              <h3 className="font-bold underline text-blue-600">Corte Premium em São Paulo</h3>
              <p className="text-sm text-gray-500">R$ 100,00 • 30 min</p>
            </a>
          </div>
        </div>

        <button className="mt-8 w-full bg-black text-white py-3 rounded-lg font-bold hover:bg-gray-800 transition-colors">
          Agendar Agora
        </button>
      </div>
    </div>
  );
};

export default PublicBusinessPage;
