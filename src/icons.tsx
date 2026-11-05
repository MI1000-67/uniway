import {
  BookOpen,
  Coffee,
  GraduationCap,
  HeartHandshake,
  ParkingCircle,
  Accessibility,
  MapPin,
} from "lucide-react";
import type { Category } from "./campus";
export function CategoryIcon({
  category,
  size = 18,
}: {
  category: Category | string;
  size?: number;
}) {
  const Icon =
    (
      {
        Library: BookOpen,
        Food: Coffee,
        Teaching: GraduationCap,
        Services: HeartHandshake,
        Toilets: Accessibility,
        Parking: ParkingCircle,
      } as Record<string, typeof MapPin>
    )[category] ?? MapPin;
  return <Icon size={size} strokeWidth={1.7} />;
}
