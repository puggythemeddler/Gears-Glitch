export function escapeHtml(v: string) {
  const d = document.createElement("div");
  d.textContent = v;
  return d.innerHTML;
}
