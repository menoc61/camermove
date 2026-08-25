export function apiUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
  return `${base}/api/v1${path}`
}
