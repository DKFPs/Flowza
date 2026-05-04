import React, { useState } from 'react';

const AdminSEOSettings: React.FC = () => {
  const [title, setTitle] = useState("Meu Negócio - Agendamento Online");
  const [desc, setDesc] = useState("Agende seus horários online com praticidade e rapidez. Atendimento de alta qualidade focado em você.");
  const plan = "BUSINESS"; // Mock

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900">Configurações de SEO</h1>
        <p className="text-gray-500">Otimize como seu negócio aparece no Google e redes sociais.</p>
        <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700">
          PLANO {plan}
        </div>
      </header>

      <div className="grid gap-8">
        {/* Preview do Google */}
        <section className="bg-white p-6 border rounded-xl shadow-sm">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Preview do Google</h2>
          <div className="max-w-lg">
            <div className="text-blue-800 text-xl font-medium hover:underline cursor-pointer truncate">
              {title}
            </div>
            <div className="text-green-700 text-sm mb-1">
              https://seu-saas.com/barbearia-do-italo
            </div>
            <div className="text-gray-600 text-sm line-clamp-2">
              {desc}
            </div>
          </div>
        </section>

        {/* Editor */}
        <section className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Meta Title</label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={plan === 'FREE'}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-black outline-none disabled:bg-gray-50"
            />
            {plan === 'FREE' && <p className="mt-1 text-xs text-red-500">Disponível apenas em planos pagos.</p>}
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Meta Description</label>
            <textarea 
              rows={3}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              disabled={plan === 'FREE'}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-black outline-none disabled:bg-gray-50"
            />
          </div>

          <div className="bg-blue-50 p-4 rounded-lg flex gap-3 text-blue-800 text-sm">
            <span>💡</span>
            <p><strong>Dica SEO:</strong> Use palavras-chave como o nome do seu bairro ou cidade para atrair clientes locais.</p>
          </div>

          <button className="bg-black text-white px-8 py-3 rounded-lg font-bold hover:shadow-lg transition-all">
            Salvar Alterações
          </button>
        </section>
      </div>
    </div>
  );
};

export default AdminSEOSettings;
