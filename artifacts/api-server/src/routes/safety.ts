import { Router, type IRouter } from "express";
import {
  BlockProfileParams,
  BlockProfileResponse,
  ReportProfileBody,
  ReportProfileParams,
  ReportProfileResponse,
} from "@workspace/api-zod";
import { db, blocksTable, profilesTable, reportsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getCurrentUserId, requireAuth } from "../lib/auth";

const router: IRouter = Router();
router.use(requireAuth);

router.post("/profiles/:profileId/block", async (req, res): Promise<void> => {
  const params = BlockProfileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = getCurrentUserId(req);
  const targetId = params.data.profileId;
  if (targetId === userId) {
    res.status(400).json({ error: "You cannot block your own profile." });
    return;
  }

  const [profile] = await db
    .select({ id: profilesTable.id })
    .from(profilesTable)
    .where(eq(profilesTable.id, targetId))
    .limit(1);
  if (!profile) {
    res.status(404).json({ error: "Profile not found." });
    return;
  }

  await db
    .insert(blocksTable)
    .values({ blockerId: userId, targetId })
    .onConflictDoNothing();

  res.json(BlockProfileResponse.parse({ ok: true }));
});

router.post("/profiles/:profileId/report", async (req, res): Promise<void> => {
  const params = ReportProfileParams.safeParse(req.params);
  const body = ReportProfileBody.safeParse(req.body);
  if (!params.success || !body.success) {
    const error = !params.success
      ? params.error.message
      : !body.success
        ? body.error.message
        : "Invalid report.";
    res.status(400).json({ error });
    return;
  }

  const userId = getCurrentUserId(req);
  if (params.data.profileId === userId) {
    res.status(400).json({ error: "You cannot report your own profile." });
    return;
  }

  const [profile] = await db
    .select({ id: profilesTable.id })
    .from(profilesTable)
    .where(eq(profilesTable.id, params.data.profileId))
    .limit(1);
  if (!profile) {
    res.status(404).json({ error: "Profile not found." });
    return;
  }

  const reason = body.data.reason.trim();
  if (reason.length < 3) {
    res.status(400).json({ error: "Please include at least 3 characters." });
    return;
  }

  await db.insert(reportsTable).values({
    reporterId: userId,
    reportedUserId: params.data.profileId,
    reason,
  });

  res.status(201).json(ReportProfileResponse.parse({ ok: true }));
});

export default router;