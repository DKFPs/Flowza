# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: flows/micro_saas_full.spec.ts >> Micro SaaS - Fluxo Completo de Negócio >> Fluxo: Cadastro -> Agendamento -> Conclusão -> Fidelidade
- Location: tests/e2e/flows/micro_saas_full.spec.ts:12:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('button:has-text("Adicionar")')

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - region "Notifications (F8)":
    - list
  - region "Notifications alt+T"
  - generic [ref=e4]:
    - link "AgendaPro" [ref=e5] [cursor=pointer]:
      - /url: /
      - generic [ref=e6]: AgendaPro
    - generic [ref=e7]:
      - heading "Entrar" [level=1] [ref=e8]
      - paragraph [ref=e9]: Acesse sua conta
      - generic [ref=e10]:
        - generic [ref=e11]:
          - generic [ref=e12]: Email
          - textbox "email@exemplo.com" [ref=e13]
        - generic [ref=e14]:
          - generic [ref=e15]:
            - generic [ref=e16]: Senha
            - button "Esqueci minha senha" [ref=e17] [cursor=pointer]
          - textbox "••••••••" [ref=e18]
        - button "Entrar" [ref=e19] [cursor=pointer]
      - paragraph [ref=e20]:
        - text: Não tem conta?
        - button "Cadastrar" [ref=e21] [cursor=pointer]
```

# Test source

```ts
  1  | 
  2  | import { test, expect } from '@playwright/test';
  3  | 
  4  | test.describe('Micro SaaS - Fluxo Completo de Negócio', () => {
  5  |   
  6  |   test.beforeEach(async ({ page }) => {
  7  |     // Login inicial (Mocked ou Real dependendo do setup)
  8  |     await page.goto('/dashboard');
  9  |     // await expect(page).toHaveURL(/.*dashboard/);
  10 |   });
  11 | 
  12 |   test('Fluxo: Cadastro -> Agendamento -> Conclusão -> Fidelidade', async ({ page }) => {
  13 |     // 1. Criar Profissional
  14 |     await page.goto('/dashboard/professionals');
> 15 |     await page.click('button:has-text("Adicionar")');
     |                ^ Error: page.click: Test timeout of 30000ms exceeded.
  16 |     await page.fill('input[name="name"]', 'Profissional Expert');
  17 |     await page.click('button:has-text("Salvar")');
  18 |     await expect(page.locator('text=Profissional Expert')).toBeVisible();
  19 | 
  20 |     // 2. Criar Serviço
  21 |     await page.goto('/dashboard/services');
  22 |     await page.click('button:has-text("Novo Serviço")');
  23 |     await page.fill('input[name="name"]', 'Corte Premium');
  24 |     await page.fill('input[name="price"]', '100');
  25 |     await page.click('button:has-text("Confirmar")');
  26 | 
  27 |     // 3. Agendar para Cliente
  28 |     await page.goto('/dashboard/appointments');
  29 |     await page.click('button:has-text("Novo Agendamento")');
  30 |     // Simulação do preenchimento do form de agendamento
  31 |     // await page.selectOption('select[name="professional"]', { label: 'Profissional Expert' });
  32 |     // await page.click('text=Confirmar Agendamento');
  33 | 
  34 |     // 4. Finalizar Atendimento e Validar Pontos
  35 |     // Supomos que clicamos em "Concluir" no cartão do agendamento
  36 |     // await page.click('text=Concluir');
  37 |     
  38 |     // 5. Validar Cashback/Fidelidade
  39 |     await page.goto('/dashboard/rewards');
  40 |     // await expect(page.locator('text=10 pontos')).toBeVisible(); // R$100 = 10 pts
  41 | 
  42 |     // 6. Resgatar Recompensa
  43 |     // await page.click('button:has-text("Resgatar Cupom")');
  44 |     // await expect(page.locator('text=Cupom Gerado')).toBeVisible();
  45 |   });
  46 | 
  47 |   test('Fluxo de Segurança: Tentar acessar dados de outro business', async ({ page }) => {
  48 |     // Tenta acessar via URL um ID que não pertence a este usuário
  49 |     await page.goto('/dashboard/settings/another-business-id');
  50 |     // O sistema deve redirecionar ou mostrar erro 403
  51 |     // await expect(page.locator('text=Acesso Negado')).toBeVisible();
  52 |   });
  53 | });
  54 | 
```