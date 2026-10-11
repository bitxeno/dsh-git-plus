/** A repository-relative path is safe when it stays inside the work tree. */
export declare function isSafePath(path: string): boolean;
/**
 * A ref (branch / tag / commit-ish) is safe as a bare argv element: no leading
 * `-` (would be parsed as a git option — the `--output=` file-write vector),
 * no whitespace/control chars, no glob or rev-range metacharacters.
 */
export declare function isSafeRev(input: string): boolean;
/** A branch name for `git checkout`: the ref rules plus no leading slash. */
export declare function isSafeBranchName(name: string): boolean;
/**
 * A remote name for `git remote rename` / `set-url`: ref-safe, and no `/`
 * (it becomes `refs/remotes/<name>/…`, so a slash would nest tracking refs).
 */
export declare function isSafeRemoteName(name: string): boolean;
/**
 * A remote URL for `git remote set-url` / `git ls-remote`: a trimmed,
 * non-empty single line that cannot be parsed as a git option. Colons,
 * `@` and `/` are legitimate URL material, so only whitespace/control
 * characters and a leading `-` are rejected.
 */
export declare function isSafeRemoteUrl(url: string): boolean;
export declare function isSafeIgnorePattern(pattern: string): boolean;
