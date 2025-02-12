type StrFunc = (str?: string) => string;
type ColFunc = (d?: string | StrFunc | ColFunc) => string;
// text
export const gray = (d: string | ColFunc) =>
	`\x1b[0;38;5;0m${typeof d === "function" ? d() : d}\x1b[0m`;
export const black = (d: string | ColFunc) =>
	`\x1b[30m${typeof d === "function" ? d() : d}\x1b[0m`;
export const red = (d: string | ColFunc) =>
	`\x1b[31m${typeof d === "function" ? d() : d}\x1b[0m`;
export const green = (d: string | ColFunc) =>
	`\x1b[32m${typeof d === "function" ? d() : d}\x1b[0m`;
export const yellow = (d: string | ColFunc) =>
	`\x1b[33;5m${typeof d === "function" ? d() : d}\x1b[0m`;
export const blue = (d: string | ColFunc) =>
	`\x1b[34m${typeof d === "function" ? d() : d}\x1b[0m`;
export const purple = (d: string | ColFunc) =>
	`\x1b[35m${typeof d === "function" ? d() : d}\x1b[0m`;
export const cyan = (d: string | ColFunc) =>
	`\x1b[36m${typeof d === "function" ? d() : d}\x1b[0m`;
export const white = (d: string | ColFunc) =>
	`\x1b[37m${typeof d === "function" ? d() : d}\x1b[0m`;
// =============================== background, =======================================
export const bgBlack = (d: string | ColFunc) =>
	`\x1b[40m ${typeof d === "function" ? d() : d}m \x1b[0m`;
export const bgRed = (d: string | ColFunc) =>
	`\x1b[41m ${typeof d === "function" ? d() : d} \x1b[0m`;
