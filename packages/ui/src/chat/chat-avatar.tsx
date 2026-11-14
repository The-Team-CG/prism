import { Users } from "lucide-react";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { cn } from "../utils";
import { initials, threadMembers, type ChatThread } from "./chat-display";

const AVATAR_TONES = ["bg-primary/12 text-primary", "bg-attention-soft text-attention", "bg-success-soft text-success", "bg-info-soft text-info", "bg-muted text-foreground"];
const SIZES = { sm: "size-7 text-[11px]", md: "size-10 text-xs", lg: "size-11 text-sm" };

function avatarTone(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

/** A person's initials, or a group mark when `name` is omitted. The same seed always gets the same tone. */
export function ChatAvatar({ name, seed, size = "md" }: { name?: string; seed: string; size?: keyof typeof SIZES }) {
  return (
    <Avatar aria-hidden className={SIZES[size]}>
      <AvatarFallback className={cn("font-semibold text-[length:inherit]", avatarTone(seed))}>
        {name ? initials(name) : <Users className="size-[1.25em]" />}
      </AvatarFallback>
    </Avatar>
  );
}

/** A conversation looks like who it is with: one other person's initials, or a group mark for several. */
export function ThreadAvatar({ thread, viewerId, size }: { thread: ChatThread; viewerId?: string; size?: keyof typeof SIZES }) {
  const others = threadMembers(thread, viewerId);
  return others.length === 1 ? <ChatAvatar name={others[0].name} seed={others[0].id} size={size} /> : <ChatAvatar seed={thread.id} size={size} />;
}
