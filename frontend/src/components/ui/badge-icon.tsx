import { Medal, Star, Megaphone, Trophy, Compass, MessageCircle, Award, type LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  medal: Medal,
  star: Star,
  megaphone: Megaphone,
  trophy: Trophy,
  compass: Compass,
  "message-circle": MessageCircle,
};

export function BadgeIcon({ name, className }: { name: string; className?: string }) {
  const Icon = iconMap[name] || Award;
  return <Icon className={className} />;
}
