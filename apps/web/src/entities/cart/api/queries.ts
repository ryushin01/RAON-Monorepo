import "server-only";

import type { Cart, LibraryItem, Wallet } from "@raon/contracts";
import { apiFetch } from "@/shared/api/index.server";

export const getCart = (token: string) => apiFetch<Cart>("/cart", { token });
export const getWallet = (token: string) => apiFetch<Wallet>("/wallet", { token });
export const getLibrary = (token: string) => apiFetch<LibraryItem[]>("/library", { token });
