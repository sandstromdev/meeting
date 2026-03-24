/** Deterministic JSON for hashing snapshot payloads. */
export function stableStringify(value: unknown): string {
	if (value === null || typeof value !== 'object') {
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) {
		return `[${value.map(stableStringify).join(',')}]`;
	}
	const obj = value as Record<string, unknown>;
	const keys = Object.keys(obj).toSorted();
	return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export async function checksumPayload(payload: unknown): Promise<string> {
	const bytes = new TextEncoder().encode(stableStringify(payload));
	const hash = await crypto.subtle.digest('SHA-256', bytes);
	return new Uint8Array(hash).toHex();
}
