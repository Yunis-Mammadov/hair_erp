require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { jwtSecret } = require("./auth-security");
const { requireAuth, requireFeature } = require("./middleware/auth.middleware");
const { hasFeature } = require("./config/plans");
const { signImageResponses, serveUpload } = require("./upload-access");
jwtSecret();

const {requestLog,validateEnvironment,readiness,log}=require('./ops/runtime');
validateEnvironment();
const app = express();
app.use(requestLog);
app.use(
  require("helmet")({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
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

const allowedOrigins=[...(process.env.NODE_ENV==='production'?[]:['http://localhost:5173','http://127.0.0.1:5173']),...(process.env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean)];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(Object.assign(new Error("Origin is not allowed."),{status:403,code:"ORIGIN_BLOCKED"}));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "Accept-Language", "X-Workspace-Currency"],
  credentials: true,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(require("./localization"));

app.use(require('./routes/billing.routes').router);
app.use(express.json({ limit: "2mb" }));
app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb",
    parameterLimit: 1000,
    depth: 8,
  }),
);

app.use("/uploads", serveUpload);

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get('/ready',readiness({db:require('./prismaClient').platformPrisma,uploadsRoot:require('./upload-access').uploadsRoot}));
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
app.use("/api/workspace", require("./routes/workspace.routes"));
app.use("/api/exp", expRoutes);
app.use("/api/catalog", catalogRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/records", require("./routes/records.routes"));
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

const staticPath=require('node:path').resolve(__dirname,'../../client/dist');
if(require('node:fs').existsSync(staticPath)){
 app.use(express.static(staticPath,{index:false}));
 app.get('/{*path}',(req,res,next)=>{if(req.path.startsWith('/api/')||req.path.startsWith('/uploads/')||req.path.startsWith('/webhooks/'))return next();res.set('Cache-Control','no-store').sendFile(require('node:path').join(staticPath,'index.html'));});
}
app.use((error, _req, res, _next) => {
  if (res.headersSent) return;
  const declared = error.statusCode || error.status;
  const status =
    error.code === "LIMIT_FILE_SIZE" || error.type === "entity.too.large"
      ? 413
      : error.type === "entity.parse.failed"
        ? 400
        : error.code?.startsWith("LIMIT_")
          ? 400
          : ["P2002", "P2034"].includes(error.code)
            ? 409
            : error.code === "P2003"
              ? 400
              : error.code === "P2025"
                ? 404
                : Number.isInteger(declared) &&
                    declared >= 400 &&
                    declared <= 599
                  ? declared
                  : 500;
  // Request bodies may contain passwords/PINs, image bytes or client records.
  log("api_error", {
    requestId:_req.requestId,
    name: error.name,
    code: error.code || error.type,
    status,
  });
  const message =
    error.type === "entity.parse.failed"
      ? "JSON formatı yanlışdır."
      : status === 413
        ? "Fayl və ya sorğu icazə verilən ölçünü aşır."
        : status >= 500
          ? "Serverdə xəta baş verdi."
          : error.code?.startsWith("LIMIT_")
            ? "Yalnız bir şəkil faylı göndər."
            : error.message || "Məlumatı yoxla və yenidən cəhd et.";
  res
    .status(status)
    .json({
      code:
        error.type === "entity.parse.failed"
          ? "INVALID_JSON"
          : status === 413
            ? "REQUEST_TOO_LARGE"
            : status >= 500
              ? "SERVER_ERROR"
              : error.code || "INVALID_REQUEST",
      message,
    });
});
if (require.main === module) {
 const {platformPrisma:db}=require('./prismaClient');
 const server=app.listen(process.env.PORT||7079,process.env.HOST||'127.0.0.1',()=>log('server_started'));
 const stopWorker=require('./ops/billing').startWorker(db);
 const close=()=>{stopWorker();server.close(async()=>{await db.$disconnect();process.exit(0);});setTimeout(()=>process.exit(1),15000).unref();};
 process.once('SIGINT',close);process.once('SIGTERM',close);
}
module.exports={app};
