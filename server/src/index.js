require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const expRoutes = require("./routes/expeditor.routes");
const app = express();

app.use(cors());
app.use(express.json());

// test
app.get("/health", (req, res) => {
    res.json({ ok: true });
});

// routes
app.use("/auth", authRoutes);
app.use("/exp", expRoutes);

const PORT = process.env.PORT || 7079;
app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
