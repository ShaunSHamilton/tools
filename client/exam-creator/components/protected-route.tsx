import { ReactNode, useContext } from "react";
import { AuthContext } from "../contexts/auth";
import { Navigate } from "@tanstack/react-router";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  // Safety: Context should exist, because provider is mounted at root.
  const { user, isLoading } = useContext(AuthContext)!;

  if (isLoading) {
    // Wait for auth check to complete before deciding whether to redirect
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-teal-400 border-t-transparent" />
      </div>
    );
  }
  if (!user) {
    // user is not authenticated
    return <Navigate to="/login" />;
  }
  return children;
}
