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
        ? "text-emerald-700 font-medium"
        : "text-slate-600",
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
    <div className="h-80 w-full">
      <AgGridReact<OrderRow>
        theme={themeQuartz}
        rowData={rows}
        columnDefs={columnDefs}
        defaultColDef={{ sortable: true, resizable: true }}
        pagination
        paginationPageSize={8}
      />
    </div>
  );
}
