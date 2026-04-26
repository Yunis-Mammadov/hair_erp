require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

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
const areaRoutes = require("./routes/area.routes")

app.use(
  cors({
    origin: ["http://localhost:5173", "https://hair-erp-3.onrender.com"],
    credentials: true,
  }),
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(express.json());

// test
app.get("/health", (req, res) => {
  res.json({ ok: true });
});
// routes
app.use("/api/auth", authRoutes);
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

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const PORT = process.env.PORT || 7079;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
