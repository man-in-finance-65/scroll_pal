import { Linking } from "react-native";

// Shopping goes through DoorDash (owner's pick, 2026-10-25). DoorDash has no public cart API, so Pal opens
// DoorDash's own search for each missing item; on a phone with the DoorDash app, doordash.com links open the app.
export const doordashSearchUrl = (item: string) => `https://www.doordash.com/search/store/${encodeURIComponent(item)}/`;

// Your DoorDash orders, to check on the delivery while you wait.
export const doordashOrdersUrl = () => "https://www.doordash.com/orders/";

// Throws with a useful message if the phone can't open the link.
export async function openDoordash(url: string) {
  try {
    await Linking.openURL(url);
  } catch (e) {
    throw new Error(`I couldn't open DoorDash. ${(e as Error).message}`);
  }
}
