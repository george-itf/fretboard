import { useState, useEffect, useCallback, useRef, type FC } from 'react';
import { cn } from '@/lib/utils';

export interface ToastMessage {
  text: string;
  type: 'good' | 'bad';
  id: number;
}

interface ToastProps {
  message: ToastMessage | null;
}

const Toast: FC<ToastProps> = ({ message }) => {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<ToastMessage | null>(null);

  useEffect(() => {
    if (message) {
      setCurrent(message);
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 1100);
      return () => clearTimeout(timer);
    }
  }, [message]);

  if (!current) return null;

  return (
    <div
      className={cn(
        "fixed bottom-8 left-1/2 z-50 pointer-events-none",
        "px-5 py-2.5 font-mono text-[13px] font-semibold tracking-wide",
        "transition-all duration-300 ease-out",
        visible
          ? "opacity-100 -translate-x-1/2 translate-y-0"
          : "opacity-0 -translate-x-1/2 translate-y-4",
      )}
      style={{
        borderRadius: 10,
        backdropFilter: 'blur(8px)',
        ...(current.type === 'good'
          ? {
              background: 'hsla(150, 40%, 22%, 0.85)',
              color: 'hsl(150, 25%, 80%)',
              border: '1px solid hsla(150, 30%, 35%, 0.4)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            }
          : {
              background: 'hsla(0, 45%, 25%, 0.85)',
              color: 'hsl(0, 25%, 82%)',
              border: '1px solid hsla(0, 35%, 35%, 0.4)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            }
        ),
      }}
    >
      {current.text}
    </div>
  );
};

export function useToast() {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const idRef = useRef(0);

  const showToast = useCallback((text: string, type: 'good' | 'bad') => {
    idRef.current += 1;
    setToast({ text, type, id: idRef.current });
  }, []);

  return { toast, showToast };
}

export default Toast;
