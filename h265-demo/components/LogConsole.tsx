'use client';

import React from 'react';
import { Terminal, Trash2 } from 'lucide-react';

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  level: 'info' | 'warn' | 'error' | 'success';
}

interface Props {
  logs: LogEntry[];
  onClear: () => void;
}

export const LogConsole: React.FC<Props> = ({ logs, onClear }) => {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-xs shadow-2xl flex flex-col h-64">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 text-slate-400">
        <div className="flex items-center gap-2 font-semibold text-slate-300">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span>解碼器與 RTSPtoWeb 實時診斷日誌</span>
        </div>
        <button
          onClick={onClear}
          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition"
          title="清除日誌"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
        {logs.length === 0 ? (
          <div className="text-slate-600 italic py-4 text-center">尚無事件日誌</div>
        ) : (
          logs.map(log => (
            <div key={log.id} className="flex items-start gap-2 text-slate-300 leading-relaxed">
              <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
              <span
                className={
                  log.level === 'error'
                    ? 'text-rose-400 font-semibold'
                    : log.level === 'warn'
                    ? 'text-amber-400'
                    : log.level === 'success'
                    ? 'text-emerald-400 font-medium'
                    : 'text-slate-300'
                }
              >
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
