import { Buffer } from "node:buffer";
import { randomBytes } from "node:crypto";
import type { IncomingMessage, Server } from "node:http";
import { URL } from "node:url";
import WebSocket, { WebSocketServer } from "ws";
import { logger } from "./logger";

type Ticket = {
  userId: string;
  conversationId: string;
  expiresAt: number;
};

type PaidCall = {
  conversationId: string;
  callerId: string;
  peerId: string;
  state: "pending" | "accepted";
  expiresAt: number;
};

type Client = {
  socket: WebSocket;
  userId: string;
};

const ticketLifetimeMs = 30_000;
const tickets = new Map<string, Ticket>();
const rooms = new Map<string, Set<Client>>();
const paidCalls = new Map<string, PaidCall>();

const clientSignalTypes = new Set([
  "call:invite",
  "call:accept",
  "call:decline",
  "call:offer",
  "call:answer",
  "call:ice",
  "call:end",
]);

function cleanupExpiredEntries(now: number): void {
  for (const [key, value] of tickets) {
    if (value.expiresAt <= now) tickets.delete(key);
  }
  for (const [key, value] of paidCalls) {
    if (value.expiresAt <= now) paidCalls.delete(key);
  }
}

export function issueRealtimeTicket(
  userId: string,
  conversationId: string,
): { ticket: string; expiresInSeconds: number } {
  const now = Date.now();
  cleanupExpiredEntries(now);

  const ticket = randomBytes(24).toString("base64url");
  tickets.set(ticket, {
    userId,
    conversationId,
    expiresAt: now + ticketLifetimeMs,
  });

  return { ticket, expiresInSeconds: Math.floor(ticketLifetimeMs / 1000) };
}

export function registerPaidCall(
  callId: string,
  conversationId: string,
  callerId: string,
  peerId: string,
): void {
  const now = Date.now();
  cleanupExpiredEntries(now);
  paidCalls.set(callId, {
    conversationId,
    callerId,
    peerId,
    state: "pending",
    expiresAt: now + 10 * 60_000,
  });
}

export function broadcastConversation(
  conversationId: string,
  senderId: string,
  event: Record<string, unknown>,
): void {
  const clients = rooms.get(conversationId);
  if (!clients) return;
  const data = JSON.stringify(event);
  for (const client of clients) {
    if (
      client.userId !== senderId &&
      client.socket.readyState === WebSocket.OPEN
    ) {
      client.socket.send(data);
    }
  }
}

function consumeTicket(ticket: string | null): Ticket | null {
  if (!ticket) return null;
  const value = tickets.get(ticket);
  tickets.delete(ticket);
  if (!value || value.expiresAt <= Date.now()) return null;
  return value;
}

function closeUnauthorized(socket: import("node:stream").Duplex): void {
  socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
  socket.destroy();
}

export function attachRealtime(server: Server): void {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 65_536 });

  server.on("upgrade", (request, socket, head) => {
    let url: URL;
    try {
      url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    } catch {
      socket.destroy();
      return;
    }

    if (url.pathname !== "/api/ws") {
      socket.destroy();
      return;
    }

    const ticket = consumeTicket(url.searchParams.get("ticket"));
    if (!ticket) {
      closeUnauthorized(socket);
      return;
    }

    wss.handleUpgrade(request, socket, head, (clientSocket) => {
      let room = rooms.get(ticket.conversationId);
      if (!room) {
        room = new Set<Client>();
        rooms.set(ticket.conversationId, room);
      }
      const client = { socket: clientSocket, userId: ticket.userId };
      room.add(client);

      clientSocket.on("message", (raw, isBinary) => {
        if (isBinary) return;

        let packet: unknown;
        try {
          const text = Array.isArray(raw)
            ? Buffer.concat(raw).toString()
            : Buffer.isBuffer(raw)
              ? raw.toString()
              : Buffer.from(raw).toString();
          if (Buffer.byteLength(text) > 65_536) return;
          packet = JSON.parse(text);
        } catch {
          return;
        }

        if (!packet || typeof packet !== "object") return;
        const message = packet as Record<string, unknown>;
        if (
          typeof message.type !== "string" ||
          !clientSignalTypes.has(message.type) ||
          typeof message.callId !== "string" ||
          message.callId.length > 100
        ) {
          return;
        }

        const call = paidCalls.get(message.callId);
        if (!call || call.conversationId !== ticket.conversationId) return;

        const isCaller = ticket.userId === call.callerId;
        const isPeer = ticket.userId === call.peerId;
        if (!isCaller && !isPeer) return;

        if (message.type === "call:invite" && (!isCaller || call.state !== "pending")) {
          return;
        }
        if (
          (message.type === "call:accept" || message.type === "call:decline") &&
          (!isPeer || call.state !== "pending")
        ) {
          return;
        }
        if (
          (message.type === "call:offer" || message.type === "call:answer") &&
          (call.state !== "accepted" ||
            (message.type === "call:offer" && !isCaller) ||
            (message.type === "call:answer" && !isPeer))
        ) {
          return;
        }
        if (
          message.type === "call:ice" &&
          call.state !== "accepted"
        ) {
          return;
        }

        if (message.type === "call:accept") {
          call.state = "accepted";
          call.expiresAt = Date.now() + 60 * 60_000;
        } else if (message.type === "call:decline" || message.type === "call:end") {
          paidCalls.delete(message.callId);
        } else {
          call.expiresAt = Date.now() + 60 * 60_000;
        }

        broadcastConversation(ticket.conversationId, ticket.userId, {
          ...message,
          ...(message.type === "call:invite"
            ? { fromUserId: ticket.userId }
            : {}),
        });
      });

      clientSocket.on("close", () => {
        room?.delete(client);
        if (room?.size === 0) rooms.delete(ticket.conversationId);
        for (const [callId, call] of paidCalls) {
          if (
            call.conversationId === ticket.conversationId &&
            (call.callerId === ticket.userId || call.peerId === ticket.userId)
          ) {
            paidCalls.delete(callId);
            broadcastConversation(ticket.conversationId, ticket.userId, {
              type: "call:end",
              callId,
            });
          }
        }
      });

      clientSocket.on("error", (err) => {
        logger.warn({ err }, "Realtime socket error");
      });
    });
  });

  wss.on("error", (err) => logger.error({ err }, "Realtime server error"));
}