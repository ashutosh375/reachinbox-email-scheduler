
import { useEffect, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";

import {
  ArrowLeft,
  Clock3,
  Upload,
  X,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
} from "lucide-react";

import { fetchSenders } from "../services/senderApi";
import type { Sender } from "../types/senders";

interface ComposeProps {
  onBack: () => void;
  userId: string;
}

interface BulkScheduleResponse {
  message: string;
  requestedCount: number;
  scheduledCount: number;
  duplicateCount: number;
  queuedCount: number;
  scheduledAt: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Compose({
  onBack,
  userId,
}: ComposeProps) {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [selectedSender, setSelectedSender] = useState("");
  const [sendersLoading, setSendersLoading] = useState(true);
  const [sendersError, setSendersError] = useState("");

  const [recipient, setRecipient] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientError, setRecipientError] = useState("");

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const [delay, setDelay] = useState("2");
  const [hourlyLimit, setHourlyLimit] = useState("20");

  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");

  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleSuccess, setScheduleSuccess] = useState("");

  // Load sender accounts
  useEffect(() => {
    let cancelled = false;

    async function loadSenders() {
      try {
        setSendersLoading(true);
        setSendersError("");

        const data = await fetchSenders(userId);

        if (cancelled) return;

        setSenders(data.senders);

        const defaultSender =
          data.senders.find((sender) =>
            sender.email.endsWith("@ethereal.email")
          ) ?? data.senders[0];

        if (defaultSender) {
          setSelectedSender(defaultSender.email);
          setDelay(
            String(defaultSender.min_delay_ms / 1000)
          );
          setHourlyLimit(
            String(defaultSender.hourly_limit)
          );
        }
      } catch {
        if (!cancelled) {
          setSendersError("Failed to load senders.");
        }
      } finally {
        if (!cancelled) {
          setSendersLoading(false);
        }
      }
    }

    void loadSenders();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  function handleSenderChange(email: string) {
    setSelectedSender(email);

    const sender = senders.find(
      (item) => item.email === email
    );

    if (sender) {
      setDelay(String(sender.min_delay_ms / 1000));
      setHourlyLimit(String(sender.hourly_limit));
    }
  }

  function addRecipients(input: string) {
    const addresses = input
      .split(/[,;\n\r\s]+/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    const valid = addresses.filter((email) =>
      EMAIL_REGEX.test(email)
    );

    const invalid = addresses.filter(
      (email) => !EMAIL_REGEX.test(email)
    );

    setRecipients((previous) => [
      ...new Set([...previous, ...valid]),
    ]);

    setRecipientError(
      invalid.length > 0
        ? `${invalid.length} invalid email address(es) skipped.`
        : ""
    );

    setRecipient("");
  }

  function removeRecipient(email: string) {
    setRecipients((previous) =>
      previous.filter((item) => item !== email)
    );
  }

  function handleRecipientKeyDown(
    event: KeyboardEvent<HTMLInputElement>
  ) {
    if (
      event.key === "Enter" ||
      event.key === ","
    ) {
      event.preventDefault();

      if (recipient.trim()) {
        addRecipients(recipient);
      }
    }
  }

  async function handleRecipientUpload(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      if (!/\.(csv|txt)$/i.test(file.name)) {
        setRecipientError("Upload a CSV or TXT file.");
        return;
      }

      const content = await file.text();

      const matches = content.match(
        /[^\s,;"'<>]+@[^\s,;"'<>]+\.[^\s,;"'<>]+/g
      );

      if (!matches?.length) {
        setRecipientError(
          "No email addresses found in the file."
        );
        return;
      }

      addRecipients(matches.join(","));
    } catch {
      setRecipientError("Unable to read the file.");
    } finally {
      event.target.value = "";
    }
  }

  async function handleSchedule() {
    setScheduleError("");
    setScheduleSuccess("");

    if (!selectedSender) {
      setScheduleError("Please select a sender.");
      return;
    }

    const pendingAddresses = recipient
      .split(/[,;\n\r\s]+/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    const invalidPending = pendingAddresses.filter(
      (email) => !EMAIL_REGEX.test(email)
    );

    if (invalidPending.length > 0) {
      setScheduleError(
        "Please correct invalid recipient email addresses."
      );
      return;
    }

    const allRecipients = [
      ...new Set([
        ...recipients,
        ...pendingAddresses,
      ]),
    ];

    if (allRecipients.length === 0) {
      setScheduleError("Add at least one recipient.");
      return;
    }

    if (allRecipients.length > 5000) {
      setScheduleError(
        "Maximum 5000 recipients per request."
      );
      return;
    }

    if (!subject.trim()) {
      setScheduleError("Subject is required.");
      return;
    }

    if (!body.trim()) {
      setScheduleError("Email body is required.");
      return;
    }

    if (!scheduledAt) {
      setScheduleError("Select a date and time.");
      setShowSchedule(true);
      return;
    }

    const startTime = new Date(scheduledAt).getTime();

    if (
      !Number.isFinite(startTime) ||
      startTime <= Date.now()
    ) {
      setScheduleError(
        "Please choose a future date and time."
      );
      setShowSchedule(true);
      return;
    }

    setIsScheduling(true);

    try {
      const response = await fetch(
        "/api/emails/bulk",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            senderEmail: selectedSender,
            recipients: allRecipients,
            subject: subject.trim(),
            body: body.trim(),
            scheduledAt: new Date(
              startTime
            ).toISOString(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Bulk scheduling failed. Check backend logs before retrying."
        );
      }

      const result =
        data as BulkScheduleResponse;

      setScheduleSuccess(
        `${result.scheduledCount} email(s) successfully scheduled!`
      );

      setRecipient("");
      setRecipients([]);
      setShowSchedule(false);

      window.setTimeout(() => {
        onBack();
      }, 1500);
    } catch (error) {
      setScheduleError(
        error instanceof Error
          ? error.message
          : "Failed to schedule emails."
      );
    } finally {
      setIsScheduling(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-[#172033]">
      <header className="flex items-center justify-between px-8 py-6">
        <button
          type="button"
          onClick={onBack}
          disabled={isScheduling}
          className="flex items-center gap-3 text-xl font-medium"
        >
          <ArrowLeft size={22} />
          Compose New Email
        </button>

        <button
          type="button"
          onClick={() => setShowSchedule(true)}
          disabled={isScheduling}
          className="flex items-center gap-2 rounded-full border border-[#00ad49] px-5 py-2 text-sm font-medium text-[#00ad49] hover:bg-green-50 disabled:opacity-50"
        >
          <Clock3 size={17} />
          Send Later
        </button>
      </header>

      <main className="mx-auto max-w-[1000px] px-8 pt-5">
        <div className="space-y-6">
          {/* FROM */}
          <div className="flex items-center gap-5">
            <label
              htmlFor="sender"
              className="w-16 shrink-0 text-sm"
            >
              From
            </label>

            <div>
              <select
                id="sender"
                value={selectedSender}
                onChange={(event) =>
                  handleSenderChange(
                    event.target.value
                  )
                }
                disabled={
                  sendersLoading || isScheduling
                }
                className="min-w-[280px] rounded-lg bg-[#f3f5f4] px-3 py-3 text-sm outline-none"
              >
                <option value="">
                  {sendersLoading
                    ? "Loading senders..."
                    : "Choose sender"}
                </option>

                {senders.map((sender) => (
                  <option
                    key={sender.id}
                    value={sender.email}
                  >
                    {sender.display_name ||
                      sender.email}{" "}
                    ({sender.email})
                  </option>
                ))}
              </select>

              {sendersError && (
                <p className="mt-1 text-xs text-red-500">
                  {sendersError}
                </p>
              )}

              {!sendersLoading &&
                !sendersError &&
                senders.length === 0 && (
                  <p className="mt-2 text-xs text-orange-600">
                    No sender registered for this account.
                  </p>
                )}
            </div>
          </div>

          {/* TO */}
          <div className="border-b border-gray-200 pb-4">
            <div className="flex items-center gap-5">
              <label
                htmlFor="recipient"
                className="w-16 shrink-0 text-sm"
              >
                To
              </label>

              <input
                id="recipient"
                type="text"
                placeholder="Enter email and press Enter"
                value={recipient}
                disabled={isScheduling}
                onChange={(event) =>
                  setRecipient(event.target.value)
                }
                onKeyDown={
                  handleRecipientKeyDown
                }
                onBlur={() => {
                  if (recipient.trim()) {
                    addRecipients(recipient);
                  }
                }}
                className="min-w-0 flex-1 text-sm outline-none"
              />

              <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-[#00ad49]">
                <Upload size={16} />
                Upload List
                <input
                  type="file"
                  accept=".csv,.txt"
                  disabled={isScheduling}
                  onChange={
                    handleRecipientUpload
                  }
                  className="hidden"
                />
              </label>
            </div>

            {recipients.length > 0 && (
              <div className="ml-[84px] mt-4 flex flex-wrap gap-2">
                {recipients.map((email) => (
                  <span
                    key={email}
                    className="flex items-center gap-2 rounded-full bg-[#e3f6ec] px-3 py-1.5 text-xs font-medium text-[#087c3c]"
                  >
                    {email}

                    <button
                      type="button"
                      onClick={() =>
                        removeRecipient(email)
                      }
                      disabled={isScheduling}
                      aria-label={`Remove ${email}`}
                      className="hover:text-red-600"
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="ml-[84px] mt-3 flex flex-wrap gap-3">
              <span className="text-xs text-gray-400">
                {recipients.length} recipient(s) added
              </span>

              {recipientError && (
                <span className="text-xs text-red-500">
                  {recipientError}
                </span>
              )}
            </div>
          </div>

          {/* SUBJECT */}
          <div className="flex items-center gap-5 border-b border-gray-200 pb-4">
            <label
              htmlFor="subject"
              className="w-16 shrink-0 text-sm"
            >
              Subject
            </label>

            <input
              id="subject"
              type="text"
              placeholder="Subject"
              value={subject}
              disabled={isScheduling}
              onChange={(event) =>
                setSubject(event.target.value)
              }
              className="min-w-0 flex-1 text-sm outline-none"
            />
          </div>

          {/* SENDER LIMITS */}
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div className="flex items-center gap-3">
              <label htmlFor="email-delay">
                Delay between 2 emails
              </label>

              <input
                id="email-delay"
                type="number"
                min="0"
                value={delay}
                readOnly
                className="w-20 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 outline-none"
              />

              <span className="text-xs text-gray-400">
                sec
              </span>
            </div>

            <div className="flex items-center gap-3">
              <label htmlFor="hourly-limit">
                Hourly Limit
              </label>

              <input
                id="hourly-limit"
                type="number"
                min="1"
                value={hourlyLimit}
                readOnly
                className="w-20 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 outline-none"
              />
            </div>
          </div>

          <p className="text-xs text-gray-400">
            Sending limits are configured for the selected sender
            and enforced by the backend worker.
          </p>

          {/* EMAIL BODY */}
          <div className="min-h-[420px] rounded-xl bg-[#f8f8f8] p-4">
            <div className="mb-4 flex items-center gap-5 rounded-full bg-white px-4 py-3 text-gray-400">
              <Bold size={17} />
              <Italic size={17} />
              <Underline size={17} />
              <List size={17} />
              <ListOrdered size={17} />
            </div>

            <textarea
              placeholder="Write your email here..."
              value={body}
              disabled={isScheduling}
              onChange={(event) =>
                setBody(event.target.value)
              }
              className="h-[330px] w-full resize-none bg-transparent text-sm outline-none"
            />
          </div>

          {/* STATUS */}
          {scheduleError && (
            <p
              role="alert"
              className="text-sm text-red-600"
            >
              {scheduleError}
            </p>
          )}

          {scheduleSuccess && (
            <p
              role="status"
              className="text-sm text-green-600"
            >
              {scheduleSuccess}
            </p>
          )}

          {/* SCHEDULE BUTTON */}
          <div className="flex justify-end pb-8">
            <button
              type="button"
              onClick={() =>
                void handleSchedule()
              }
              disabled={
                isScheduling || sendersLoading
              }
              className="rounded-full bg-[#00ad49] px-7 py-3 text-sm font-medium text-white hover:bg-[#008d3c] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isScheduling
                ? "Scheduling..."
                : `Schedule ${
                    recipients.length +
                    (recipient.trim() ? 1 : 0)
                  } Email(s)`}
            </button>
          </div>
        </div>
      </main>

      {/* DATE/TIME POPUP */}
      {showSchedule && (
        <div className="fixed right-8 top-20 z-10 w-[300px] rounded-xl border border-gray-200 bg-white p-5 shadow-lg">
          <h3 className="mb-5 font-medium">
            Send Later
          </h3>

          <label
            htmlFor="scheduled-at"
            className="mb-2 block text-sm text-gray-500"
          >
            Pick date &amp; time
          </label>

          <input
            id="scheduled-at"
            type="datetime-local"
            value={scheduledAt}
            disabled={isScheduling}
            onChange={(event) =>
              setScheduledAt(
                event.target.value
              )
            }
            className="w-full rounded-lg border border-gray-200 p-3 text-sm outline-none"
          />

          {scheduledAt && (
            <p className="mt-3 text-xs text-gray-500">
              Selected:{" "}
              {new Date(
                scheduledAt
              ).toLocaleString()}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() =>
                setShowSchedule(false)
              }
              className="px-4 py-2 text-sm"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() =>
                setShowSchedule(false)
              }
              className="rounded-full border border-[#00ad49] px-5 py-2 text-sm text-[#00ad49]"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
