
import { ChevronDown, Clock3, Send } from "lucide-react";

type EmailTab = "scheduled" | "sent";

interface SidebarProps {
  activeTab: EmailTab;
  onTabChange: (tab: EmailTab) => void;
  onCompose: () => void;
  scheduledCount: number;
  sentCount: number;
}

export default function Sidebar({
  activeTab,
  onTabChange,
  onCompose,
  scheduledCount,
  sentCount,
}: SidebarProps) {
  return (
    <aside className="flex h-screen w-[240px] shrink-0 flex-col bg-white px-3 py-4">
      <div className="mb-5 px-2">
        <h1 className="text-3xl font-black tracking-tighter text-black">
          ONB
        </h1>
      </div>

      <div className="mb-3 flex items-center gap-3 rounded-xl bg-[#f4f7f6] p-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d8f4e6] font-semibold text-[#009d45]">
          U
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900">
            Test User
          </p>
          <p className="truncate text-[11px] text-gray-500">
            Development account
          </p>
        </div>

        <ChevronDown size={15} className="text-gray-400" />
      </div>

      <button
        type="button"
        onClick={onCompose}
        className="mb-6 w-full rounded-full border border-[#00ad49] py-2 text-sm font-medium text-[#00ad49] transition hover:bg-green-50"
      >
        Compose
      </button>

      <p className="mb-2 px-3 text-[11px] font-medium uppercase text-gray-400">
        Core
      </p>

      <nav className="space-y-1">
        <button
          type="button"
          onClick={() => onTabChange("scheduled")}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm ${
            activeTab === "scheduled"
              ? "bg-[#e3f6ec] font-semibold text-gray-900"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Clock3 size={17} />
          <span className="flex-1 text-left">Scheduled</span>
          <span className="text-xs text-gray-500">
            {scheduledCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange("sent")}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm ${
            activeTab === "sent"
              ? "bg-[#e3f6ec] font-semibold text-gray-900"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Send size={17} />
          <span className="flex-1 text-left">Sent</span>
          <span className="text-xs text-gray-500">
            {sentCount}
          </span>
        </button>
      </nav>
    </aside>
  );
}
