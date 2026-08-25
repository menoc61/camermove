import fp from "fastify-plugin"
import swagger from "@fastify/swagger"
import swaggerUi from "@fastify/swagger-ui"
import type { FastifyInstance } from "fastify"

export const swaggerPlugin = fp(async (app: FastifyInstance) => {
  await app.register(swagger, {
    openapi: {
      openapi: "3.0.3",
      info: { title: "CamerMove API", version: "1.0.0", description: "API de réservation Yaoundé ↔ Douala" },
      servers: [{ url: "http://localhost:3000", description: "Local" }],
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
        schemas: {
          Ticket: {
            type: "object",
            properties: {
              id: { type: "string" },
              bookingId: { type: "string" },
              qrCode: { type: "string" },
              verificationCode: { type: "string" },
              status: { type: "string", enum: ["valid", "used", "void"] },
              issuedAt: { type: "string", format: "date-time" },
              qrDataUrl: { type: "string", description: "base64 PNG data URL", nullable: true },
            },
          },
          Notification: {
            type: "object",
            properties: {
              id: { type: "string" },
              userId: { type: "string", nullable: true },
              transporterId: { type: "string", nullable: true },
              channel: { type: "string", enum: ["email", "sms", "whatsapp", "push"] },
              type: { type: "string" },
              status: { type: "string", enum: ["queued", "sent", "failed"] },
              payload: { type: "object" },
              sentAt: { type: "string", format: "date-time", nullable: true },
              createdAt: { type: "string", format: "date-time" },
            },
          },
          NotificationEvent: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["booking.confirmed", "payment.confirmed", "ticket.issued", "trip.reminder.24h"],
              },
              userId: { type: "string" },
              payload: {
                type: "object",
                properties: {
                  reference: { type: "string", nullable: true },
                  bookingId: { type: "string", nullable: true },
                  ticketId: { type: "string", nullable: true },
                  verificationCode: { type: "string", nullable: true },
                  amount: { type: "integer", nullable: true },
                  tripId: { type: "string", nullable: true },
                  departureAt: { type: "string", format: "date-time", nullable: true },
                  origin: { type: "string", nullable: true },
                  destination: { type: "string", nullable: true },
                  transporter: { type: "string", nullable: true },
                  seatCount: { type: "integer", nullable: true },
                },
              },
            },
            required: ["type", "userId"],
          },
          PublicTicketLookup: {
            type: "object",
            properties: {
              reference: { type: "string" },
              tripOrigin: { type: "string" },
              tripDestination: { type: "string" },
              departureAt: { type: "string", format: "date-time" },
              status: { type: "string", enum: ["valid", "used", "void"] },
              passengerFirstName: { type: "string" },
            },
            required: ["reference", "tripOrigin", "tripDestination", "departureAt", "status"],
          },
          DashboardResponse: {
            type: "object",
            properties: {
              upcoming: { type: "array", items: { type: "object" } },
              history: { type: "array", items: { type: "object" } },
              tickets: { type: "array", items: { type: "object" } },
            },
            required: ["upcoming", "history", "tickets"],
          },
        },
      },
      paths: {
        "/api/v1/tickets/lookup": {
          get: {
            tags: ["tickets-public"],
            summary: "Public ticket lookup by booking reference (redacted)",
            description: "Sanitized view: reference, tripOrigin, tripDestination, departureAt, status, passengerFirstName. No PII. 404 if not found, 410 if past departure.",
            parameters: [
              { in: "query", name: "ref", required: true, schema: { type: "string", pattern: "^CM-[A-Z0-9]{6,12}$" } },
            ],
            responses: {
              "200": {
                description: "Ticket found",
                content: { "application/json": { schema: { $ref: "#/components/schemas/PublicTicketLookup" } } },
              },
              "400": { description: "Invalid reference format" },
              "404": { description: "Not found" },
              "410": { description: "Past departure" },
              "429": { description: "Rate limited" },
            },
          },
        },
        "/api/v1/me/dashboard": {
          get: {
            tags: ["dashboard"],
            summary: "Authenticated traveler dashboard",
            security: [{ bearerAuth: [] }],
            responses: {
              "200": { description: "Dashboard data", content: { "application/json": { schema: { $ref: "#/components/schemas/DashboardResponse" } } } },
              "401": { description: "Unauthorized" },
            },
          },
        },
        "/api/v1/me/tickets/{id}": {
          get: {
            tags: ["tickets-me"],
            summary: "Authenticated ticket detail (owner or admin)",
            security: [{ bearerAuth: [] }],
            parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
            responses: {
              "200": { description: "Ticket", content: { "application/json": { schema: { $ref: "#/components/schemas/Ticket" } } } },
              "401": { description: "Unauthorized" },
              "403": { description: "Forbidden" },
              "404": { description: "Not found" },
            },
          },
        },
      },
    },
  })

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list", deepLinking: true },
  })
})
