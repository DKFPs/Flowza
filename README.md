# Flowza - Inteligência e Gestão de Agendamentos SaaS 🚀

Flowza é um ecossistema SaaS completo e inteligente projetado para otimizar, gerenciar e automatizar fluxos de agendamentos e fidelidade para barbearias, salões e negócios de serviços.

## 🛠️ Tecnologias Principais
- **Frontend**: React 18, Vite, Tailwind CSS, TanStack Query, Framer Motion, Lucide Icons.
- **Backend/API**: Node.js, Express, Firebase Admin SDK.
- **Banco de Dados & Autenticação**: Firebase Firestore & Firebase Auth.
- **Bot Protection**: Cloudflare Turnstile.
- **Billing & Subscriptions**: Stripe (Checkout Sessions & Webhooks com derivação de plano segura).

---

## 🔒 Segurança e Práticas de Produção Enrijecidas
1. **Comunicação Segura**: Toda manipulação de dados sensíveis (`appointments`, `reviews`, `loyalty_points`, etc.) foi centralizada em endpoints Express protegidos usando o Firebase Admin SDK, removendo completamente os privilégios públicos do Firestore Rules.
2. **Cloudflare Turnstile**: Integrado de ponta a ponta no fluxo de agendamento público para bloquear robôs e requisições maliciosas.
3. **Stripe Webhook Enrijecido**: Validação mandatória de assinaturas em produção, com derivação de plano direta da API do Stripe, prevenindo manipulação ou fraude de metadados.
4. **Proteção de Logs**: O endpoint `/api/log` possui limitação de tamanho de payload, saneamento e limitação de taxa por IP/Empresa.

---

## 🚀 Principais Comandos

### Instalação de Dependências
```bash
npm install
```

### Ambiente de Desenvolvimento
```bash
npm run dev
```

### Validação de Produção
Antes de qualquer deploy, valide a segurança e a presença das variáveis de ambiente críticas:
```bash
npm run validate:prod
```

### Compilação de Produção
Gera os estáticos otimizados do frontend e o bundle consolidado do servidor Express:
```bash
npm run build
```

### Executar Linter
```bash
npm run lint
```

### Executar Testes
```bash
npm run test:all
```

---

## ⚙️ Variáveis de Ambiente Necessárias (.env)
```env
# Firebase Admin Configuration
FIREBASE_SERVICE_ACCOUNT=... # JSON stringified account key

# Stripe Keys
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...

# Stripe Price IDs
STRIPE_PRICE_PRO_MONTHLY=...
STRIPE_PRICE_BUSINESS_MONTHLY=...
STRIPE_PRICE_PREMIUM_MONTHLY=...

# Cloudflare Turnstile bot protection
TURNSTILE_SECRET_KEY=...
VITE_TURNSTILE_SITE_KEY=...
```
