/**
 * GitHub commit avatars via the local `gh` CLI (uses its own credential
 * store — the token never passes through our code). Covers private repos
 * where the anonymous API returns 404. Anything unresolved (no `gh`, not
 * logged in, rate-limited, offline) yields an empty list and callers fall
 * back to the client fetch + rule-based avatars.
 */
export interface RepoAvatar {
    readonly sha: string;
    readonly url: string;
}
/** Owner/repo names as they appear in a URL path segment. */
export declare function isGhPathName(name: string): boolean;
/** Pull `{sha, url}` pairs out of a `gh api .../commits` JSON payload. */
export declare function extractRepoAvatars(payload: unknown): RepoAvatar[];
export declare function getCachedAvatars(owner: string, repo: string): readonly RepoAvatar[] | null;
export declare function setCachedAvatars(owner: string, repo: string, avatars: readonly RepoAvatar[]): void;
