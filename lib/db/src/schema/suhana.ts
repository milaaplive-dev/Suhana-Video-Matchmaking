import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const profilesTable = pgTable("suhana_profiles", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  age: integer("age").notNull(),
  gender: text("gender").notNull(),
  location: text("location").notNull(),
  interests: text("interests")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  photoUrl: text("photo_url"),
  bio: text("bio"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const walletsTable = pgTable("suhana_wallets", {
  userId: text("user_id").primaryKey(),
  balance: integer("balance").notNull().default(50),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const walletTransactionsTable = pgTable("suhana_wallet_transactions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  amount: integer("amount").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const conversationsTable = pgTable(
  "suhana_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    participantOne: text("participant_one").notNull(),
    participantTwo: text("participant_two").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("suhana_conversation_pair_idx").on(
      table.participantOne,
      table.participantTwo,
    ),
  ],
);

export const messagesTable = pgTable("suhana_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversationsTable.id, { onDelete: "cascade" }),
  senderId: text("sender_id").notNull(),
  content: text("content").notNull(),
  premium: boolean("premium").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const blocksTable = pgTable(
  "suhana_blocks",
  {
    blockerId: text("blocker_id").notNull(),
    targetId: text("target_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.blockerId, table.targetId] })],
);

export const reportsTable = pgTable("suhana_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  reporterId: text("reporter_id").notNull(),
  reportedUserId: text("reported_user_id").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});