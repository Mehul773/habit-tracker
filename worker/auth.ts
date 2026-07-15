export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPassword(input: string, storedHash: string | null): Promise<boolean> {
  if (!storedHash) return false;
  return (await sha256Hex(input)) === storedHash;
}
