import { useEffect, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { Keyboard, Platform, type ScrollView } from 'react-native';

type ScrollRef = RefObject<ComponentRef<typeof ScrollView> | null>;

type Options = {
  /** Runs once the keyboard is up and the inset has been measured. */
  onShow?: () => void;
};

/**
 * The part of a scroll view hidden behind the software keyboard, in pixels.
 *
 * The scroll view is measured against the keyboard's top edge every time the
 * keyboard appears, so the number is right whether Android resizes the window
 * (adjustResize) or leaves it under the keyboard (edge-to-edge), and it already
 * accounts for safe areas, headers and the tab bar instead of hard-coded
 * offsets. Add it to the scroll content's bottom padding; combined with
 * `scrollToEnd`/`scrollTo` the focused field can then sit above the keyboard.
 */
export function useKeyboardInset(scrollRef: ScrollRef, { onShow }: Options = {}) {
  const [inset, setInset] = useState(0);
  const keyboardTop = useRef<number | null>(null);
  const showCallback = useRef(onShow);

  useEffect(() => {
    showCallback.current = onShow;
  }, [onShow]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const measure = () => {
      const node = scrollRef.current;
      const top = keyboardTop.current;
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
      keyboardTop.current = event.endCoordinates.screenY;
      measure();
      // Android can resize the window after the event, so measure again once
      // the keyboard has finished animating and the layout has settled.
      clearTimeout(timer);
      timer = setTimeout(() => {
        measure();
        showCallback.current?.();
      }, 250);
    });
    const hidden = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      keyboardTop.current = null;
      clearTimeout(timer);
      setInset(0);
    });

    return () => {
      clearTimeout(timer);
      shown.remove();
      hidden.remove();
    };
  }, [scrollRef]);

  return inset;
}
