import type { ReactNode } from "react";
import "./Sidebar.css";

interface SidebarProps {
  children: ReactNode;
}

export default function Sidebar({ children }: SidebarProps): JSX.Element {
  return <aside className="sidebar">{children}</aside>;
}
