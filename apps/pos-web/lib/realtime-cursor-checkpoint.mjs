export async function refreshBeforeCursorCheckpoint(
  refresh,
  persist,
  canCheckpoint = () => true,
) {
  if ((await refresh()) === false || !canCheckpoint()) {
    return false;
  }

  await persist();
  return true;
}
