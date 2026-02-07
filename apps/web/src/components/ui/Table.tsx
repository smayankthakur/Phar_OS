import type { ReactNode } from "react";

export function Table({ children }: { children: ReactNode }) {
  return <table className="sku-table ui-table">{children}</table>;
}
