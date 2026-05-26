import type { Request, Response } from "express";
import { prisma } from "../db";
import { getJSON, invalidatePattern, setJSON } from "../lib/redis";
import { stripe } from "../lib/stripe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:5173";

async function ensureTeamOwnership(userId: string, teamId: number) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { creatorId: true },
  });
  if (!team) throw { status: 404, message: "Team not found" };
  if (team.creatorId !== userId)
    throw { status: 403, message: "Only the team owner can manage billing" };
  return team;
}

export const createCheckoutSession = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { teamId, priceId } = req.body as { teamId?: unknown; priceId?: unknown };
    if (!teamId || !priceId) {
      return res.status(400).json({ success: false, message: "teamId and priceId are required" });
    }

    await ensureTeamOwnership(userId, Number(teamId));

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const existing = await prisma.teamSubscription.findUnique({
      where: { teamId: Number(teamId) },
    });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId as string, quantity: 1 }],
      customer_email: user.email,
      client_reference_id: String(teamId),
      metadata: { teamId: String(teamId) },
      subscription_data: {
        metadata: { teamId: String(teamId) },
      },
      success_url: `${APP_URL}/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/settings/billing?canceled=true`,
      ...(existing?.stripeCustomerId ? { customer: existing.stripeCustomerId } : {}),
    });

    await invalidatePattern(`billing:subscription:${Number(teamId)}`);

    return res.status(200).json({ success: true, url: session.url });
  } catch (error: unknown) {
    const e = error as { status?: number; message?: string };
    if (e.status) {
      return res.status(e.status).json({ success: false, message: e.message });
    }
    return res.status(500).json({ success: false, message: "Failed to create checkout session" });
  }
};

export const getSubscription = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const teamId = Number(req.params.teamId);
    if (!teamId) return res.status(400).json({ success: false, message: "teamId is required" });

    const cacheKey = `billing:subscription:${teamId}`;
    const cached = await getJSON<unknown>(cacheKey);
    if (cached) return res.status(200).json({ success: true, data: cached });

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { creatorId: true, subscription: true },
    });
    if (!team) return res.status(404).json({ success: false, message: "Team not found" });

    const isOwner = team.creatorId === userId;
    const member = await prisma.teamMember.findFirst({
      where: { teamId, userId },
    });
    if (!isOwner && !member) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const data = team.subscription ?? null;
    await setJSON(cacheKey, data, 60);

    return res.status(200).json({ success: true, data });
  } catch {
    return res.status(500).json({ success: false, message: "Failed to fetch subscription" });
  }
};

export const createPortalSession = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { teamId } = req.body as { teamId?: unknown };
    if (!teamId) return res.status(400).json({ success: false, message: "teamId is required" });

    await ensureTeamOwnership(userId, Number(teamId));

    const subscription = await prisma.teamSubscription.findUnique({
      where: { teamId: Number(teamId) },
    });
    if (!subscription?.stripeCustomerId) {
      return res
        .status(400)
        .json({ success: false, message: "No subscription found for this team" });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${APP_URL}/settings/billing`,
    });

    return res.status(200).json({ success: true, url: session.url });
  } catch (error: unknown) {
    const e = error as { status?: number; message?: string };
    if (e.status) {
      return res.status(e.status).json({ success: false, message: e.message });
    }
    return res.status(500).json({ success: false, message: "Failed to create portal session" });
  }
};

export const getPrices = async (_req: Request, res: Response) => {
  try {
    const cacheKey = "billing:prices";
    const cached = await getJSON<unknown[]>(cacheKey);
    if (cached) return res.status(200).json({ success: true, data: cached });

    const prices = await stripe.prices.list({
      active: true,
      type: "recurring",
      expand: ["data.product"],
      limit: 10,
    });

    const data = prices.data.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      currency: p.currency,
      unitAmount: p.unit_amount,
      recurring: p.recurring,
      product:
        typeof p.product === "object" && !p.product.deleted
          ? {
              id: p.product.id,
              name: (p.product as any).name,
              description: (p.product as any).description,
            }
          : null,
    }));

    await setJSON(cacheKey, data, 300);

    return res.status(200).json({ success: true, data });
  } catch {
    return res.status(500).json({ success: false, message: "Failed to fetch prices" });
  }
};

export const handleWebhook = async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not set");
    return res.status(500).json({ success: false, message: "Webhook secret not configured" });
  }

  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    const payload = event.data.object as Record<string, any>;

    switch (event.type) {
      case "checkout.session.completed": {
        const teamId = payload.metadata?.teamId ?? payload.client_reference_id;
        if (!teamId) break;

        await prisma.teamSubscription.upsert({
          where: { teamId: Number(teamId) },
          create: {
            teamId: Number(teamId),
            stripeCustomerId: payload.customer as string,
            stripeSubscriptionId: payload.subscription as string,
            status: "ACTIVE",
          },
          update: {
            stripeCustomerId: payload.customer as string,
            stripeSubscriptionId: payload.subscription as string,
            status: "ACTIVE",
          },
        });

        await invalidatePattern(`billing:subscription:${Number(teamId)}`);
        console.log(`Subscription created for team ${teamId}`);
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const subTeamId = payload.metadata?.teamId;

        if (subTeamId) {
          const statusMap: Record<string, string> = {
            active: "ACTIVE",
            past_due: "PAST_DUE",
            canceled: "CANCELED",
            trialing: "TRIALING",
            incomplete: "INCOMPLETE",
            unpaid: "PAST_DUE",
          };
          const status = statusMap[payload.status] ?? "EXPIRED";

          await prisma.teamSubscription.update({
            where: { teamId: Number(subTeamId) },
            data: {
              status: status as any,
              priceId: payload.items?.data?.[0]?.price?.id ?? undefined,
              currentPeriodStart: payload.current_period_start
                ? new Date(payload.current_period_start * 1000)
                : undefined,
              currentPeriodEnd: payload.current_period_end
                ? new Date(payload.current_period_end * 1000)
                : undefined,
              trialEndsAt: payload.trial_end ? new Date(payload.trial_end * 1000) : undefined,
            },
          });

          await invalidatePattern(`billing:subscription:${Number(subTeamId)}`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const deletedTeamId = payload.metadata?.teamId;

        if (deletedTeamId) {
          await prisma.teamSubscription.update({
            where: { teamId: Number(deletedTeamId) },
            data: { status: "CANCELED" },
          });
          await invalidatePattern(`billing:subscription:${Number(deletedTeamId)}`);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invTeamId =
          payload.subscription_details?.metadata?.teamId ??
          payload.lines?.data?.[0]?.metadata?.teamId;

        if (invTeamId) {
          await prisma.teamSubscription.update({
            where: { teamId: Number(invTeamId) },
            data: { status: "PAST_DUE" },
          });
          await invalidatePattern(`billing:subscription:${Number(invTeamId)}`);
        }
        break;
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return res.status(500).json({ success: false, message: "Webhook handler failed" });
  }
};
