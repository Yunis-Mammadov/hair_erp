const COMMON = [
  "catalog",
  "purchases",
  "stock",
  "sales",
  "customers",
  "payments",
  "returns",
  "basicReports",
  "uploads",
];
const PLANS = Object.freeze({
  BASIC: { maxUsers: 3, maxWarehouses: 1, features: COMMON },
  BUSINESS: {
    maxUsers: 10,
    maxWarehouses: 3,
    features: [...COMMON, "teamManagement", "customerAssignments"],
  },
  PREMIUM: {
    maxUsers: 20,
    maxWarehouses: 5,
    features: [
      ...COMMON,
      "teamManagement",
      "customerAssignments",
      "delivery",
      "liveLocation",
      "deliverySignatures",
    ],
  },
});
// Subscription prices in the minor units of the subscription currency.
const PRICES = Object.freeze({
  AZ: {
    BASIC: { currency: "AZN", MONTHLY: 5000, YEARLY: 50000 },
    BUSINESS: { currency: "AZN", MONTHLY: 15000, YEARLY: 150000 },
    PREMIUM: { currency: "AZN", MONTHLY: 29900, YEARLY: 250000 },
  },
  GLOBAL: { BASIC: { currency: "USD", MONTHLY: 1499, YEARLY: 14999 } },
});
function hasFeature(company, feature) {
  return Boolean(PLANS[company?.plan]?.features.includes(feature));
}
function subscriptionIsActive(company, now = new Date()) {
  return Boolean(
    company?.isActive &&
      company.startsAt <= now &&
      company.endsAt &&
      company.endsAt > now,
  );
}
function publicCompany(company) {
  const plan = PLANS[company.plan];
  const offer = PRICES[company.market]?.[company.plan];
  return {
    id: company.id,
    name: company.name,
    loginEmail: company.loginEmail,
    plan: company.plan,
    market: company.market,
    billingCycle: company.billingCycle,
    currency: company.currency,
    locale: company.locale,
    timezone: company.timezone,
    address: company.address,
    phone: company.phone,
    taxId: company.taxId,
    invoicePrefix: company.invoicePrefix,
    supportEmail: company.supportEmail,
    logoUrl: company.logoUrl,
    currencyConfigured: company.currencyConfigured,
    startsAt: company.startsAt,
    endsAt: company.endsAt,
    features: [...plan.features],
    limits: { maxUsers: plan.maxUsers, maxWarehouses: plan.maxWarehouses },
    subscriptionPrice: offer
      ? { currency: offer.currency, amountMinor: offer[company.billingCycle] }
      : null,
  };
}
module.exports = {
  PLANS,
  PRICES,
  hasFeature,
  subscriptionIsActive,
  publicCompany,
};