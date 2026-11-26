# ReachInbox Email Scheduler

A full-stack email scheduling application built using **React, TypeScript, Node.js, Express.js, PostgreSQL, Redis, and BullMQ**.

The application allows users to authenticate, compose emails, schedule them for future delivery, and manage scheduled and sent emails through a dashboard.

## 1. Tech Stack

**Frontend**

- React.js
- TypeScript
- Vite
- Tailwind CSS

**Backend**

- Node.js
- Express.js
- TypeScript
- PostgreSQL
- Redis
- BullMQ
- Nodemailer
- Google OAuth

**Deployment**

- Render (Frontend and Backend)
- Render PostgreSQL
- Render Redis-compatible Key Value service

## 2. Features Implemented

### Backend Features

| Feature               | Implementation                                                 |
| --------------------- | -------------------------------------------------------------- |
| Email Scheduling      | Schedule emails for a specified date and time                  |
| Persistence           | Store email details and scheduling information in PostgreSQL   |
| Background Processing | BullMQ jobs processed using Redis and a dedicated email worker |
| Rate Limiting         | Configurable hourly sending limit for each sender              |
| Concurrency           | BullMQ worker supports configurable concurrent job processing  |
| Retry Mechanism       | Failed jobs can be retried with exponential backoff            |
| SMTP Integration      | Nodemailer integration for sending emails                      |
| Authentication        | Google OAuth and session-based authentication                  |
| Sender Management     | Register SMTP senders with encrypted credentials               |

### Frontend Features

| Feature          | Implementation                               |
| ---------------- | -------------------------------------------- |
| Login            | Google authentication                        |
| Dashboard        | View and manage email activity               |
| Compose Email    | Enter recipients, subject, and email body    |
| Schedule Email   | Select a future date and time                |
| Sender Selection | Choose from registered SMTP senders          |
| Email Tables     | View scheduled and sent emails               |
| Status Tracking  | Display email scheduling and delivery status |
| Responsive UI    | React and Tailwind CSS interface             |

## 3. Project Architecture

The application follows a frontend–backend architecture with database persistence and Redis-based background job processing.

```text
React Frontend
      |
      v
Express.js Backend
      |
      +------> PostgreSQL
      |        (Users, Senders, Emails)
      |
      +------> Redis + BullMQ
                    |
                    v
              Email Worker
                    |
                    v
                Nodemailer
                    |
                    v
               Ethereal SMTP
```

### How Email Scheduling Works

1. The user logs in and composes an email.
2. The user selects a sender, recipients, and scheduled delivery time.
3. The frontend sends the email details to the Express backend.
4. The backend stores the email information in PostgreSQL.
5. A delayed job is added to the BullMQ queue using Redis.
6. When the scheduled time arrives, the BullMQ worker processes the job.
7. Nodemailer sends the email through the configured SMTP server.
8. The email status is updated in PostgreSQL.

### Persistence on Restart

PostgreSQL stores email records, sender configurations, and scheduling details.

Redis provides persistent queue storage for BullMQ jobs, subject to Redis persistence configuration.

This architecture allows scheduling data to survive application restarts. When the backend and worker restart, stored email records remain available, and pending jobs can continue processing from the Redis queue.

### Rate Limiting

Rate limiting controls the number of emails sent by each registered sender.

- Each sender has a configurable hourly email limit.
- Sending slots are checked before email delivery.
- Redis is used to coordinate sending limits.
- Emails exceeding the configured limit are delayed until an available sending slot.

### Concurrency

BullMQ supports concurrent email processing through its worker configuration.

- Multiple email jobs can be processed simultaneously.
- Worker concurrency is configurable using `WORKER_CONCURRENCY`.
- Redis coordinates queued jobs and their processing.
- Retry and backoff mechanisms handle temporary processing failures.

## 4. How to Run the Backend

### Prerequisites

Install:

- Node.js and npm
- PostgreSQL
- Redis
- Git

### Step 1: Clone the Repository

```bash
git clone https://github.com/PrachiGoswami367/reachinbox-email-scheduler.git
cd reachinbox-email-scheduler
```

### Step 2: Install Backend Dependencies

