import { and, desc, eq, gte, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  BuyDemoCreditsBody,
  BuyDemoCreditsResponse,
  GetWalletResponse,
} from "@workspace/api-zod";
import {
  db,
  walletTransactionsTable,
  walletsTable,
} from "@workspace/db";
import { getCurrentUserId, requireAuth } from "../lib/auth";

const router: IRouter = Router();
router.use(requireAuth);

export async function ensureWallet(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(walletsTable)
      .values({ userId, balance: 50 })
      .onConflictDoNothing()
      .returning({ userId: walletsTable.userId });

    if (created) {
      await tx.insert(walletTransactionsTable).values({
        userId,
        amount: 50,
        reason: "Welcome credits",
      });
    }
  });
}

export async function readWalletBalance(userId: string): Promise<number> {
  await ensureWallet(userId);
  const [wallet] = await db
    .select({ balance: walletsTable.balance })
    .from(walletsTable)
    .where(eq(walletsTable.userId, userId))
    .limit(1);
  return wallet?.balance ?? 0;
}

export async function spendCredits(
  userId: string,
  amount: number,
  reason: string,
): Promise<number | null> {
  await ensureWallet(userId);
  return db.transaction(async (tx) => {
    const [wallet] = await tx
      .update(walletsTable)
      .set({
        balance: sql`${walletsTable.balance} - ${amount}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(walletsTable.userId, userId),
          gte(walletsTable.balance, amount),
        ),
      )
      .returning({ balance: walletsTable.balance });

    if (!wallet) return null;
    await tx.insert(walletTransactionsTable).values({
      userId,
      amount: -amount,
      reason,
    });
    return wallet.balance;
  });
}

export async function getWalletData(userId: string) {
  await ensureWallet(userId);
  const balance = await readWalletBalance(userId);
  const transactions = await db
    .select({
      id: walletTransactionsTable.id,
      amount: walletTransactionsTable.amount,
      reason: walletTransactionsTable.reason,
      createdAt: walletTransactionsTable.createdAt,
    })
    .from(walletTransactionsTable)
    .where(eq(walletTransactionsTable.userId, userId))
    .orderBy(desc(walletTransactionsTable.createdAt))
    .limit(30);

  return { balance, transactions };
}

router.get("/wallet", async (req, res): Promise<void> => {
  const wallet = await getWalletData(getCurrentUserId(req));
  res.json(GetWalletResponse.parse(wallet));
});

router.post("/wallet/demo-purchase", async (req, res): Promise<void> => {
  const parsed = BuyDemoCreditsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = getCurrentUserId(req);
  await ensureWallet(userId);
  await db.transaction(async (tx) => {
    await tx
      .update(walletsTable)
      .set({
        balance: sql`${walletsTable.balance} + ${parsed.data.credits}`,
        updatedAt: new Date(),
      })
      .where(eq(walletsTable.userId, userId));
    await tx.insert(walletTransactionsTable).values({
      userId,
      amount: parsed.data.credits,
      reason: `Demo top-up · ${parsed.data.credits} credits`,
    });
  });

  const wallet = await getWalletData(userId);
  res.json(BuyDemoCreditsResponse.parse(wallet));
});

export default router;