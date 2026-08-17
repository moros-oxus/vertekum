/** Write an export artifact to the collection via the bridge server (ADR-0015, ADR-0018). */
export async function writeOutputFile(
  path: string,
  content: string,
): Promise<void> {
  const res = await fetch(`/api/file?path=${encodeURIComponent(path)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/plain' },
    body: content,
  });
  if (!res.ok) throw new Error(`write failed: ${res.status}`);
}
