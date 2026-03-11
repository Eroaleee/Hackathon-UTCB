import { Medal, Star, Megaphone, Trophy, Compass, MessageCircle, Award, type LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  medal: Medal,
  star: Star,
  megaphone: Megaphone,
  trophy: Trophy,
  compass: Compass,
  "message-circle": MessageCircle,
};

// Detect emoji: any string starting with a character outside basic ASCII
function isEmoji(str: string) {
  return /^[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(str);
}

export function BadgeIcon({ name, className }: { name: string; className?: string }) {
  if (isEmoji(name)) {
    return <span className={className} style={{ fontSize: "1.25em", lineHeight: 1 }}>{name}</span>;
  }
  const Icon = iconMap[name] || Award;
  return <Icon className={className} />;
}
