
export interface Sender {
  id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  smtp_host: string;
  smtp_port: number;
  hourly_limit: number;
  min_delay_ms: number;
  created_at: string;
}

export interface SendersResponse {
  count: number;
  senders: Sender[];
}

