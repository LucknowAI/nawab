"use client";

import { ReactNode } from "react";
import { useBackendStatus } from "../context/BackendStatusContext";
import DowntimePage from "./DowntimePage";

export function BackendStatusGate({ children }: { children: ReactNode }) {
  const { down } = useBackendStatus();
  return down ? <DowntimePage /> : <>{children}</>;
}
