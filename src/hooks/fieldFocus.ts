import { createContext, useContext, type ComponentRef, type RefObject } from 'react';
import type { View } from 'react-native';

export type FieldRef = RefObject<ComponentRef<typeof View> | null>;

/**
 * Provided by Screen so text fields can ask it to scroll them above the
 * keyboard when they gain focus.
 */
export const FieldFocusContext = createContext<((field: FieldRef) => void) | null>(null);

export function useFieldFocus() {
  return useContext(FieldFocusContext);
}
