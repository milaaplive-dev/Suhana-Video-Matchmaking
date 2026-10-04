import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, or, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateRealtimeTicketParams,
  CreateRealtimeTicketResponse,
  ListConversationsResponse,
  ListMessagesParams,
  ListMessagesResponse,
  SendMessageBody,
  SendMessageParams,
  SendMessageResponse,
  StartConversationBody,
  StartConversationResponse,
  StartDirectCallParams,
  StartDirectCallResponse,
} from "@workspace/api-zod";
import {
  blocksTable,
  conversationsTable,
  db,
  messagesTable,
  profilesTable,
  walletTransactionsTable,
  walletsTable,
} from "@workspace/db";
import { getCurrentUserId, requireAuth } from "../lib/auth";
import {
  broadcastConversation,
  issueRealtimeTicket,
  registerPaidCall,
} from "../lib/realtime";
import { ensureWallet, spendCredits } from "./wallet";

const router: IRouter = Router();
router.use(requireAuth);

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

function profilePayload(profile: typeof profilesTable.$inferSelect) {
  return {
    id: profile.id,
    displayName: profile.displayName,
    age: profile.age,
    gender: profile.gender,
    location: profile.location,
    interests: profile.interests,
    photoUrl: profile.photoUrl,
    bio: profile.bio,
    createdAt: profile.createdAt,
  };
}

async function getMemberConversation(conversationId: string, userId: string) {
  if (!isUuid(conversationId)) return null;
  const [conversation] = await db
    .select()
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.id, conversationId),
        or(
          eq(conversationsTable.participantOne, userId),
          eq(conversationsTable.participantTwo, userId),
        ),
      ),
    )
    .limit(1);
  return conversation ?? null;
}

async function hasBlockBetween(userId: string, peerId: string): Promise<boolean> {
  const [block] = await db
    .select({ blockerId: blocksTable.blockerId })
    .from(blocksTable)
    .where(
      or(
        and(
          eq(blocksTable.blockerId, userId),
          eq(blocksTable.targetId, peerId),
        ),
        and(
          eq(blocksTable.blockerId, peerId),
          eq(blocksTable.targetId, userId),
        ),
      ),
    )
    .limit(1);
  return Boolean(block);
}

router.get("/conversations", async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  const rows = await db
    .select()
    .from(conversationsTable)
    .where(
      or(
        eq(conversationsTable.participantOne, userId),
        eq(conversationsTable.participantTwo, userId),
      ),
    )
    .orderBy(desc(conversationsTable.updatedAt))
    .limit(100);

  const result = [];
  for (const conversation of rows) {
    const peerId =
      conversation.participantOne === userId
        ? conversation.participantTwo
        : conversation.participantOne;
    if (await hasBlockBetween(userId, peerId)) continue;

    const [peer] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, peerId))
      .limit(1);
    if (!peer) continue;

    const [lastMessage] = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conversation.id))
      .orderBy(desc(messagesTable.createdAt))
      .limit(1);

    result.push({
      id: conversation.id,
      peer: profilePayload(peer),
      lastMessage: lastMessage ?? null,
      updatedAt: lastMessage?.createdAt ?? conversation.updatedAt,
    });
  }

  res.json(ListConversationsResponse.parse(result));
});

router.post("/conversations", async (req, res): Promise<void> => {
  const parsed = StartConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = getCurrentUserId(req);
  const peerId = parsed.data.peerId;
  if (peerId === userId) {
    res.status(400).json({ error: "You cannot start a conversation with yourself." });
    return;
  }
  if (await hasBlockBetween(userId, peerId)) {
    res.status(403).json({ error: "This conversation is unavailable." });
    return;
  }

  const [peer] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, peerId))
    .limit(1);
  if (!peer) {
    res.status(404).json({ error: "Profile not found." });
    return;
  }

  const [participantOne, participantTwo] = [userId, peerId].sort();
  await db
    .insert(conversationsTable)
    .values({ participantOne, participantTwo })
    .onConflictDoNothing();

  const [conversation] = await db
    .select()
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.participantOne, participantOne),
        eq(conversationsTable.participantTwo, participantTwo),
      ),
    )
    .limit(1);
  if (!conversation) {
    res.status(500).json({ error: "Could not open this conversation." });
    return;
  }

  res.json(
    StartConversationResponse.parse({
      id: conversation.id,
      peer: profilePayload(peer),
      createdAt: conversation.createdAt,
    }),
  );
});

router.get(
  "/conversations/:conversationId/messages",
  async (req, res): Promise<void> => {
    const params = ListMessagesParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const userId = getCurrentUserId(req);
    const conversation = await getMemberConversation(
      params.data.conversationId,
      userId,
    );
    if (!conversation || (await hasBlockBetween(
      userId,
      conversation.participantOne === userId
        ? conversation.participantTwo
        : conversation.participantOne,
    ))) {
      res.status(404).json({ error: "Conversation not found." });
      return;
    }

    const messages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conversation.id))
      .orderBy(messagesTable.createdAt)
      .limit(500);
    res.json(ListMessagesResponse.parse(messages));
  },
);

