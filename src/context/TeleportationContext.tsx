import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { TeleportationRequest } from "../types/teleportation";

type TeleportationContextValue = {
  request: TeleportationRequest | null;
  requestTeleport: (request: TeleportationRequest) => void;
  clearTeleport: (id: string) => void;
};

const TeleportationContext = createContext<TeleportationContextValue | null>(
  null
);

export const TeleportationProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [request, setRequest] = useState<TeleportationRequest | null>(null);

  const requestTeleport = useCallback((next: TeleportationRequest) => {
    setRequest(next);
  }, []);

  const clearTeleport = useCallback((id: string) => {
    setRequest((current) => {
      if (current && current.id === id) {
        return null;
      }
      return current;
    });
  }, []);

  const value = useMemo(
    () => ({
      request,
      requestTeleport,
      clearTeleport,
    }),
    [request, requestTeleport, clearTeleport]
  );

  return (
    <TeleportationContext.Provider value={value}>
      {children}
    </TeleportationContext.Provider>
  );
};

export const useTeleportation = () => {
  const context = useContext(TeleportationContext);
  if (!context) {
    throw new Error(
      "useTeleportation must be used within a TeleportationProvider"
    );
  }
  return context;
};
