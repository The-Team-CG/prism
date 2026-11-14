/** Hands a downloaded file to the browser as a save. */
export function saveDownload(file: { blob: Blob; fileName: string }) {
  const url = URL.createObjectURL(file.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.fileName;
  link.click();
  URL.revokeObjectURL(url);
}
