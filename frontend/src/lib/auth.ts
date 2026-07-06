export function saveUserId(id: string) {
  localStorage.setItem("userId", id);
}

export function getUserId(): string | null {
  return localStorage.getItem("userId");
}

export function logout() {
  localStorage.removeItem("userId");
}
