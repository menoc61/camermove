import { request } from "./resource";

export interface CreateReviewInput {
  target: "trip" | "transporter";
  tripId?: string;
  transporterId?: string;
  bookingId: string;
  rating: number;
  punctuality?: number;
  comfort?: number;
  cleanliness?: number;
  service?: number;
  comment?: string;
}

export function createReview(token: string, input: CreateReviewInput): Promise<unknown> {
  return request("/api/v1/reviews", { method: "POST", token, body: input });
}
