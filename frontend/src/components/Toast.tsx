import { X } from "lucide-react";
import { createContext, useContext, useState, type ReactNode } from "react";

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  push: (kind: ToastKind, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = (kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-100 flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start justify-between gap-3 rounded-md border px-3.5 py-2.5 text-sm shadow-md ${
              t.kind === "success"
                ? "border-green-200 bg-green-50 text-green-800"
                : t.kind === "error"
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-gray-200 bg-white text-gray-800"
            }`}
          >
            <span>{t.message}</span>
            <button
              type="button"
              aria-label="Dismiss"
              className="shrink-0 text-gray-400 hover:text-gray-600"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
