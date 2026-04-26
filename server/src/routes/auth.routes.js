const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { prisma } = require("../prismaClient");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

/**
 * BİR DƏFƏLİK ADMIN YARATMA ROUTE-U
 * Admin yaradılandan sonra bunu silmək daha təhlükəsizdir.
 */
router.post("/setup-admin", async (req, res) => {
  try {
    const existingAdmin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
    });

    if (existingAdmin) {
      return res.status(400).json({ message: "Admin artıq mövcuddur" });
    }

    const pin = "1234";
    const pinHash = await bcrypt.hash(pin, 10);

    const admin = await prisma.user.create({
      data: {
        fullName: "Admin",
        role: "ADMIN",
        pinHash,
        isActive: true,
      },
    });

    return res.status(201).json({
      message: "Admin uğurla yaradıldı",
      pin,
      user: {
        id: admin.id,
        fullName: admin.fullName,
        role: admin.role,
        isActive: admin.isActive,
      },
    });
  } catch (error) {
    console.error("SETUP_ADMIN_ERROR:", error);
    return res.status(500).json({ message: "Admin yaradılmadı" });
  }
});

router.post("/pin-login", async (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin) {
      return res.status(400).json({ message: "PIN daxil edilməlidir" });
    }

    const users = await prisma.user.findMany({
      where: { isActive: true },
    });

    let foundUser = null;

    for (const user of users) {
      const isMatch = await bcrypt.compare(pin, user.pinHash);

      if (isMatch) {
        foundUser = user;
        break;
      }
    }

    if (!foundUser) {
      return res.status(401).json({ message: "PIN yanlışdır" });
    }

    const token = jwt.sign(
      {
        userId: foundUser.id,
        role: foundUser.role,
        fullName: foundUser.fullName,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" },
    );

    return res.json({
      message: "Giriş uğurludur",
      token,
      user: {
        id: foundUser.id,
        fullName: foundUser.fullName,
        role: foundUser.role,
      },
    });
  } catch (error) {
    console.error("PIN_LOGIN_ERROR:", error);
    return res.status(500).json({ message: "Login zamanı xəta baş verdi" });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        fullName: true,
        role: true,
        isActive: true,
        email: true,
      },
    });

    if (!dbUser || !dbUser.isActive) {
      return res.status(401).json({
        message: "İstifadəçi tapılmadı və ya deaktivdir",
      });
    }

    return res.json(dbUser);
  } catch (error) {
    console.error("AUTH_ME_ERROR:", error);
    return res.status(500).json({ message: "User məlumatı alınmadı" });
  }
});

module.exports = router;
