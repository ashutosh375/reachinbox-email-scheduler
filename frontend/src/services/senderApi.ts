

import type { SendersResponse } from "../types/senders";

export async function fetchSenders(
  userId: string
): Promise<SendersResponse> {
  const params = new URLSearchParams({ userId });

  const response = await fetch(
    `/api/senders?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch senders");
  }

  return response.json();
}
