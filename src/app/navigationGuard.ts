export function canLeaveWorkspace(dirty: boolean, confirm: (message: string) => boolean) {
  return !dirty || confirm('Leave without saving your changes?');
}
