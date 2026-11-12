import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import LocalizedTheme from "./i18n/LocalizedTheme";
import I18nProvider from "./i18n/I18nProvider";

import App from "./App.jsx";
import AuthProvider from "./features/auth/AuthProvider.jsx";

import "leaflet/dist/leaflet.css";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>

      <BrowserRouter>
        <AuthProvider>
          <I18nProvider><LocalizedTheme><App /></LocalizedTheme></I18nProvider>
        </AuthProvider>
      </BrowserRouter>

  </React.StrictMode>,
);