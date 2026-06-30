// Layer 3 — Permanently Blocked Operations
// These cannot be approved, overridden, or unlocked by any config or user action.

export interface BlockResult {
  blocked: boolean;
  reason?: string;
  category?: BlockCategory;
}

export type BlockCategory =
  | "destructive_fs"
  | "privilege_escalation"
  | "reverse_shell"
  | "disk_wipe"
  | "fork_bomb"
  | "forced_push"
  | "credential_file_write"
  | "dangerous_redirect";

interface BlockedPattern {
  pattern: RegExp;
  reason: string;
  category: BlockCategory;
}

// Commands that are permanently blocked — no approval can override these.
const BLOCKED_COMMAND_PATTERNS: BlockedPattern[] = [
  // Destructive filesystem
  { pattern: /rm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)\s+\//, reason: "rm -rf / destroys the entire filesystem", category: "destructive_fs" },
  { pattern: /rm\s+-rf\s+~\s*$/, reason: "rm -rf ~ destroys the home directory", category: "destructive_fs" },
  { pattern: /rm\s+-rf\s+\*/, reason: "rm -rf * with wildcard in root context", category: "destructive_fs" },

  // Disk wipe / format
  { pattern: /mkfs\.[a-z0-9]+\s/, reason: "mkfs creates a filesystem, destroying existing data", category: "disk_wipe" },
  { pattern: /dd\s+.*if=\/dev\/zero/, reason: "dd with /dev/zero overwrites disk data", category: "disk_wipe" },
  { pattern: /dd\s+.*of=\/dev\/(sda|hda|nvme|disk|vda|xvda)\b/, reason: "Direct disk write via dd", category: "disk_wipe" },
  { pattern: />\s*\/dev\/(sda|hda|nvme|disk|vda|xvda)\b/, reason: "Redirect to raw disk device", category: "dangerous_redirect" },
  { pattern: /shred\s+.*\/dev\//, reason: "shred on device file", category: "disk_wipe" },
  { pattern: /wipefs\s/, reason: "wipefs destroys filesystem signatures", category: "disk_wipe" },

  // Fork bombs
  { pattern: /:\(\)\s*\{.*:\s*\|.*:\s*&.*\}/, reason: "Fork bomb detected", category: "fork_bomb" },
  { pattern: /bomb\(\)\s*\{.*bomb.*\|.*bomb/, reason: "Fork bomb variant detected", category: "fork_bomb" },

  // Privilege escalation
  { pattern: /^\s*sudo\s+(-[si]\s+)?-?[si]?\s*(su\s*-?|bash|sh|zsh|dash)\b/, reason: "sudo shell escalation", category: "privilege_escalation" },
  { pattern: /^\s*su\s*-?\s*(root|-\s*root)?\s*$/, reason: "su to root", category: "privilege_escalation" },
  { pattern: /chmod\s+[0-7]*7[0-7][0-7]\s+\/(?!home|Users|tmp|var\/tmp)/, reason: "chmod 7xx on system directory", category: "privilege_escalation" },
  { pattern: /chmod\s+777\s+\//, reason: "chmod 777 on / (world-writable root)", category: "privilege_escalation" },
  { pattern: /chown\s+.*\s+\/(?!home|Users|tmp)/, reason: "chown on system directory", category: "privilege_escalation" },

  // Reverse shells
  { pattern: /bash\s+-i\s+>&\s*\/dev\/tcp\//, reason: "Bash reverse shell via /dev/tcp", category: "reverse_shell" },
  { pattern: /nc\s+.*-e\s+\/bin\/(bash|sh|zsh)/, reason: "Netcat reverse shell", category: "reverse_shell" },
  { pattern: /ncat\s+.*--exec\s+\/bin\/(bash|sh)/, reason: "Ncat reverse shell", category: "reverse_shell" },
  { pattern: /python[23]?\s+-c\s+['"].*socket.*exec/, reason: "Python reverse shell", category: "reverse_shell" },
  { pattern: /perl\s+-e\s+['"].*socket.*exec/, reason: "Perl reverse shell", category: "reverse_shell" },

  // Force push without force-with-lease
  // Matches --force or -f but NOT --force-with-lease
  { pattern: /(?:^|\s)git\s+push\b(?![^\n]*--force-with-lease)(?=[^\n]*(?:^|\s)(?:--force|-f)(?:\s|$))/, reason: "git push --force without --force-with-lease can destroy remote history", category: "forced_push" },

  // Credential file writes
  { pattern: />\s*~?\/?\.ssh\/id_(rsa|ed25519|ecdsa|dsa)\s*$/, reason: "Overwriting SSH private key", category: "credential_file_write" },
  { pattern: />\s*~?\/?\.aws\/credentials\s*$/, reason: "Overwriting AWS credentials", category: "credential_file_write" },
  { pattern: />\s*~?\/?\.kube\/config\s*$/, reason: "Overwriting kubeconfig", category: "credential_file_write" },
];

// Paths that are absolutely blocked for any write/delete operation
const BLOCKED_PATH_PATTERNS: BlockedPattern[] = [
  { pattern: /^\/etc\//, reason: "/etc contains system configuration — writes blocked", category: "destructive_fs" },
  { pattern: /^\/sys\//, reason: "/sys is the kernel sysfs — writes dangerous", category: "destructive_fs" },
  { pattern: /^\/proc\//, reason: "/proc is the process filesystem — writes dangerous", category: "destructive_fs" },
  { pattern: /^\/root\//, reason: "/root is the root home — writes blocked", category: "privilege_escalation" },
  { pattern: /^\/boot\//, reason: "/boot contains bootloader — writes blocked", category: "destructive_fs" },
  { pattern: /^\/dev\//, reason: "/dev contains device files — writes blocked", category: "disk_wipe" },
  // Windows system dirs
  { pattern: /^[Cc]:\\Windows\\/i, reason: "Windows system directory — writes blocked", category: "destructive_fs" },
  { pattern: /^[Cc]:\\System32\\/i, reason: "Windows System32 — writes blocked", category: "destructive_fs" },
];

// SSH/credential paths blocked for all writes (not just /etc)
const BLOCKED_CREDENTIAL_WRITE_PATTERNS: BlockedPattern[] = [
  { pattern: /[/\\]\.ssh[/\\]id_(rsa|ed25519|ecdsa|dsa)$/, reason: "SSH private key file", category: "credential_file_write" },
  { pattern: /[/\\]\.ssh[/\\]authorized_keys$/, reason: "SSH authorized_keys", category: "credential_file_write" },
  { pattern: /[/\\]\.aws[/\\]credentials$/, reason: "AWS credentials file", category: "credential_file_write" },
  { pattern: /[/\\]\.gnupg[/\\]/, reason: "GPG keyring directory", category: "credential_file_write" },
];

export function isBlockedCommand(cmd: string): BlockResult {
  for (const { pattern, reason, category } of BLOCKED_COMMAND_PATTERNS) {
    if (pattern.test(cmd)) {
      return { blocked: true, reason, category };
    }
  }
  return { blocked: false };
}

export function isBlockedWritePath(path: string): BlockResult {
  const normalized = path.replace(/\\/g, "/");

  for (const { pattern, reason, category } of BLOCKED_PATH_PATTERNS) {
    if (pattern.test(normalized)) {
      return { blocked: true, reason, category };
    }
  }
  for (const { pattern, reason, category } of BLOCKED_CREDENTIAL_WRITE_PATTERNS) {
    if (pattern.test(normalized)) {
      return { blocked: true, reason, category };
    }
  }
  return { blocked: false };
}

export function isBlockedReadPath(path: string): BlockResult {
  const normalized = path.replace(/\\/g, "/");
  // Only /sys and /proc are blocked for reads (they can crash processes or expose kernel internals)
  if (/^\/sys\//.test(normalized)) return { blocked: true, reason: "/sys reads can destabilize kernel state", category: "destructive_fs" };
  if (/^\/proc\//.test(normalized)) return { blocked: true, reason: "/proc reads can expose sensitive kernel data", category: "destructive_fs" };
  return { blocked: false };
}

// Check if a shell command is a recognized safe read-only operation.
// Used by the policy engine for auto-allow classification.
export function isSafeReadOnlyCommand(cmd: string): boolean {
  const trimmed = cmd.trim();
  return SAFE_READONLY_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

const SAFE_READONLY_PREFIXES = [
  "ls ", "ls\n", "cat ", "head ", "tail ", "grep ", "find ", "echo ",
  "pwd", "whoami", "date", "uname", "df ", "du ", "wc ", "sort ",
  "git log", "git status", "git diff", "git branch", "git show",
  "git remote -v", "node --version", "npm --version", "which ",
  "type ", "file ", "stat ",
];
