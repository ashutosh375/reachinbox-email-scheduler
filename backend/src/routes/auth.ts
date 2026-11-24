import { Router } from "express";
import { OAuth2Client } from "google-auth-library";

const router = Router();

const clientId = process.env.GOOGLE_CLIENT_ID;

if (!clientId) {
  throw new Error("GOOGLE_CLIENT_ID is missing in .env");
}

const googleClient = new OAuth2Client(clientId);

// Google Login
router.post("/google", async (req, res) => {
  try {
    const { credential } = req.body ?? {};

    if (
      typeof credential !== "string" ||
      !credential.trim()
    ) {
      return res.status(400).json({
        error: "Google credential is required",
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });

    const payload = ticket.getPayload();

    if (
      !payload?.sub ||
      !payload.email ||
      !payload.email_verified
    ) {
      return res.status(401).json({
        error: "Google account verification failed",
      });
    }

    const user = {
      id: payload.sub,
      name: payload.name ?? "",
      email: payload.email,
      picture: payload.picture ?? "",
    };

    // Prevent session fixation after login
    req.session.regenerate((error) => {
      if (error) {
        console.error("Session regeneration failed:", error);

        return res.status(500).json({
          error: "Unable to create login session",
        });
      }

      req.session.user = user;

      req.session.save((saveError) => {
        if (saveError) {
          console.error("Session save failed:", saveError);

          return res.status(500).json({
            error: "Unable to save login session",
          });
        }

        return res.json({ user });
      });
    });
  } catch (error) {
    console.error("Google authentication failed:", error);

    return res.status(401).json({
      error: "Invalid or expired Google credential",
    });
  }
});

// Get current logged-in user
router.get("/me", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({
      error: "Not authenticated",
    });
  }

  return res.json({
    user: req.session.user,
  });
});

// Logout
router.post("/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error("Logout failed:", error);

      return res.status(500).json({
        error: "Failed to log out",
      });
    }

    res.clearCookie("reachinbox.sid", {
      path: "/",
    });

    return res.json({
      message: "Logged out successfully",
    });
  });
});

export default router;