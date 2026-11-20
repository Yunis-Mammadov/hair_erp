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
const PRICES = Object.freeze(require("../../../shared/pricing.json"));
function hasFeature(company, feature) {
  return Boolean(PLANS[company?.plan]?.features.includes(feature));
}
function isTrial(company) { return Boolean(company?.trialStartedAt && !company.trialConvertedAt); }
function trialInfo(company,now=new Date()) {
 if(!company.trialStartedAt)return null;
 const endsAt=company.trialEndsAt;
 return {status:company.trialConvertedAt?'converted':endsAt&&endsAt>now?'active':'expired',startedAt:company.trialStartedAt,endsAt,convertedAt:company.trialConvertedAt||null,daysRemaining:company.trialConvertedAt?0:Math.max(0,Math.ceil((+endsAt-+now)/86400000))};
}
function subscriptionIsActive(company, now = new Date()) {
  return Boolean(
    company?.isActive &&
      !company.operatorSuspended &&
      company.startsAt <= now &&
      company.endsAt &&
      company.endsAt > now &&
      (!isTrial(company) || (company.trialEndsAt && company.trialEndsAt > now)),
  );
}
function publicCompany(company) {
  const plan = PLANS[company.plan];
  const offer = PRICES[company.market]?.[company.plan];
  return {
    id: company.id,
    trial: trialInfo(company),
    isDemo: company.isDemo,
    operatorSuspended: company.operatorSuspended,
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
  isTrial,
  trialInfo,
  PLANS,
  PRICES,
  hasFeature,
  subscriptionIsActive,
  publicCompany,
};