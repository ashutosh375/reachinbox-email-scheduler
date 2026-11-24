
import { GoogleLogin } from "@react-oauth/google";
import type { CredentialResponse } from "@react-oauth/google";
import { Mail } from "lucide-react";

interface LoginProps {
  onLogin: (credential: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  function handleSuccess(response: CredentialResponse) {
    if (!response.credential) {
      return;
    }

    onLogin(response.credential);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8faf9] px-4">
      <div className="w-full max-w-[430px] rounded-2xl border border-gray-200 bg-white p-9 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-[#172033]">
            Welcome Back
          </h1>

          <p className="text-sm text-gray-500">
            Sign in to manage your scheduled emails
          </p>
        </div>

        <div className="mb-6 flex justify-center rounded-xl bg-[#f0faf4] p-5">
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => {
              alert("Google login failed. Please try again.");
            }}
            theme="outline"
            size="large"
            text="signin_with"
            shape="pill"
            width="300"
          />
        </div>

        <div className="mb-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs text-gray-400">
            Secure Google Authentication
          </span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
          <Mail size={15} />
          <span>ReachInbox Email Scheduler</span>
        </div>
      </div>
    </div>
  );
}
