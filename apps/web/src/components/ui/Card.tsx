import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`content-card ui-card ${className}`.trim()}>{children}</section>;
}

export function CardHeader({ children }: { children: ReactNode }) {
  return <div className="ui-card-header">{children}</div>;
}

export function CardContent({ children }: { children: ReactNode }) {
  return <div className="ui-card-content">{children}</div>;
}

export function CardFooter({ children }: { children: ReactNode }) {
  return <div className="ui-card-footer">{children}</div>;
}
