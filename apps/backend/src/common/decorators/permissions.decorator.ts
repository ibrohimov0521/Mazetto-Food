import { SetMetadata } from "@nestjs/common";

export const PERMISSIONS_KEY = "permissions";\nexport const ANY_PERMISSIONS_KEY = "permissions:any";

export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);\n\nexport const PermissionsAny = (...permissions: string[]) =>\n  SetMetadata(ANY_PERMISSIONS_KEY, permissions);
