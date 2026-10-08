import { createContext, useContext } from "react";

type ShellContextValue = { openNotifications: () => void; unread: number };

export const ShellContext = createContext<ShellContextValue>({
  openNotifications: () => {},
  unread: 0,
});

/** Abre a gaveta de notificações do layout atual e informa quantas não foram lidas. */
export const useShell = () => useContext(ShellContext);
