"use client";

import { useRef, useState, type FocusEventHandler, type PointerEventHandler } from "react";

interface PressFeedbackProps<T extends HTMLElement> {
  onPointerDown: PointerEventHandler<T>;
  onPointerUp: PointerEventHandler<T>;
  onPointerCancel: PointerEventHandler<T>;
  onPointerLeave: PointerEventHandler<T>;
  onBlur: FocusEventHandler<T>;
}

interface PressFeedback<T extends HTMLElement> {
  pressed: boolean;
  pressProps: PressFeedbackProps<T>;
}

export function usePressFeedback<T extends HTMLElement = HTMLButtonElement>(
  disabled = false,
): PressFeedback<T> {
  const [pressed, setPressed] = useState(false);
  const pointerIsDown = useRef(false);

  function release() {
    pointerIsDown.current = false;
    setPressed(false);
  }

  return {
    pressed: disabled ? false : pressed,
    pressProps: {
      onPointerDown: () => {
        if (disabled) return;
        pointerIsDown.current = true;
        setPressed(true);
      },
      onPointerUp: release,
      onPointerCancel: release,
      onPointerLeave: () => {
        if (pointerIsDown.current) release();
      },
      onBlur: release,
    },
  };
}
