import trialPolicy from "../../../shared/trial.json";
import { createElement, useEffect, useState } from "react";
import { Button } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import ArrowDownwardRounded from "@mui/icons-material/ArrowDownwardRounded";
import BusinessRounded from "@mui/icons-material/BusinessRounded";
import CalendarMonthRounded from "@mui/icons-material/CalendarMonthRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import EventRepeatRounded from "@mui/icons-material/EventRepeatRounded";
import FileUploadOutlined from "@mui/icons-material/FileUploadOutlined";
import GroupOutlined from "@mui/icons-material/GroupOutlined";
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import WalletOutlined from "@mui/icons-material/WalletOutlined";
import PublicLayout from "../components/PublicLayout";
import { useI18n } from "../i18n/useI18n";
import { formatNumber, formatSubscriptionPrice } from "../i18n/runtime";
import { api } from "../lib/api";
import prices from "../../../shared/pricing.json";
import "./landing.css";

const features = [
  {
    Icon: Inventory2Outlined,
    style: "blue",
    title: "Inventory without guesswork",
    description: "Receive purchases, check balances and see stock movement history.",
  },
  {
    Icon: FileUploadOutlined,
    style: "teal",
    title: "Bring your existing customers",
    description: "Import Excel or CSV with customer contacts and opening debt or credit.",
  },
  {
    Icon: GroupOutlined,
    style: "violet",
    title: "Built around your business",
    description: "Up to 3 active users, four interface languages, PDF invoices and your operating currency.",
  },
];

