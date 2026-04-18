/**
 * Runs `varlock load` in the current working directory (the app package when
 * invoked via `bun run env:validate`). Stdout is discarded; stderr and the
 * exit code are preserved.
 */
try {
	const result = Bun.spawnSync(['bunx', 'varlock', 'load'], {
		stdin: 'inherit',
		stdout: 'ignore',
		stderr: 'inherit',
		env: {
			PATH: process.env.PATH as string,
		},
	});

	process.exit(result.exitCode ?? 1);
} catch (e) {
	const message = e instanceof Error ? e.message : String(e);
	console.error(message);
	process.exit(1);
}
