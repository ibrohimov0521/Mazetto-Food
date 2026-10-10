export function customerProfileForStorage(customer) {
  const profile = { ...customer };
  delete profile.accessToken;
  delete profile.refreshToken;
  delete profile.tokenType;
  return profile;
}
