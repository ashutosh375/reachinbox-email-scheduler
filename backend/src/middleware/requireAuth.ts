import type {
  Request,
  Response,
  NextFunction,
} from "express";

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.session.user) {
    res.status(401).json({
      error: "Please log in to continue",
    });
    return;
  }

  next();
}