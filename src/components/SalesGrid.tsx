"use client";

/**
 * SalesGrid — AG Grid Enterprise data grid for marketplace transactions.
 * Real rows straight from the database: order id, listing, counterparty,
 * amounts split (seller share / platform fee), status, date.
 */
import { AgGridReact } from "ag-grid-react";
import {
  ModuleRegistry,
  AllEnterpriseModule,
  themeQuartz,
  colorSchemeDarkBlue,
} from "ag-grid-enterprise";
import type { ColDef } from "ag-grid-enterprise";
import { formatUsd } from "@/lib/money";

// Register the enterprise modules once — required by AG Grid v33+.
ModuleRegistry.registerModules([AllEnterpriseModule]);

export interface OrderRow {
  id: string;
  listingTitle: string;
  counterparty: string;
  totalCents: number;
  sellerShareCents: number;
  platformFeeCents: number;
  status: string;
  createdAt: string;
}

/**
 * "Cosmic neon" grid theme: Quartz + dark-blue scheme, with a transparent
 * background so the surrounding glass panel shows through, and violet/cyan
 * accents matching the design system.
 */
const neonTheme = themeQuartz.withPart(colorSchemeDarkBlue).withParams({
  backgroundColor: "transparent",
  foregroundColor: "#e7e9ff",
  headerBackgroundColor: "rgba(255,255,255,0.03)",
  headerTextColor: "rgba(199,203,240,0.7)",
  oddRowBackgroundColor: "rgba(255,255,255,0.015)",
  rowHoverColor: "rgba(139,92,246,0.12)",
  selectedRowBackgroundColor: "rgba(34,211,238,0.12)",
  borderColor: "rgba(255,255,255,0.08)",
  accentColor: "#22d3ee",
  chromeBackgroundColor: "rgba(10,11,26,0.9)",
  fontFamily: "inherit",
  wrapperBorderRadius: 12,
});

const columnDefs: ColDef<OrderRow>[] = [
  {
    field: "listingTitle",
    headerName: "Listing",
    flex: 2,
    filter: "agTextColumnFilter",
  },
  {
    field: "counterparty",
    headerName: "Counterparty",
    flex: 1,
    filter: "agTextColumnFilter",
  },
  {
    field: "totalCents",
    headerName: "Total",
    valueFormatter: (p) => formatUsd(p.value),
    sort: "desc",
  },
  {
    field: "sellerShareCents",
    headerName: "Seller share",
    valueFormatter: (p) => formatUsd(p.value),
  },
  {
    field: "platformFeeCents",
    headerName: "Platform fee",
    valueFormatter: (p) => formatUsd(p.value),
  },
  {
    field: "status",
    headerName: "Status",
    filter: "agTextColumnFilter",
    cellClass: (p) =>
      p.value === "PAID"
        ? "text-emerald-300 font-medium"
        : "text-white/60",
  },
  {
    field: "createdAt",
    headerName: "Date",
    valueFormatter: (p) => new Date(p.value).toLocaleString(),
    sort: "desc",
  },
];

export function SalesGrid({ rows }: { rows: OrderRow[] }) {
  return (
    // data-lenis-prevent keeps wheel scrolling inside the grid native.
    <div className="h-80 w-full" data-lenis-prevent>
      <AgGridReact<OrderRow>
        theme={neonTheme}
        rowData={rows}
        columnDefs={columnDefs}
        defaultColDef={{ sortable: true, resizable: true }}
        pagination
        paginationPageSize={8}
      />
    </div>
  );
}
