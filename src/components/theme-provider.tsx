import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";

type Mode = "light" | "dark";
type ThemeContextType = { mode: Mode; toggle: () => void };

const ThemeContext = createContext<ThemeContextType>({
  mode: "light",
  toggle: () => {},
});

export const useTheme = () => useContext(ThemeContext);

// antd ColorModeContext 대체. .dark 클래스 토글 + localStorage 기억.
export function ThemeProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<Mode>(() => {
    const saved = localStorage.getItem("colorMode");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", mode === "dark");
    localStorage.setItem("colorMode", mode);
  }, [mode]);

  const toggle = () => setMode((m) => (m === "light" ? "dark" : "light"));

  return (
    <ThemeContext.Provider value={{ mode, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
