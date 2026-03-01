const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { requireAuth } = require("../middleware/auth.middleware");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const router = express.Router();

router.get("/me", requireAuth, async (req, res) => {
  // req.user token-dan gəlir
  return res.json({ user: req.user });
});

// PIN LOGIN
router.post("/pin-login", async (req, res) => {
  const { pin } = req.body;

  if (!pin) {
    return res.status(400).json({ message: "PIN required" });
  }

  const users = await prisma.user.findMany({
    where: { isActive: true },
  });

  for (let user of users) {
    const match = await bcrypt.compare(pin, user.pinHash);
    if (match) {
      const token = jwt.sign(
        {
          userId: user.id,
          role: user.role,
          fullName: user.fullName,
        },
        process.env.JWT_SECRET,
        { expiresIn: "8h" },
      );

      return res.json({ token });
    }
  }

  return res.status(401).json({ message: "Invalid PIN" });
});

module.exports = router;
