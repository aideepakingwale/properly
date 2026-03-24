/**
 * @file        useToast.js
 * @description Toast notification hook — shows temporary feedback messages with emoji and auto-dismiss
 * @module      Hooks
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 */

import { useState, useCallback } from 'react';
export function useToast() {
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, emoji='🌟') => setToast({ message, emoji, id:Date.now() }), []);
  const hideToast = useCallback(() => setToast(null), []);
  return { toast, showToast, hideToast };
}
