import { and, eq, gte, ilike, lte, notInArray, or } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  DiscoverProfilesQueryParams,
  DiscoverProfilesResponse,
  GetMyProfileResponse,
  SaveMyProfileBody,
  SaveMyProfileResponse,
} from "@workspace/api-zod";
import { db, blocksTable, profilesTable } from "@workspace/db";
import { getCurrentUserId, requireAuth } from "../lib/auth";
import { ensureWallet, readWalletBalance } from "./wallet";

const router: IRouter = Router();
router.use(requireAuth);

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

router.get("/me/profile", async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  await ensureWallet(userId);
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, userId))
    .limit(1);

  res.json(
    GetMyProfileResponse.parse({
      profile: profile ? profilePayload(profile) : null,
      credits: await readWalletBalance(userId),
    }),
  );
});

router.put("/me/profile", async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  const parsed = SaveMyProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const input = parsed.data;
  const displayName = input.displayName.trim();
  const gender = input.gender.trim();
  const location = input.location.trim();
  const photoUrl = input.photoUrl?.trim() || null;
  if (!displayName || !gender || !location) {
    res.status(400).json({ error: "Name, gender, and location cannot be blank." });
    return;
  }
  if (photoUrl) {
    try {
      const url = new URL(photoUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        res.status(400).json({ error: "Photo URL must use HTTP or HTTPS." });
        return;
      }
    } catch {
      res.status(400).json({ error: "Enter a valid photo URL." });
      return;
    }
  }

  const [profile] = await db
    .insert(profilesTable)
    .values({
      id: userId,
      displayName,
      age: input.age,
      gender,
      location,
      interests: input.interests.map((interest) => interest.trim()).filter(Boolean),
      photoUrl,
      bio: input.bio?.trim() || null,
    })
    .onConflictDoUpdate({
      target: profilesTable.id,
      set: {
        displayName,
        age: input.age,
        gender,
        location,
        interests: input.interests.map((interest) => interest.trim()).filter(Boolean),
        photoUrl,
        bio: input.bio?.trim() || null,
        updatedAt: new Date(),
      },
    })
    .returning();

  res.json(SaveMyProfileResponse.parse(profilePayload(profile)));
});

router.get("/profiles/discover", async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  const parsed = DiscoverProfilesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { gender, ageMin, ageMax, location } = parsed.data;
  if (ageMin !== undefined && ageMax !== undefined && ageMin > ageMax) {
    res.status(400).json({ error: "Minimum age must not exceed maximum age." });
    return;
  }

  const blocked = await db
    .select({
      blockerId: blocksTable.blockerId,
      targetId: blocksTable.targetId,
    })
    .from(blocksTable)
    .where(or(eq(blocksTable.blockerId, userId), eq(blocksTable.targetId, userId)));
  const excludedIds = [
    userId,
    ...blocked.flatMap(({ blockerId, targetId }) => [blockerId, targetId]),
  ];
  const filters = [notInArray(profilesTable.id, excludedIds)];
  if (gender) filters.push(ilike(profilesTable.gender, gender));
  if (ageMin !== undefined) filters.push(gte(profilesTable.age, ageMin));
  if (ageMax !== undefined) filters.push(lte(profilesTable.age, ageMax));
  if (location?.trim()) {
    filters.push(ilike(profilesTable.location, `%${location.trim()}%`));
  }

  const results = await db
    .select()
    .from(profilesTable)
    .where(and(...filters))
    .orderBy(profilesTable.displayName)
    .limit(60);

  res.json(
    DiscoverProfilesResponse.parse({
      profiles: results.map(profilePayload),
      total: results.length,
    }),
  );
});

export default router;