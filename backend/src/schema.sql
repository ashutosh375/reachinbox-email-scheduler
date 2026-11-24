CREATE TABLE IF NOT EXISTS emails (
    id UUID PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    sender_email VARCHAR(255) NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emails_user_status
ON emails (user_id, status);

CREATE INDEX IF NOT EXISTS idx_emails_scheduled_at
ON emails (scheduled_at);
CREATE TABLE IF NOT EXISTS senders (
    id UUID PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255),
    smtp_host VARCHAR(255) NOT NULL,
    smtp_port INTEGER NOT NULL DEFAULT 587,
    smtp_username VARCHAR(255) NOT NULL,
    smtp_password_encrypted TEXT NOT NULL,
    hourly_limit INTEGER NOT NULL DEFAULT 20,
    min_delay_ms INTEGER NOT NULL DEFAULT 2000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_senders_user_id
ON senders (user_id);

CREATE TABLE IF NOT EXISTS slack_connections (
    user_id VARCHAR(255) PRIMARY KEY,
    team_id VARCHAR(255) NOT NULL,
    team_name VARCHAR(255),
    bot_token_encrypted TEXT NOT NULL,
    bot_user_id VARCHAR(255),
    channel_id VARCHAR(255),
    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
