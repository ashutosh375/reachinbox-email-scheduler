
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  RefreshCw,
  Search,
  Star,
} from "lucide-react";

import Sidebar from "../components/Sidebar";
import SlackSettings from "../components/SlackSettings";

import { fetchEmails } from "../services/emailApi";
import { searchEmails } from "../services/searchApi";

import type { Email } from "../types/email";

type EmailTab = "scheduled" | "sent";

interface DashboardProps {
  onCompose: () => void;
  userId: string;
}

export default function Dashboard({
  onCompose,
  userId,
}: DashboardProps) {
  const [activeTab, setActiveTab] =
    useState<EmailTab>("scheduled");

  const [emails, setEmails] = useState<Email[]>([]);

  const [scheduledCount, setScheduledCount] =
    useState(0);

  const [sentCount, setSentCount] =
    useState(0);

  const [search, setSearch] = useState("");

  const [searchResults, setSearchResults] =
    useState<Email[]>([]);

  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const loadEmails = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [scheduled, sent] = await Promise.all([
        fetchEmails(userId, "scheduled"),
        fetchEmails(userId, "sent"),
      ]);

      setScheduledCount(scheduled.count);
      setSentCount(sent.count);

      setEmails(
        activeTab === "scheduled"
          ? scheduled.emails
          : sent.emails
      );
    } catch {
      setError(
        "Unable to load emails. Please check the backend server."
      );
    } finally {
      setLoading(false);
    }
  }, [activeTab, userId]);

  // Load emails when the tab changes
  useEffect(() => {
    void loadEmails();
  }, [loadEmails]);

  // Search using Elasticsearch
  useEffect(() => {
    const query = search.trim();

    if (!query) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;

    setSearchResults([]);
    setSearching(true);
    setError("");

    const timer = window.setTimeout(async () => {
      try {
        const results = await searchEmails(query);

        if (!cancelled) {
          setSearchResults(results);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Search failed."
          );
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search]);

  const isSearchActive = search.trim().length > 0;

  const displayedEmails = isSearchActive
    ? searchResults.filter(
        (email) => email.status === activeTab
      )
    : emails;

  return (
    <div className="flex min-h-screen bg-white text-[#172033]">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onCompose={onCompose}
        scheduledCount={scheduledCount}
        sentCount={sentCount}
      />

      <main className="min-w-0 flex-1 px-6 py-5">

        {/* Search Bar */}
        <div className="mb-5 flex items-center gap-4">
          <div className="relative max-w-[580px] flex-1">
            <Search
              size={17}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type="search"
              placeholder="Search emails..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              className="w-full rounded-full bg-[#f3f6f5] py-3 pl-11 pr-4 text-sm outline-none placeholder:text-gray-400"
            />
          </div>

          <button
            type="button"
            onClick={() => void loadEmails()}
            aria-label="Refresh emails"
            title="Refresh"
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
          >
            <RefreshCw size={18} />
          </button>
        </div>

        {/* Email List */}
        {loading || (isSearchActive && searching) ? (
          <p className="py-12 text-center text-sm text-gray-500">
            {searching
              ? "Searching emails..."
              : "Loading emails..."}
          </p>
        ) : error ? (
          <div className="py-12 text-center">
            <p className="mb-3 text-sm text-red-600">
              {error}
            </p>

            <button
              type="button"
              onClick={() => {
                if (isSearchActive) {
                  setSearch("");
                }
                void loadEmails();
              }}
              className="text-sm font-medium text-green-600"
            >
              Try again
            </button>
          </div>
        ) : displayedEmails.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500">
            {isSearchActive
              ? "No emails match your search."
              : `No ${activeTab} emails yet.`}
          </p>
        ) : (
          <div>
            {displayedEmails.map((email) => (
              <div
                key={email.id}
                className="flex items-center gap-4 border-b border-gray-100 px-4 py-4 text-sm hover:bg-gray-50"
              >
                <span className="w-[160px] shrink-0 truncate font-medium">
                  To: {email.recipient_email}
                </span>

                <span
                  className={`shrink-0 rounded-full px-2 py-1 text-xs ${
                    email.status === "scheduled"
                      ? "bg-orange-50 text-orange-600"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {email.status === "scheduled"
                    ? new Date(
                        email.scheduled_at
                      ).toLocaleString()
                    : "Sent"}
                </span>

                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="shrink-0 truncate font-medium">
                    {email.subject}
                  </span>

                  <span className="truncate text-gray-400">
                    - {email.body}
                  </span>
                </div>

                <Star
                  size={17}
                  className="shrink-0 text-gray-300"
                />
              </div>
            ))}
          </div>
        )}

        {/* Slack Settings */}
        <div className="mt-10 border-t border-gray-200 pt-8">
          <SlackSettings />
        </div>

      </main>
    </div>
  );
}
