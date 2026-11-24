
import type { Email } from "../types/email";

interface SearchHit {
  id: string;
  userId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: "scheduled" | "sent";
  scheduledAt: string;
  sentAt: string | null;
}

interface SearchResponse {
  count: number;
  emails: SearchHit[];
}

export async function searchEmails(
  query: string
): Promise<Email[]> {
  const params = new URLSearchParams({
    q: query,
  });

  const response = await fetch(
    `/api/emails/search?${params.toString()}`,
    {
      credentials: "same-origin",
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        "Session expired. Please log in again."
      );
    }

    throw new Error("Unable to search emails.");
  }

  const data: SearchResponse = await response.json();

  if (!Array.isArray(data.emails)) {
    throw new Error("Invalid search response.");
  }

  // Convert Elasticsearch fields to Dashboard fields
  return data.emails.map((email) => ({
    id: email.id,
    sender_email: email.senderEmail,
    recipient_email: email.recipientEmail,
    subject: email.subject,
    body: email.body,
    scheduled_at: email.scheduledAt,
    status: email.status,
    sent_at: email.sentAt,
    created_at: "",
  }));
}
