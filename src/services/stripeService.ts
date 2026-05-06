export const StripeService = {
  async createCheckoutSession(params: {
    priceId: string;
    customerEmail?: string;
    discountCode?: string;
    businessId?: string;
    planId?: string;
  }) {
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...params,
        successUrl: `${window.location.origin}/dashboard/plans?success=true`,
        cancelUrl: `${window.location.origin}/dashboard/plans?cancel=true`,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create checkout session");
    }

    return await response.json();
  },
};
