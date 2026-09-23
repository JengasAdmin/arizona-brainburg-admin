"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { X, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "error" | "info";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (input: { title: string; description?: string; variant?: ToastVariant }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const icons: Record<ToastVariant, React.ReactNode> = {
  default: <Info className="h-4 w-4 text-neutral-400" />,
  success: <CheckCircle2 className="h-4 w-4 text-ok" />,
  error: <AlertTriangle className="h-4 w-4 text-danger" />,
  info: <Info className="h-4 w-4 text-info" />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const toast = useCallback<ToastContextValue["toast"]>(({ title, description, variant }) => {
    const id = ++idRef.current;
    setItems((prev) => [...prev, { id, title, description, variant: variant ?? "default" }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 5200);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2"
        role="region"
        aria-label="Уведомления"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto animate-fade rounded-lg border border-line bg-card p-3 shadow-popover",
            )}
          >
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5">{icons[item.variant]}</div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-white">{item.title}</div>
                {item.description ? (
                  <div className="mt-0.5 break-words text-xs text-neutral-400">{item.description}</div>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Скрыть уведомление"
                onClick={() => setItems((prev) => prev.filter((t) => t.id !== item.id))}
                className="rounded p-1 text-neutral-500 transition-colors hover:bg-raised hover:text-neutral-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
