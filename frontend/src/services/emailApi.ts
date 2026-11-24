
import type { EmailsResponse } from "../types/email";

const API_BASE_URL = "";

export async function fetchEmails(
  userId: string,
  status: "scheduled" | "sent"
): Promise<EmailsResponse> {
  const params = new URLSearchParams({
    userId,
    status,
  });

  const response = await fetch(
    `${API_BASE_URL}/api/emails?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch emails");
  }

  return response.json();
}
