"use client";

import React from "react";
import { Terminal, Trash2 } from "lucide-react";

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  level: "info" | "warn" | "error" | "success";
}

interface Props {
  logs: LogEntry[];
  onClear: () => void;
}

const levelClass: Record<LogEntry["level"], string> = {
  error: "text-danger fw-semibold",
  warn: "text-warning",
  success: "text-success fw-medium",
  info: "text-body-secondary",
};

export const LogConsole: React.FC<Props> = ({ logs, onClear }) => {
  return (
    <div className="card bg-black border-secondary-subtle shadow h-100">
      <div className="card-header d-flex align-items-center justify-content-between bg-black border-secondary-subtle">
        <span className="d-flex align-items-center gap-2 fw-semibold text-body-secondary">
          <Terminal size={16} className="text-success" />
          即時診斷日誌
        </span>
        <button
          onClick={onClear}
          className="btn btn-sm btn-outline-secondary border-0"
          title="清除日誌"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* min-height: 0 overrides the flex item default of min-height: auto,
          which would otherwise refuse to shrink below content size and
          block overflow-y-auto from ever actually scrolling. */}
      <div
        className="card-body overflow-y-auto custom-scrollbar font-monospace small"
        style={{ minHeight: 0 }}
      >
        {logs.length === 0 ? (
          <div className="text-body-tertiary fst-italic text-center py-4">
            尚無事件日誌
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="d-flex align-items-start gap-2 mb-1 lh-base"
            >
              <span className="text-body-tertiary flex-shrink-0">
                [{log.timestamp}]
              </span>
              <span className={levelClass[log.level]}>{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
