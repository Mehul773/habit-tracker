const KEY = "ht_pw";
export const getPw = (): string | null => localStorage.getItem(KEY);
export const setPw = (pw: string): void => localStorage.setItem(KEY, pw);
export const clearPw = (): void => localStorage.removeItem(KEY);
