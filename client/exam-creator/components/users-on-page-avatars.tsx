import { useUsersOnPath } from "../hooks/use-users-on-path";
import { Tooltip } from "./tooltip";

interface UsersOnPageAvatarsProps {
  path: string;
}

export function UsersOnPageAvatars({ path }: UsersOnPageAvatarsProps) {
  const { users: usersOnPage, error: usersError } = useUsersOnPath(path);

  return (
    <div className="flex items-center -space-x-2 ml-4">
      {usersError ? (
        <span className="text-red-400 text-sm">{usersError.message}</span>
      ) : (
        usersOnPage.slice(0, 5).map((user, idx) => (
          <Tooltip key={user.email} content={user.name}>
            <div
              className="relative rounded-full border-2 border-background shadow-md overflow-hidden w-10 h-10 bg-muted flex items-center justify-center"
              style={{ zIndex: 5 - idx }}
            >
              {user.picture ? (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs font-medium text-foreground">
                  {user.name
                    ?.split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </span>
              )}
            </div>
          </Tooltip>
        ))
      )}
      {usersOnPage.length > 5 && (
        <div className="rounded-full bg-muted text-muted-foreground w-10 h-10 flex items-center justify-center text-xs font-medium border-2 border-background">
          +{usersOnPage.length - 5}
        </div>
      )}
    </div>
  );
}
