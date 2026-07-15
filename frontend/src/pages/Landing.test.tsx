import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Landing from "./Landing";
import React from "react";

describe("Landing Page", () => {
  const renderLanding = () => {
    return render(
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    );
  };

  it("renders the main heading", () => {
    renderLanding();
    expect(screen.getByText(/Agendamento inteligente para/i)).toBeDefined();
    // Use a more specific query for the hero part
    expect(screen.getByRole("heading", { level: 1, name: /Agendamento inteligente para/i })).toBeDefined();
  });

  it("renders navigation links", () => {
    renderLanding();
    expect(screen.getByText("Entrar")).toBeDefined();
    expect(screen.getByText("Começar Grátis")).toBeDefined();
  });

  it("renders all features from the list", () => {
    renderLanding();
    expect(screen.getByText("Agendamento Inteligente")).toBeDefined();
    expect(screen.getByText("Multi-Tenant")).toBeDefined();
    expect(screen.getByText("Analytics Avançado")).toBeDefined();
    expect(screen.getByText("Notificações Automáticas")).toBeDefined();
    expect(screen.getByText("Fidelidade")).toBeDefined();
    expect(screen.getByText("Página Personalizada")).toBeDefined();
  });

  it("has the correct link for 'Entrar'", () => {
    renderLanding();
    const loginLink = screen.getByText("Entrar").closest("a");
    expect(loginLink?.getAttribute("href")).toBe("/auth");
  });

  it("has the correct link for 'Começar Grátis'", () => {
    renderLanding();
    const signupLink = screen.getByText("Começar Grátis").closest("a");
    expect(signupLink?.getAttribute("href")).toBe("/auth?mode=signup");
  });
});
