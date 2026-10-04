import { createServer } from "node:http";
import { db, profilesTable } from "@workspace/db";
import app from "./app";
import { logger } from "./lib/logger";
import { attachRealtime } from "./lib/realtime";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = createServer(app);
attachRealtime(server);

server.on("error", (err) => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});

async function start(): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    await db
      .insert(profilesTable)
      .values([
        {
          id: "demo-profile-amina",
          displayName: "Amina",
          age: 29,
          gender: "Woman",
          location: "Karachi",
          interests: ["Film photography", "Bookshops", "Coastal walks"],
          bio: "Sample profile for exploring Suhana. This is a demo account, not a member.",
        },
        {
          id: "demo-profile-zoya",
          displayName: "Zoya",
          age: 27,
          gender: "Woman",
          location: "Lahore",
          interests: ["Live music", "Cooking", "Architecture"],
          bio: "Sample profile for exploring Suhana. This is a demo account, not a member.",
        },
        {
          id: "demo-profile-hamza",
          displayName: "Hamza",
          age: 31,
          gender: "Man",
          location: "Islamabad",
          interests: ["Hiking", "Coffee", "Design"],
          bio: "Sample profile for exploring Suhana. This is a demo account, not a member.",
        },
      ])
      .onConflictDoNothing();
  }

  server.listen(port, () => {
    logger.info({ port }, "Server listening");
  });
}

void start().catch((err: unknown) => {
  logger.error({ err }, "Server startup failed");
  process.exit(1);
});
