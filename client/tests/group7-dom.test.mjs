import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { JSDOM } from "jsdom";
import { build } from "esbuild";
test("Group 7 real UI: statements, consent, PDF sharing and keyboard sale", async (t) => {
  const client = path.resolve(import.meta.dirname, ".."),
    cache = path.join(client, "node_modules/.cache");
  await fs.mkdir(cache, { recursive: true });
  const folder = await fs.mkdtemp(path.join(cache, "group7-dom-"));
  const dom = new JSDOM(
    '<!doctype html><html><body><div id="root"></div></body></html>',
    { url: "http://localhost/" },
  );
  for (const key of [
    "window",
    "document",
    "HTMLElement",
    "HTMLInputElement",
    "HTMLTextAreaElement",
    "Element",
    "Node",
    "MutationObserver",
    "DocumentFragment",
    "Event",
    "localStorage",
    "sessionStorage",
  ])
    globalThis[key] = dom.window[key];
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
  });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.getComputedStyle = window.getComputedStyle.bind(window);
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  globalThis.cancelAnimationFrame = clearTimeout;
  window.matchMedia = (q) => ({
    matches: false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });
  const customer = {
      id: "customer",
      name: "Demo customer",
      email: "customer@example.com",
      reminderOptIn: true,
    },
    calls = [],
    pagination = { page: 1, limit: 25, total: 1, totalPages: 1 };
  let root,
    React,
    C,
    shared = [];
  globalThis.__group7Api = {
    get: async (url, config) => {
      calls.push({ method: "get", url, config });
      if (url.endsWith(".pdf"))
        return {
          data: new Blob(["%PDF-1.3 fixture"], { type: "application/pdf" }),
        };
      if (url.endsWith("/statement"))
        return {
          data: {
            rows: [
              {
                id: "row",
                date: "2026-11-13T12:00:00Z",
                type: "SALE",
                reference: "INV-1",
                debit: 10,
                credit: 0,
                balance: 10,
              },
            ],
            openingBalance: 0,
            closingBalance: 10,
            debits: 10,
            credits: 0,
            pagination,
          },
        };
      if (url.endsWith("/aging"))
        return { data: { days0to30: 10, days31to60: 0, days61plus: 0 } };
      if (url.endsWith("/reminders"))
        return { data: { enabled: false, jobs: [] } };
      if (url.includes("reminder-preview"))
        return {
          data: {
            recipient: customer.email,
            subject: "Reminder",
            body: "Balance: 10 USD",
            debt: 10,
          },
        };
      return { data: { categories: [], products: [], pagination } };
    },
    put: async (url, data) => {
      calls.push({ method: "put", url, data });
      return { data: { customer: { ...customer, ...data } } };
    },
    post: async (url, data) => {
      calls.push({ method: "post", url, data });
      return {
        data: {
          order: {
            id: "new-sale",
            invoiceNumber: "INV-2",
            customer: { id: "new-customer", name: "Buyer" },
          },
        },
      };
    },
  };
  try {
    await build({
      stdin: {
        contents:
          'import React from "react";import {createRoot} from "react-dom/client";import {MemoryRouter} from "react-router-dom";import Statement from "./src/components/CustomerStatement";import Reminder from "./src/components/ReminderDialog";import Sales from "./src/pages/SalesPage";import * as runtime from "./src/i18n/runtime";export {React,createRoot,MemoryRouter,Statement,Reminder,Sales,runtime};',
        loader: "jsx",
        resolveDir: client,
      },
      outfile: path.join(folder, "components.cjs"),
      bundle: true,
      loader: { ".png": "dataurl", ".css": "empty" },
      platform: "node",
      format: "cjs",
      jsx: "automatic",
      external: [
        "react",
        "react/*",
        "react-dom",
        "react-dom/*",
        "react-router-dom",
        "@mui/material",
        "@mui/material/*",
        "@mui/system",
        "@mui/system/*",
        "@mui/utils",
        "@emotion/*",
      ],
      plugins: [
        {
          name: "fixture",
          setup(b) {
            b.onResolve({ filter: /(^|\/)api$/ }, () => ({
              path: "api",
              namespace: "fixture",
            }));
            b.onResolve({ filter: /features\/auth\/useAuth$/ }, () => ({
              path: "auth",
              namespace: "fixture",
            }));
            b.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
              contents:
                path === "api"
                  ? "export const api={get:(...args)=>globalThis.__group7Api.get(...args),post:(...args)=>globalThis.__group7Api.post(...args),put:(...args)=>globalThis.__group7Api.put(...args)};"
                  : 'export function useAuth(){return {user:{id:"admin",role:"ADMIN",company:{id:"company",currency:"USD",currencyConfigured:true,features:[]}}}}',
              loader: "js",
            }));
          },
        },
      ],
    });
    C = createRequire(import.meta.url)(path.join(folder, "components.cjs"));
    React = C.React;
    const render = async (component, props = {}) => {
      if (root) await React.act(async () => root.unmount());
      root = C.createRoot(document.getElementById("root"));
      await React.act(async () =>
        root.render(
          React.createElement(
            C.MemoryRouter,
            null,
            React.createElement(component, props),
          ),
        ),
      );
      await React.act(async () => {
        await new Promise((r) => setTimeout(r, 260));
      });
    };
    await t.test(
      "statement renders full balance and localized age buckets in all four languages",
      async () => {
        for (const language of ["en", "az", "tr", "ru"]) {
          await React.act(async () => C.runtime.setLanguage(language));
          await render(C.Statement, { customer, onClose() {} });
          assert.ok(
            document.body.textContent.includes(
              C.runtime.t("Account statement"),
            ),
          );
          assert.ok(
            document.body.textContent.includes(C.runtime.t("0–30 days")),
          );
          assert.ok(
            document.body.textContent.includes(C.runtime.formatMoney(10)),
          );
          assert.ok(document.body.textContent.includes("INV-1"));
        }
      },
    );
    await t.test(
      "prepared PDF is shared only after an explicit user action",
      async () => {
        navigator.canShare = () => true;
        navigator.share = async (args) => shared.push(args);
        const button = [...document.querySelectorAll("button")].find(
          (b) => b.textContent === C.runtime.t("Share PDF"),
        );
        assert.ok(button && !button.disabled);
        assert.equal(shared.length, 0);
        await React.act(async () => button.click());
        assert.equal(shared.length, 1);
        assert.equal(shared[0].files[0].name, "statement.pdf");
        assert.equal(shared[0].files[0].type, "application/pdf");
      },
    );
    await t.test(
      "editing the recipient clears consent; SMTP disabled leaves queue action unavailable",
      async () => {
        await React.act(async () => C.runtime.setLanguage("en"));
        await render(C.Reminder, { customer, onClose() {} });
        const checkbox = document.querySelector("input[type=checkbox]");
        assert.equal(checkbox.checked, true);
        const input = document.querySelector("input[type=email]");
        await React.act(async () => {
          Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            "value",
          ).set.call(input, "changed@example.com");
          input.dispatchEvent(new window.Event("input", { bubbles: true }));
        });
        assert.equal(checkbox.checked, false);
        assert.ok(document.body.textContent.includes("Configure SMTP"));
        assert.equal(
          calls.filter(
            (c) => c.method === "post" && c.url.endsWith("/reminders"),
          ).length,
          0,
        );
      },
    );
    await t.test(
      "Ctrl+Enter confirms a valid fractional sale with selected tax and discount",
      async () => {
        sessionStorage.setItem(
          "z-index-operation:company:admin:sale:",
          JSON.stringify({
            mode: "new",
            newCustomer: {
              name: "Buyer",
              phone: "",
              salon: "",
              address: "",
              lat: null,
              lng: null,
            },
            lines: [
              {
                key: "p:sale",
                productId: "p",
                name: "Coffee",
                unit: "KG",
                quantity: 0.333,
                unitPrice: 10,
                stockQty: 10,
                isGift: false,
              },
            ],
            discountPercent: "10",
            taxPercent: "18",
            paymentMode: "none",
            note: "",
          }),
        );
        await render(C.Sales);
        await React.act(async () =>
          window.dispatchEvent(
            new window.KeyboardEvent("keydown", {
              key: "Enter",
              ctrlKey: true,
              bubbles: true,
              cancelable: true,
            }),
          ),
        );
        const sale = calls.find(
          (c) => c.method === "post" && c.url === "/orders",
        );
        assert.ok(sale);
        assert.equal(sale.data.items[0].quantity, 0.333);
        assert.equal(sale.data.discountPercent, 10);
        assert.equal(sale.data.taxPercent, 18);
      },
    );
  } finally {
    if (root) await React.act(async () => root.unmount());
    dom.window.close();
    delete globalThis.__group7Api;
    await fs.rm(folder, { recursive: true, force: true });
  }
});
