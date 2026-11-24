
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Unplug, Save } from "lucide-react";

interface SlackStatus {
  connected: boolean;
  workspace?: string;
  channelId?: string | null;
}

export default function SlackSettings() {
  const [status, setStatus] = useState<SlackStatus | null>(null);
  const [channelId, setChannelId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadStatus() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/slack/status");

      if (!response.ok) {
        throw new Error("Could not load Slack connection");
      }

      const data: SlackStatus = await response.json();

      setStatus(data);
      setChannelId(data.channelId ?? "");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  function connectSlack() {
    window.location.href = "/api/slack/connect";
  }

  async function saveChannel() {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/slack/channel", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channelId: channelId.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save Slack channel");
      }

      setSuccess("Slack notification channel saved!");
      await loadStatus();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save channel"
      );
    } finally {
      setSaving(false);
    }
  }

  async function disconnectSlack() {
    if (!window.confirm("Disconnect your Slack workspace?")) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/slack/disconnect", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to disconnect Slack");
      }

      setStatus({ connected: false });
      setChannelId("");
      setSuccess("Slack disconnected successfully!");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to disconnect"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-gray-900">
          Slack Notifications
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Get notified when an email sender reaches its hourly limit.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading Slack settings...
        </div>
      ) : status?.connected ? (
        <div className="space-y-5">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">
              Connected to {status.workspace ?? "Slack"}
            </span>
          </div>

          <div>
            <label
              htmlFor="slack-channel"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Notification Channel ID
            </label>

            <input
              id="slack-channel"
              type="text"
              value={channelId}
              onChange={(event) => setChannelId(event.target.value)}
              placeholder="Example: C0CLL0V3YFQ"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500"
            />

            <p className="mt-2 text-xs text-gray-500">
              Add the ReachInbox Slack app to the channel before saving.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={saveChannel}
              disabled={saving || !channelId.trim()}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Save Channel
            </button>

            <button
              type="button"
              onClick={disconnectSlack}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Unplug className="h-4 w-4" />
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={connectSlack}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          Connect Slack
        </button>
      )}

      {error && (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      )}

      {success && (
        <p className="mt-4 text-sm text-green-700">{success}</p>
      )}
    </div>
  );
}
