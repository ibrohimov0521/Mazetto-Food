import { isIP } from "node:net";
import { domainToASCII } from "node:url";
import { BadRequestException } from "@nestjs/common";

export function normalizeTenantHostname(input: string): string {
  const value = input.trim().replace(/\.$/, "");
  const hostname = domainToASCII(value).toLowerCase();
  const labels = hostname.split(".");
  if (
    !hostname || hostname.length > 230 || isIP(hostname) || labels.length < 2 ||
    labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
  ) {
    throw new BadRequestException("Ommaviy va yaroqli domen nomini kiriting.");
  }
  return hostname;
}
