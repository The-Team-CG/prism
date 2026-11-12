import type { CSSProperties } from "react";

const backgroundUrl = new URL("../../assets/images/portal-doodles.webp", import.meta.url).toString();

export const portalBackgroundStyle = {
  backgroundColor: "#fff8f2",
  backgroundImage: `linear-gradient(rgba(255, 248, 249, 0.55), rgba(255, 248, 249, 0.55)), url("${backgroundUrl}")`,
  backgroundSize: "960px auto",
  backgroundPosition: "center",
  backgroundRepeat: "repeat",
  backgroundAttachment: "scroll",
} satisfies CSSProperties;