function WorkspacePreview({ t, money }) {
  const activity = [
    [Inventory2Outlined, "Purchase received", "+24", "blue"],
    [ReceiptLongOutlined, "Sale recorded", money(48, "USD"), "violet"],
    [WalletOutlined, "Payment received", money(30, "USD"), "teal"],
  ];

  return (
    <section className="landing-preview" aria-labelledby="workspace-preview-title">
      <div className="landing-preview-header">
        <div className="landing-preview-title">
          <img src="/brand-icon.svg" alt="" width="25" height="25" />
          <h2 id="workspace-preview-title">{t("Workspace overview")}</h2>
        </div>
        <span className="landing-example">{t("Example workspace")}</span>
      </div>
      <dl className="landing-metrics">
        <div>
          <dt>{t("Inventory")}</dt>
          <dd>{formatNumber(126)}</dd>
        </div>
        <div>
          <dt>{t("Customer balances")}</dt>
          <dd>{money(125.50, "USD")}</dd>
        </div>
      </dl>
      <h3 className="landing-activity-heading">{t("Recent activity")}</h3>
      <ul className="landing-activity">
        {activity.map(([Icon, label, value, style]) => (
          <li key={label}>
            <span className={`landing-icon ${style}`}>{createElement(Icon, { "aria-hidden": true })}</span>
            <span>{t(label)}</span>
            <strong>{value}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CompanyCount({ t }) {
  const [count, setCount] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    api.get("/public/stats", { anonymous: true, signal: controller.signal })
      .then(({ data }) => {
        if (Number.isSafeInteger(data.activeCompanies) && data.activeCompanies >= 25) {
          setCount(data.activeCompanies);
        }
      })
      .catch(() => { /* The landing page works without this statistic. */ });
    return () => controller.abort();
  }, []);

  const isExample = count === null && import.meta.env.DEV;
  if (count === null && !isExample) return null;

  return (
    <section className="landing-company-count" aria-labelledby="landing-company-heading">
      <div className="landing-company-content">
        <h2 id="landing-company-heading">
          <strong className="landing-company-number">{formatNumber(count ?? 25)}</strong>{" "}
          <span>{t("active companies use z-Index")}</span>
        </h2>
        {isExample && <span className="landing-company-example">{t("Example data")}</span>}
      </div>
      <div className="landing-company-art" aria-hidden="true">
        <div className="landing-company-tile landing-company-tile-small"><BusinessRounded /></div>
        <div className="landing-company-tile landing-company-tile-main"><BusinessRounded /></div>
        <div className="landing-company-tile landing-company-tile-small"><BusinessRounded /></div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const { t, money, language } = useI18n();
  const [cycle, setCycle] = useState("MONTHLY");
  const starter = prices[language === "az" ? "AZ" : "GLOBAL"].BASIC;
  const yearly = cycle === "YEARLY";
  const twelveMonths = starter.MONTHLY * 12;
  const yearlySavings = twelveMonths - starter.YEARLY;
  const price = (amountMinor) => formatSubscriptionPrice(amountMinor, starter.currency);

  return (
    <PublicLayout>
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <p className="landing-kicker">{t("Inventory & sales software")}</p>
          <h1 id="landing-title">{t("Stock, sales and customer balances in one place.")}</h1>
          <p className="landing-intro">{t("Track what comes in, what sells and what customers owe. Import your existing customers and balances to get started.")}</p>
          <div className="landing-actions">
            <Button component={RouterLink} to="/trial" variant="contained" size="large" endIcon={<ArrowForwardRounded />}>
              {t("Start your {days}-day free trial", { days: trialPolicy.days })}
            </Button>
            <Button href="#pricing" variant="text" size="large" endIcon={<ArrowDownwardRounded />} sx={{ color: "#e9efff" }}>
              {t("See pricing")}
            </Button>
          </div>
          <p className="landing-trial-note"><CheckRounded aria-hidden="true" />{t("No card required. No automatic charge during the trial.")}</p>
        </div>
        <WorkspacePreview t={t} money={money} />
      </section>

      <CompanyCount t={t} />

      <section className="landing-features" aria-labelledby="landing-features-title">
        <h2 id="landing-features-title">{t("What you can do with z-Index")}</h2>
        <div className="landing-feature-grid">
          {features.map(({ Icon, style, title, description }) => (
            <article className="landing-feature" key={title}>
              <span className={`landing-icon ${style}`}>{createElement(Icon, { "aria-hidden": true })}</span>
              <h3>{t(title)}</h3>
              <p>{t(description)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-pricing" id="pricing" aria-labelledby="landing-pricing-title">
        <div className="landing-pricing-copy">
          <h2 id="landing-pricing-title">{t("Simple Starter pricing")}</h2>
          <p>{t("Try the Starter plan for {days} days. Choose a subscription when you are ready.", { days: trialPolicy.days })}</p>
          <ul>
            {["Up to 3 active users", "PDF invoices", "Excel and CSV import"].map(label => (
              <li key={label}><CheckRounded aria-hidden="true" />{t(label)}</li>
            ))}
          </ul>
        </div>

        <div className="landing-price-card">
          <div className="landing-billing-toggle" role="group" aria-label={t("Billing cycle")}>
            <button type="button" className="landing-billing-option" aria-pressed={!yearly} aria-label={t("Monthly billing")} onClick={() => setCycle("MONTHLY")}>
              <EventRepeatRounded aria-hidden="true" />
              <span>{t("Monthly billing")}</span>
            </button>
            <button type="button" className="landing-billing-option" aria-pressed={yearly} aria-label={t("Yearly billing")} aria-describedby="landing-yearly-discount" onClick={() => setCycle("YEARLY")}>
              <CalendarMonthRounded aria-hidden="true" />
              <span>{t("Yearly billing")}</span>
              <span id="landing-yearly-discount" className="landing-billing-discount">{t("Save {amount}", { amount: price(yearlySavings) })}</span>
            </button>
          </div>

          <div className="landing-price-details" aria-live="polite">
            <div className="landing-price">
              <strong>{price(starter[cycle])}</strong>
              <span>{yearly ? t("per year") : t("per month")}</span>
            </div>
            {yearly && (
              <div className="landing-price-reference">
                <s>{price(twelveMonths)}</s>
                <span>{t("12 monthly payments")}</span>
              </div>
            )}
          </div>

          <Button component={RouterLink} to="/trial" variant="contained" size="large" fullWidth endIcon={<ArrowForwardRounded />}>
            {t("Start your {days}-day free trial", { days: trialPolicy.days })}
          </Button>
          <p className="landing-tax-note">{t("Applicable taxes and final charges are shown before payment.")}</p>
        </div>
      </section>

    </PublicLayout>
  );
}
