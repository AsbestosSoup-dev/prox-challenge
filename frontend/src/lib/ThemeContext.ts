import { createContext, useContext } from "react"

export const ThemeContext = createContext<boolean>(true)
export const useIsDark = () => useContext(ThemeContext)
