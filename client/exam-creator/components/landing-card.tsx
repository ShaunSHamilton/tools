import { ReactNode } from "react";
import { UsersOnPageAvatars } from "./users-on-page-avatars";

interface LandingCardProps {
  path: string;
  children: ReactNode;
}

export function LandingCard({ path, children }: LandingCardProps) {
  return (
    <div className="rounded-xl shadow-md px-4 py-3 h-full min-h-[120px] hover:border-primary hover:shadow-lg border-2 border-transparent transition-all duration-150 bg-card">
      <div className="pb-2">
        <div className="flex items-center justify-between">
          <p className="text-xl font-bold text-primary truncate max-w-[80%]">
            {children}
          </p>
        </div>
      </div>
      <div className="pt-2">
        <UsersOnPageAvatars path={path} />
      </div>
    </div>
  );
}