```bash
cd backend
npm install
```

### Step 3: Configure Environment Variables

Create a `.env` file inside the `backend` directory.

```env
PORT=5000
NODE_ENV=development

DATABASE_URL=postgresql://postgres:password@localhost:5432/reachinbox

REDIS_URL=redis://127.0.0.1:6379

SESSION_SECRET=replace_with_a_random_secret_at_least_32_characters

ENCRYPTION_KEY=replace_with_your_valid_encryption_key

GOOGLE_CLIENT_ID=your_google_oauth_client_id

WORKER_CONCURRENCY=5
```

Replace the placeholder values with your actual local configuration.

Do not commit the `.env` file or SMTP passwords to GitHub.

### Step 4: Start PostgreSQL and Redis

Ensure both PostgreSQL and Redis are running.

Create the PostgreSQL database:

```sql
CREATE DATABASE reachinbox;
```

Apply the database schema supplied with the project before starting the application.

### Step 5: Build and Run the Backend

```bash
npx tsc
node dist/server.js
```

Backend runs at:

```text
http://localhost:5000
```

### Step 6: Start the BullMQ Email Worker

Open another terminal:

```bash
cd reachinbox-email-scheduler/backend
node dist/workers/emailWorker.js
```

Keep the backend server and BullMQ worker running in separate terminal sessions.

## 5. How to Run the Frontend

Open a new terminal.

### Step 1: Navigate to Frontend

```bash
cd reachinbox-email-scheduler/frontend
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Start Development Server

```bash
npm run dev
```

Open the local URL displayed by Vite, usually:

```text
http://localhost:5173
```

During local development, Vite proxies `/api` requests to the backend at `http://localhost:5000`.

## 6. Ethereal Email Setup

Ethereal Email is a testing SMTP service used to test email sending without delivering messages to real recipients.

### Step 1: Create an Ethereal Account

Visit:

[https://ethereal.email/](https://ethereal.email/)

Create a test account and obtain the SMTP credentials.

### Step 2: SMTP Configuration

Use the following settings:

```env
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USERNAME=your_ethereal_username
SMTP_PASSWORD=your_ethereal_password
```

### Step 3: Register an SMTP Sender

The backend provides a sender registration endpoint:

```http
POST /api/senders
```

Example request body:

```json
{
  "email": "your_ethereal_email",
  "displayName": "Test Sender",
  "smtpHost": "smtp.ethereal.email",
  "smtpPort": 587,
  "smtpUsername": "your_ethereal_username",
  "smtpPassword": "your_ethereal_password",
  "hourlyLimit": 20,
  "minDelayMs": 2000
}
```

The sender registration endpoint requires an authenticated user session.

SMTP credentials are encrypted before being stored in the database.

### Step 4: Test Email Scheduling

1. Log in to the application.
2. Open the Compose Email page.
3. Select the registered Ethereal sender.
4. Enter the recipient, subject, and message.
5. Choose the scheduled date and time.
6. Submit the email.
7. Check the Scheduled Emails section.
8. After worker processing, check the email status and Ethereal mailbox.

Ethereal captures test messages instead of delivering them to real inboxes.

## 7. Deployment

The application is deployed using Render.

**Frontend:**
[https://reachinbox-email-scheduler-2c2t.onrender.com](https://reachinbox-email-scheduler-2c2t.onrender.com)

**Backend:**
[https://reachinbox-backend-oc0z.onrender.com](https://reachinbox-backend-oc0z.onrender.com)

**GitHub Repository:**
[https://github.com/ashutosh375/reachinbox-email-scheduler](https://github.com/ashutosh375/reachinbox-email-scheduler)

The deployment architecture uses a Render Static Site for the React frontend, a Render Web Service for the Express backend, PostgreSQL for database storage, and a Redis-compatible Key Value service for BullMQ.

## 8. Summary

ReachInbox Email Scheduler demonstrates full-stack development, asynchronous job scheduling, database persistence, SMTP integration, authentication, rate limiting, and concurrent background processing.

The project combines React and Express with PostgreSQL, Redis, and BullMQ to provide an email scheduling and management platform.
