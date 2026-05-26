import express from "express";

import {
  createCheckoutSession,
  createPortalSession,
  getPrices,
  getSubscription,
  handleWebhook,
} from "../controllers/billing.controller";

const router = express.Router();

router.post("/checkout", createCheckoutSession);
router.post("/portal", createPortalSession);
router.get("/subscription/:teamId", getSubscription);
router.get("/prices", getPrices);
router.post("/webhook", handleWebhook);

export default router;
