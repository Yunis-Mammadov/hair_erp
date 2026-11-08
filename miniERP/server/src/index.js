require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { jwtSecret } = require("./auth-security");
const { requireAuth, requireFeature } = require("./middleware/auth.middleware");
const { hasFeature } = require("./config/plans");
const { signImageResponses, serveUpload } = require("./upload-access");
jwtSecret();

const app = express();
app.disable("x-powered-by");
if (process.env.TRUST_PROXY_HOPS)
  app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS));

const ordersRoutes = require("./routes/orders.routes");
const authRoutes = require("./routes/auth.routes");
const expRoutes = require("./routes/expeditor.routes");
const catalogRoutes = require("./routes/catalog.routes");
const stockRoutes = require("./routes/stock.routes");
const customerRoutes = require("./routes/customers.routes");
const expListRoutes = require("./routes/expeditor.list.routes");
const catalogAdminRoutes = require("./routes/catalog.admin.routes");
const returnsRouter = require("./routes/returns.routes");
const purchasesRoutes = require("./routes/purchases.routes");
const paymentsRoutes = require("./routes/payments.routes");
const userRoutes = require("./routes/user.routes");
const areasRoutes = require("./routes/areas.routes");
const deliveryRoutes = require("./routes/delivery.routes");
const liveLocationRoutes = require("./routes/liveLocation.routes");
const uploadsRoutes = require("./routes/uploads.routes");
const areaRoutes = require("./routes/area.routes");
const dashboardRoutes = require("./routes/dashboard.routes");

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  ...(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  "https://hair-erp.vercel.app",
  "https://nanoplasticaaz.vercel.app",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("CORS blocked: " + origin));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", serveUpload);

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api", requireAuth, signImageResponses);
app.use("/api/delivery", requireFeature("delivery"));
app.use("/api/live-location", requireFeature("liveLocation"));
app.use("/api/orders", (req, res, next) => {
  if (/\/(?:seller-signature|signature)$/.test(req.path))
    return requireFeature("deliverySignatures")(req, res, next);
  next();
});
app.use("/api/areas", (req, res, next) => {
  const rows = Array.isArray(req.body?.areas)
    ? req.body.areas
    : [req.body || {}];
  if (
    req.method !== "GET" &&
    rows.some((row) => row.routeZone != null || row.routeDay != null) &&
    !hasFeature(req.company, "delivery")
  )
    return requireFeature("delivery")(req, res, next);
  next();
});
app.use("/api/exp", expRoutes);
app.use("/api/catalog", catalogRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/exp", expListRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/catalog/admin", catalogAdminRoutes);
app.use("/api/returns", returnsRouter);
app.use("/api/purchases", purchasesRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/users", userRoutes);
app.use("/api/areas", areasRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/live-location", liveLocationRoutes);
app.use("/api/uploads", uploadsRoutes);
app.use("/api/areas", areaRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use((error, _req, res, _next) => {
  console.error("API_ERROR:", error);
  if (res.headersSent) return;
  const status =
    error.code === "LIMIT_FILE_SIZE"
      ? 413
      : error.code === "P2002"
        ? 409
        : error.code === "P2003"
          ? 400
          : error.code === "P2025"
            ? 404
            : 500;
  res
    .status(status)
    .json({
      message:
        status === 500
          ? "Serverdə xəta baş verdi."
          : status === 413
            ? "Şəkil maksimum 5 MB ola bilər."
            : "Məlumatı yoxla və yenidən cəhd et.",
    });
});
if (require.main === module) {
  const PORT = process.env.PORT || 7079;
  app.listen(PORT, "0.0.0.0", () =>
    console.log(`Server running on port ${PORT}`),
  );
}
module.exports = { app };