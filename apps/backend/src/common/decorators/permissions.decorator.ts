import { SetMetadata } from "@nestjs/common";

export const PERMISSIONS_KEY = "permissions";
export const ANY_PERMISSIONS_KEY = "permissions:any";

export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const PermissionsAny = (...permissions: string[]) =>
  SetMetadata(ANY_PERMISSIONS_KEY, permissions);