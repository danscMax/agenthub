// One-click launch-flag presets, shared by the launch dialog and the panel's default-args bar.
// Keyed by tool; the values are exact CLI flags toggled into the args string.
export const ARG_PRESETS: Record<string, string[]> = {
  claude: ['--dangerously-skip-permissions', '--effort max', '--effort high', '--continue', '--resume'],
  opencode: ['--continue']
};

// Toggle a flag in a space-separated args string (add if absent, strip if present).
export function toggleFlag(args: string, flag: string): string {
  return args.includes(flag)
    ? args.replace(flag, '').replace(/\s+/g, ' ').trim()
    : `${args.trim()} ${flag}`.trim();
}
