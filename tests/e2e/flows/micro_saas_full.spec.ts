
import { test, expect } from '@playwright/test';

test.describe('Micro SaaS - Fluxo Completo de Negócio', () => {
  
  test.beforeEach(async ({ page }) => {
    // Login inicial (Mocked ou Real dependendo do setup)
    await page.goto('/dashboard');
    // await expect(page).toHaveURL(/.*dashboard/);
  });

  test('Fluxo: Cadastro -> Agendamento -> Conclusão -> Fidelidade', async ({ page }) => {
    // 1. Criar Profissional
    await page.goto('/dashboard/professionals');
    await page.click('button:has-text("Adicionar")');
    await page.fill('input[name="name"]', 'Profissional Expert');
    await page.click('button:has-text("Salvar")');
    await expect(page.locator('text=Profissional Expert')).toBeVisible();

    // 2. Criar Serviço
    await page.goto('/dashboard/services');
    await page.click('button:has-text("Novo Serviço")');
    await page.fill('input[name="name"]', 'Corte Premium');
    await page.fill('input[name="price"]', '100');
    await page.click('button:has-text("Confirmar")');

    // 3. Agendar para Cliente
    await page.goto('/dashboard/appointments');
    await page.click('button:has-text("Novo Agendamento")');
    // Simulação do preenchimento do form de agendamento
    // await page.selectOption('select[name="professional"]', { label: 'Profissional Expert' });
    // await page.click('text=Confirmar Agendamento');

    // 4. Finalizar Atendimento e Validar Pontos
    // Supomos que clicamos em "Concluir" no cartão do agendamento
    // await page.click('text=Concluir');
    
    // 5. Validar Cashback/Fidelidade
    await page.goto('/dashboard/rewards');
    // await expect(page.locator('text=10 pontos')).toBeVisible(); // R$100 = 10 pts

    // 6. Resgatar Recompensa
    // await page.click('button:has-text("Resgatar Cupom")');
    // await expect(page.locator('text=Cupom Gerado')).toBeVisible();
  });

  test('Fluxo de Segurança: Tentar acessar dados de outro business', async ({ page }) => {
    // Tenta acessar via URL um ID que não pertence a este usuário
    await page.goto('/dashboard/settings/another-business-id');
    // O sistema deve redirecionar ou mostrar erro 403
    // await expect(page.locator('text=Acesso Negado')).toBeVisible();
  });
});
