import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface ShellUI {
  leftOpen: boolean;
  rightOpen: boolean;
  toggleLeft: () => void;
  toggleRight: () => void;
  isNarrow: boolean;
}

const ShellContext = createContext<ShellUI | null>(null);

export function useShellUI() {
  const value = useContext(ShellContext);
  if (!value) throw new Error("useShellUI outside provider");
  return value;
}

function applyViewportBreakpoints(
  width: number,
  setIsNarrow: (value: boolean) => void,
  setLeftOpen: (value: boolean) => void,
  setRightOpen: (value: boolean) => void,
) {
  const narrow = width < 900;
  const tight = width < 1200;
  setIsNarrow(narrow);
  if (narrow) {
    setLeftOpen(false);
    setRightOpen(false);
    return;
  }
  if (tight) setRightOpen(false);
}

export function ShellUIProvider({ children }: { children: ReactNode }) {
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    function update() {
      applyViewportBreakpoints(window.innerWidth, setIsNarrow, setLeftOpen, setRightOpen);
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const value: ShellUI = {
    leftOpen,
    rightOpen,
    toggleLeft: () => setLeftOpen((open) => !open),
    toggleRight: () => setRightOpen((open) => !open),
    isNarrow,
  };

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}
