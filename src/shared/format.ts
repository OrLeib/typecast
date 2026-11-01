/** A 0-1 fraction as a percentage, "n/a" when undefined (NaN). */
export const percent = (x: number, decimals = 1) => (Number.isNaN(x) ? "n/a" : `${(x * 100).toFixed(decimals)}%`);

/** Makes text safe to put in HTML content and attribute values. */
export const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
