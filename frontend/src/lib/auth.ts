export function saveUserId(id: string) {
  localStorage.setItem("userId", id);
}

export function getUserId(): string | null {
  // Temporarily disabled for testing - always return mock user ID
  return "test-user-123";
  // return localStorage.getItem("userId");
}

export function logout() {
  localStorage.removeItem("userId");
}
