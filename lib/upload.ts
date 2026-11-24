import { auth } from "@/lib/firebase";

/**
 * Upload an image through `/api/upload` and return its public URL. Sends the
 * admin's Firebase token, which the route checks before storing anything.
 */
export const uploadImageFile = async (
  file: Blob,
  fileName: string,
): Promise<string> => {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error("Sign in again to upload files");

  const response = await fetch(
    `/api/upload?filename=${encodeURIComponent(fileName)}`,
    {
      method: "POST",
      body: file,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(file.type ? { "Content-Type": file.type } : {}),
      },
    },
  );
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(problem?.error || "Upload failed");
  }
  const blob = (await response.json()) as { url?: string };
  if (!blob.url) throw new Error("Upload failed");
  return blob.url;
};
