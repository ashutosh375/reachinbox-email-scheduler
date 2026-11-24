export interface Email {
  id: string;
  sender_email: string;
  recipient_email: string;
  subject: string;
  body: string;
  scheduled_at: string;
  status: "scheduled" | "sent";
  sent_at: string | null;
  created_at: string;
}

export interface EmailsResponse {
  count: number;
  emails: Email[];
}