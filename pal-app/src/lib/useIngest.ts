import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ingest } from "./api";
import { useStore } from "./store";

/** Paste box and clipboard snackbar share this: send the link, save the recipe on the phone, open its digest. */
export function useIngest() {
  const router = useRouter();
  const { saveRecipe } = useStore();
  return useMutation({
    mutationKey: ["ingest"],
    mutationFn: (url: string) => ingest(url),
    onSuccess: ({ recipe, note }) => router.push({ pathname: "/recipe/[id]", params: { id: saveRecipe(recipe, note) } }),
  });
}
