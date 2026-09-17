import {
  Folder,
  Users as UsersIcon,
  ShoppingCart,
  Package,
  Calculator,
  TrendingUp,
  PieChart,
  GraduationCap,
  Target,
  FileText,
  LayoutGrid,
} from 'lucide-react';

const map = {
  folder: Folder,
  users: UsersIcon,
  cart: ShoppingCart,
  box: Package,
  calculator: Calculator,
  'trending-up': TrendingUp,
  'pie-chart': PieChart,
  'graduation-cap': GraduationCap,
  target: Target,
  'file-text': FileText,
};

export function moduleIcon(name) {
  return map[name] || LayoutGrid;
}
