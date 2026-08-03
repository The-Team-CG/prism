import { eveChannel } from "eve/channels/eve";
import { localDev, placeholderAuth, vercelOidc } from "eve/channels/auth";

export default eveChannel({
  auth: [
    // Lets the eve TUI and prism's own Vercel deployments reach this agent.
    vercelOidc(),
    // Open on localhost for `eve dev`; ignored in production.
    localDev(),
    // Placeholder: refuses browser requests in production. Replace with the
    // PMCM session check before exposing this agent to anything but the API.
    placeholderAuth(),
  ],
});
