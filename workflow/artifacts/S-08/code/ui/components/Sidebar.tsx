import React from "react";
import "./Sidebar.css";

interface SidebarProps {
  children: React.ReactNode;
}

export default function Sidebar({ children }: SidebarProps): JSX.Element {
  return <aside className="sidebar">{children}</aside>;
}
