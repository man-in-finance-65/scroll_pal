import { Linking } from "react-native";

// Shopping goes through the Walmart app. Walmart has no public cart API (nor do DoorDash or Costco), so Pal
// opens Walmart's own search for each missing item; on a phone with the Walmart app, walmart.com links open the app.
// The phone's region picks the store: Canada gets walmart.ca, everyone else walmart.com.
function region(): string {
  try {
    return (Intl.DateTimeFormat().resolvedOptions().locale.split("-")[1] ?? "").toUpperCase();
  } catch {
    return "";
  }
}

const canada = () => region() === "CA";

export const walmartSearchUrl = (item: string) =>
  canada() ? `https://www.walmart.ca/en/search?q=${encodeURIComponent(item)}` : `https://www.walmart.com/search?q=${encodeURIComponent(item)}`;

export const walmartCartUrl = () => (canada() ? "https://www.walmart.ca/en/cart" : "https://www.walmart.com/cart");

// Throws with a useful message if the phone can't open the link.
export async function openWalmart(url: string) {
  try {
    await Linking.openURL(url);
  } catch (e) {
    throw new Error(`I couldn't open Walmart. ${(e as Error).message}`);
  }
}
