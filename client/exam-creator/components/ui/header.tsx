import { ReactNode } from "react";
import { UsersOnPageAvatars } from "../users-on-page-avatars";

interface HeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export function Header({ title, description, children }: HeaderProps) {
  const path = window.location.pathname.split("/")[1];
  console.debug(path);
  return (
    <div className="flex justify-between items-center bg-background rounded-xl p-8 shadow-lg mb-2">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold text-primary">
          {title}
        </h1>
        {description && (
          <p className="text-lg text-muted-foreground">
            Create exams for the Exam Environment.
          </p>
        )}
      </div>
      <UsersOnPageAvatars path={"/" + path} />
      {children}
    </div>
  );
}
