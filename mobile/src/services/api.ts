import { API_URL } from "../constants";

export async function sendMeMail(
  email: string,
  title: string,
  url: string
): Promise<boolean> {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=UTF-8" },
      body: JSON.stringify({ email, title, url }),
    });
    const text = await response.text();
    return text === "success";
  } catch {
    return false;
  }
}
