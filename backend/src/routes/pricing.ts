import { Router, Request, Response } from "express";
import { loadPricingRules } from "../config/pricingRules";

const router = Router();

router.get("/pricing", (req: Request, res: Response) => {
  try {
    const rules = loadPricingRules();
    return res.json(rules);
  } catch (error) {
    console.error("Error loading pricing rules:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
