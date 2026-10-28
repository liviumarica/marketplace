"use client";

/**
 * SalesGrid — AG Grid (Community edition) data grid for marketplace
 * transactions. Real rows straight from the database: listing,
 * counterparty, amounts split (seller share / platform fee), status, date.
 *
 * Only sorting, text filters and pagination are used — all free Community
 * features — so there is no Enterprise trial watermark or console warning.
 * When there are no rows we render a friendly empty state (with an optional
 * call to action) instead of the grid's raw "No Rows To Show / Page 0 of 0".
 */
import Link from "next/link";
import { AgGridReact } from "ag-grid-react";
import {
  ModuleRegistry,
  AllCommunityModule,
  themeQuartz,
  colorSchemeDarkBlue,
} from "ag-grid-community";
import type { ColDef } from "ag-grid-community";
import { formatUsd } from "@/lib/money";

// Register the community modules once — required by AG Grid v33+.
ModuleRegistry.registerModules([AllCommunityModule]);

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
    minWidth: 160,
    filter: "agTextColumnFilter",
  },
  {
    field: "counterparty",
    headerName: "Counterparty",
    flex: 1.3,
    minWidth: 120,
    filter: "agTextColumnFilter",
  },
  {
    field: "totalCents",
    headerName: "Total",
    flex: 1,
    minWidth: 100,
    valueFormatter: (p) => formatUsd(p.value),
    sort: "desc",
  },
  {
    field: "sellerShareCents",
    headerName: "Seller share",
    flex: 1,
    minWidth: 110,
    valueFormatter: (p) => formatUsd(p.value),
  },
  {
    field: "platformFeeCents",
    headerName: "Platform fee",
    flex: 1,
    minWidth: 110,
    valueFormatter: (p) => formatUsd(p.value),
  },
  {
    field: "status",
    headerName: "Status",
    flex: 0.9,
    minWidth: 95,
    filter: "agTextColumnFilter",
    cellClass: (p) =>
      p.value === "PAID"
        ? "text-emerald-300 font-medium"
        : "text-white/60",
  },
  {
    field: "createdAt",
    headerName: "Date",
    flex: 1.6,
    minWidth: 170,
    valueFormatter: (p) => new Date(p.value).toLocaleString(),
    sort: "desc",
  },
];

interface SalesGridProps {
  rows: OrderRow[];
  /** Empty-state copy + optional action, shown instead of an empty grid. */
  empty?: { title: string; body: string; action?: { href: string; label: string } };
}

export function SalesGrid({ rows, empty }: SalesGridProps) {
  if (rows.length === 0 && empty) {
    return (
      <div className="flex flex-col items-center px-6 py-12 text-center">
        <span
          aria-hidden
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-xl text-cyan-200"
        >
          ✦
        </span>
        <p className="mt-4 font-semibold text-white">{empty.title}</p>
        <p className="text-muted mt-1 max-w-sm text-sm">{empty.body}</p>
        {empty.action && (
          <Link href={empty.action.href} className="btn-primary mt-5">
            {empty.action.label}
          </Link>
        )}
      </div>
    );
  }

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