router.post(
  "/conversations/:conversationId/messages",
  async (req, res): Promise<void> => {
    const params = SendMessageParams.safeParse(req.params);
    const body = SendMessageBody.safeParse(req.body);
    if (!params.success || !body.success) {
      const error = !params.success
        ? params.error.message
        : !body.success
          ? body.error.message
          : "Invalid message.";
      res.status(400).json({ error });
      return;
    }

    const userId = getCurrentUserId(req);
    const conversation = await getMemberConversation(
      params.data.conversationId,
      userId,
    );
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found." });
      return;
    }
    const peerId =
      conversation.participantOne === userId
        ? conversation.participantTwo
        : conversation.participantOne;
    if (await hasBlockBetween(userId, peerId)) {
      res.status(403).json({ error: "This conversation is unavailable." });
      return;
    }

    const content = body.data.content.trim();
    if (!content) {
      res.status(400).json({ error: "Message cannot be blank." });
      return;
    }

    const premium = body.data.premium;
    if (premium && peerId.startsWith("demo-profile-")) {
      res.status(400).json({
        error: "Premium messages are unavailable for sample profiles.",
      });
      return;
    }
    await ensureWallet(userId);
    const outcome = await db.transaction(async (tx) => {
      let creditsRemaining: number;
      if (premium) {
        const [wallet] = await tx
          .update(walletsTable)
          .set({
            balance: sql`${walletsTable.balance} - 1`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(walletsTable.userId, userId),
              gte(walletsTable.balance, 1),
            ),
          )
          .returning({ balance: walletsTable.balance });
        if (!wallet) return null;
        creditsRemaining = wallet.balance;
        await tx.insert(walletTransactionsTable).values({
          userId,
          amount: -1,
          reason: "Premium message",
        });
      } else {
        const [wallet] = await tx
          .select({ balance: walletsTable.balance })
          .from(walletsTable)
          .where(eq(walletsTable.userId, userId))
          .limit(1);
        creditsRemaining = wallet?.balance ?? 0;
      }

      const [message] = await tx
        .insert(messagesTable)
        .values({
          conversationId: conversation.id,
          senderId: userId,
          content,
          premium,
        })
        .returning();
      await tx
        .update(conversationsTable)
        .set({ updatedAt: new Date() })
        .where(eq(conversationsTable.id, conversation.id));
      return { message, creditsRemaining };
    });

    if (!outcome) {
      res.status(402).json({ error: "Not enough credits for a premium message." });
      return;
    }

    const response = SendMessageResponse.parse({
      message: outcome.message,
      creditsRemaining: outcome.creditsRemaining,
    });
    broadcastConversation(conversation.id, userId, {
      type: "message:new",
      message: response.message,
    });
    res.status(201).json(response);
  },
);

router.post(
  "/conversations/:conversationId/calls",
  async (req, res): Promise<void> => {
    const params = StartDirectCallParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const userId = getCurrentUserId(req);
    const conversation = await getMemberConversation(
      params.data.conversationId,
      userId,
    );
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found." });
      return;
    }
    const peerId =
      conversation.participantOne === userId
        ? conversation.participantTwo
        : conversation.participantOne;
    if (await hasBlockBetween(userId, peerId)) {
      res.status(403).json({ error: "This conversation is unavailable." });
      return;
    }
    if (peerId.startsWith("demo-profile-")) {
      res.status(400).json({ error: "Sample profiles cannot join live calls." });
      return;
    }

    const creditsRemaining = await spendCredits(
      userId,
      10,
      "Direct video call",
    );
    if (creditsRemaining === null) {
      res.status(402).json({ error: "You need 10 credits to start a video call." });
      return;
    }

    const callId = randomUUID();
    registerPaidCall(callId, conversation.id, userId, peerId);
    res.status(201).json(
      StartDirectCallResponse.parse({ callId, creditsRemaining }),
    );
  },
);

router.post(
  "/conversations/:conversationId/realtime-ticket",
  async (req, res): Promise<void> => {
    const params = CreateRealtimeTicketParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const userId = getCurrentUserId(req);
    const conversation = await getMemberConversation(
      params.data.conversationId,
      userId,
    );
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found." });
      return;
    }
    const peerId =
      conversation.participantOne === userId
        ? conversation.participantTwo
        : conversation.participantOne;
    if (await hasBlockBetween(userId, peerId)) {
      res.status(403).json({ error: "This conversation is unavailable." });
      return;
    }

    res.json(
      CreateRealtimeTicketResponse.parse(
        issueRealtimeTicket(userId, conversation.id),
      ),
    );
  },
);

export default router;