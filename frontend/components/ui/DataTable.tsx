import React, { useMemo, useState } from "react";

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  align?: "left" | "right";
  className?: string;
  render?: (row: T) => React.ReactNode;
  value?: (row: T) => string | number;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  defaultSort,
  onRowClick,
  ariaLabel,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  empty?: React.ReactNode;
  defaultSort?: { key: string; dir?: "asc" | "desc" };
  onRowClick?: (row: T) => void;
  ariaLabel?: string;
}) {
  const [sortKey, setSortKey] = useState<string | null>(defaultSort?.key ?? null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(defaultSort?.dir ?? "asc");

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.value) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = col.value!(a);
      const bv = col.value!(b);
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv), undefined, { numeric: true })
        : String(bv).localeCompare(String(av), undefined, { numeric: true });
    });
    return copy;
  }, [rows, sortKey, sortDir, columns]);

  function toggleSort(col: Column<T>) {
    if (!col.sortable || !col.value) return;
    if (sortKey === col.key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col.key);
      setSortDir("asc");
    }
  }

  return (
    <div className="table-wrap">
      <table className="data-table" aria-label={ariaLabel}>
        <thead>
          <tr>
            {columns.map((col) => {
              const isSorted = sortKey === col.key;
              const sortMeta = col.sortable && col.value ? (isSorted ? (sortDir === "asc" ? "ascending" : "descending") : "none") : undefined;
              return (
                <th
                  key={col.key}
                  className={`${col.align === "right" ? "num" : ""}${col.className ? " " + col.className : ""}`}
                  aria-sort={sortMeta}
                >
                  {col.sortable && col.value ? (
                    <button type="button" className="th-sort" onClick={() => toggleSort(col)}>
                      {col.label}
                      <span className="th-sort-arrow" aria-hidden="true">{isSorted ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? "row-clickable" : undefined}
            >
              {columns.map((col) => (
                <td key={col.key} className={`${col.align === "right" ? "num" : ""}${col.className ? " " + col.className : ""}`}>
                  {col.render ? col.render(row) : (col.value ? col.value(row) : null)}
                </td>
              ))}
            </tr>
          ))}
          {sorted.length === 0 && empty !== undefined && (
            <tr>
              <td colSpan={columns.length}>{empty}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
