import { Share } from "@capacitor/share";

async function copyShareTextSilently(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

export async function smartNativeShare({ title, text, url }) {
  const shareTitle = title || "Restaurant Finder and Planner";
  const shareText = text || "";
  const shareUrl = url || "";
  const fallbackText = [shareTitle, shareText, shareUrl].filter(Boolean).join("\n\n");

  try {
    await Share.share({
      title: shareTitle,
      text: shareText,
      url: shareUrl || undefined,
      dialogTitle: "Share restaurant",
    });
    return true;
  } catch {
    try {
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl || undefined,
        });
        return true;
      }
    } catch (webShareError) {
      if (webShareError?.name === "AbortError") return false;
    }

    return copyShareTextSilently(fallbackText);
  }
}
