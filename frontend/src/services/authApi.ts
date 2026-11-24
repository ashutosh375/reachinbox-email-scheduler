
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  picture: string;
}

interface AuthResponse {
  user: AuthUser;
}

export async function verifyGoogleLogin(
  credential: string
): Promise<AuthUser> {
  const response = await fetch("/api/auth/google", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ credential }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);

    throw new Error(
      data?.error || "Google login verification failed"
    );
  }

  const data: AuthResponse = await response.json();

  return data.user;
}
