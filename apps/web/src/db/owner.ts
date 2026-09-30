import { LOCAL_USER } from "./db";

/**
 * Owner stamped on every new row by the write path. Before the first login it's "local";
 * after login it's the account id (set at boot and on login).
 */
let owner = LOCAL_USER;

export const getOwner = (): string => owner;
export function setOwner(userId: string | null): void {
  owner = userId ?? LOCAL_USER;
}
