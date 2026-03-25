import { useContext, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ChevronDownIcon, Database, Loader2 } from "lucide-react";
import { putUserSettings } from "../utils/fetch";
import { AuthContext } from "../contexts/auth";
import { Tooltip } from "./tooltip";
import { toaster } from "./toaster";

export function DatabaseStatus() {
  const { user } = useContext(AuthContext)!;
  const [databaseEnvironment, setDatabaseEnvironment] = useState(
    user?.settings?.databaseEnvironment || "Production",
  );
  const [menuOpen, setMenuOpen] = useState(false);

  const { isError, isPending, error, mutate } = useMutation({
    mutationKey: ["userSettingsDatabase"],
    mutationFn: async (databaseEnvironment: "Production" | "Staging") => {
      return putUserSettings({ databaseEnvironment });
    },
    onSuccess: (data) => {
      setDatabaseEnvironment(data.databaseEnvironment);
      toaster.create({
        title: "Database switched",
        description: `Switched to ${data.databaseEnvironment} database`,
        type: "success",
        duration: 3000,
        closable: true,
      });
      window.location.reload();
    },
    onError: (error: any) => {
      console.error(error);
      toaster.create({
        title: "Error switching database",
        description: error.message || "An error occurred",
        type: "error",
        duration: 5000,
        closable: true,
      });
    },
    retry: false,
  });

  function getBadgeColor(env: "Production" | "Staging") {
    return env === "Production"
      ? "bg-red-500/20 text-red-400"
      : "bg-yellow-500/20 text-yellow-400";
  }

  if (isError) {
    console.error(error);
    return (
      <div>
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-500/20 text-red-400">
          Error fetching
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Tooltip content="Change the database environment to filter which attempts to moderate">
        <div className="flex items-center gap-2">
          <Database size={16} />
          <span className="text-sm font-medium">Database:</span>
        </div>
      </Tooltip>
      <div className="relative">
        <button
          className="border border-border rounded-md px-2 py-1 text-sm flex items-center gap-1 disabled:opacity-50"
          onClick={() => setMenuOpen(!menuOpen)}
          disabled={isPending}
        >
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getBadgeColor(databaseEnvironment)}`}
          >
            {databaseEnvironment}
          </span>
          {isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <ChevronDownIcon size={16} />
          )}
        </button>
        {menuOpen && (
          <div className="absolute left-0 top-full mt-1 z-50 bg-background border border-border rounded-md shadow-lg min-w-[180px]">
            <button
              className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 disabled:opacity-50"
              onClick={() => {
                mutate("Production");
                setMenuOpen(false);
              }}
              disabled={databaseEnvironment === "Production" || isPending}
            >
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-500/20 text-red-400">
                Production
              </span>
              Live data
            </button>
            <button
              className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 disabled:opacity-50"
              onClick={() => {
                mutate("Staging");
                setMenuOpen(false);
              }}
              disabled={databaseEnvironment === "Staging" || isPending}
            >
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-yellow-500/20 text-yellow-400">
                Staging
              </span>
              Test data
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
