import { useContext } from "react";
import { Tooltip } from "./tooltip";
import { UsersWebSocketUsersContext } from "../contexts/users-websocket";

export function UsersOnPage({ page }: { page: string }) {
  const { users, error: usersError } = useContext(UsersWebSocketUsersContext)!;

  const filteredUsers = users.filter((user) => {
    return user.activity.page.pathname === page;
  });

  return (
    <div className="flex items-center -space-x-2 ml-4">
      {usersError ? (
        <span className="text-red-400 text-sm">{usersError.message}</span>
      ) : (
        filteredUsers.slice(0, 5).map((user, idx) => (
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
      {filteredUsers.length > 5 && (
        <div className="rounded-full bg-muted text-muted-foreground w-10 h-10 flex items-center justify-center text-xs font-medium border-2 border-background">
          +{filteredUsers.length - 5}
        </div>
      )}
    </div>
  );
}
