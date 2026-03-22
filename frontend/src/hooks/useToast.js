import { useState, useCallback } from 'react';
export function useToast() {
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, emoji='🌟') => setToast({ message, emoji, id:Date.now() }), []);
  const hideToast = useCallback(() => setToast(null), []);
  return { toast, showToast, hideToast };
}
