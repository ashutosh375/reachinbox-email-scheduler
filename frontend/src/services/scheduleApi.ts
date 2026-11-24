
export interface ScheduleEmailRequest {
  userId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
}

export interface ScheduleEmailResponse {
  id: string;
  status: string;
}

export async function scheduleEmail(
  data: ScheduleEmailRequest
): Promise<ScheduleEmailResponse> {
  const response = await fetch("/api/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(
      error?.error || "Failed to schedule email"
    );
  }

  return response.json();
}
