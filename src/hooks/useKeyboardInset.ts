import { useEffect, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { Keyboard, Platform, type ScrollView } from 'react-native';

type ScrollRef = RefObject<ComponentRef<typeof ScrollView> | null>;

type Options = {
  /** Runs once the keyboard is up and the inset has been measured. */
  onShow?: (keyboardTop: number) => void;
};

/**
 * How much of a scroll view the software keyboard covers, plus where the
 * keyboard's top edge is on screen.
 *
 * The scroll view is measured against the keyboard every time it appears, so
 * the numbers are right whether Android resizes the window (adjustResize) or
 * leaves it under the keyboard (edge-to-edge), and they already account for
 * safe areas, headers and the tab bar instead of hard-coded offsets.
 */
export function useKeyboardInset(scrollRef: ScrollRef, { onShow }: Options = {}) {
  const [inset, setInset] = useState(0);
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);
  const topRef = useRef<number | null>(null);
  const showCallback = useRef(onShow);

  useEffect(() => {
    showCallback.current = onShow;
  }, [onShow]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const measure = () => {
      const node = scrollRef.current;
      const top = topRef.current;
      if (!node || top == null) {
        setInset(0);
        return;
      }
      node.measureInWindow((_x, y, _width, height) => {
        setInset(Math.max(0, Math.round(y + height - top)));
      });
    };

    const ios = Platform.OS === 'ios';
    const shown = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (event) => {
      const top = event.endCoordinates.screenY;
      topRef.current = top;
      setKeyboardTop(top);
      measure();
      // Android can resize the window after the event, so measure again once
      // the keyboard has finished animating and the layout has settled.
      clearTimeout(timer);
      timer = setTimeout(() => {
        measure();
        showCallback.current?.(top);
      }, 250);
    });
    const hidden = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      topRef.current = null;
      setKeyboardTop(null);
      clearTimeout(timer);
      setInset(0);
    });

    return () => {
      clearTimeout(timer);
      shown.remove();
      hidden.remove();
    };
  }, [scrollRef]);

  return { inset, keyboardTop };
}
