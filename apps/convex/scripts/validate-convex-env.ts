import ora from 'ora';
import { parseArgs } from 'util';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { copyFile, mkdtemp, mkdir, rm } from 'node:fs/promises';

const { values } = parseArgs({
	args: Bun.argv,
	options: {
		prod: {
			type: 'boolean',
		},
		'no-output': {
			type: 'boolean',
			default: false,
		},
	},
	strict: true,
	allowPositionals: true,
});

const noOutput = values['no-output'];

async function runCommand<T extends 'inherit' | 'pipe' | Bun.BunFile>(options: {
	command: string[];
	stdout: T;
	cwd?: string;
	/** When set, the child’s environment is exactly this map (no `process.env` merge) */
	env?: Record<string, string>;
}) {
	const { command, stdout, cwd = process.cwd(), env } = options;
	spinner.text = `Running: ${command.join(' ')}`;

	try {
		const proc = Bun.spawn(command, {
			stderr: 'inherit',
			stdout,
			cwd,
			env,
		});
		const exitCode = await proc.exited;

		if (exitCode !== 0) {
			throw new Error(`'${command.join(' ')}' exited with code ${exitCode}`);
		}

		return proc;
	} catch (e) {
		console.error(`'${command.join(' ')}' failed`, e);
		throw e;
	}
}

const scriptDir = dirname(Bun.fileURLToPath(import.meta.url));
const convexRoot = join(scriptDir, '..');
const repoRoot = join(convexRoot, '..', '..');

const noop = () => {};

const spinner = noOutput
	? {
			succeed: noop,
			fail: noop,
			text: '',
		}
	: ora('Creating temporary directory…').start();

const tempDir = await mkdtemp(join(tmpdir(), 'meeting-tools-convex-env-')).catch(() => undefined);

if (!tempDir) {
	spinner.fail('Failed to create temporary directory');
	throw new Error('Failed to create temporary directory');
}

const tempConvexDir = join(tempDir, 'apps', 'convex');
const tempSharedPkgDir = join(tempDir, 'packages', 'shared');

const filePath = join(tempConvexDir, '.env');
const output = Bun.file(filePath);

try {
	spinner.succeed(`Created temporary directory at ${tempDir}`);

	spinner.text = 'Preparing temporary env validation workspace…';
	const schemaFilePath = join(repoRoot, 'apps', 'convex', '.env.schema');
	const sharedEnvFilePath = join(repoRoot, 'packages', 'shared', '.env.schema');

	await mkdir(tempConvexDir, { recursive: true });
	await mkdir(tempSharedPkgDir, { recursive: true });

	await copyFile(schemaFilePath, join(tempConvexDir, '.env.schema'));
	await copyFile(sharedEnvFilePath, join(tempSharedPkgDir, '.env.schema'));

	spinner.succeed('Prepared temporary env validation workspace');

	let command = ['bunx', 'convex', 'env', 'list'];
	if (values.prod) {
		command.push('--prod');
	}

	await runCommand({ command, stdout: output, cwd: convexRoot });

	spinner.succeed('Fetched Convex environment variables');

	const proc = await runCommand({
		command: ['bunx', 'varlock', 'load'],
		stdout: 'pipe',
		cwd: tempConvexDir,
		env: {
			PATH: process.env.PATH as string,
			IS_CONVEX: 'true',
		},
	});

	spinner.succeed('Validated Convex environment variables');

	if (!values['no-output']) {
		console.log(await proc.stdout.text());
	}
} catch {
	spinner.fail('Failed to validate Convex environment variables');
	process.exit(1);
} finally {
	try {
		await rm(tempDir, { recursive: true });
	} catch (e) {
		console.error('Failed to delete temp directory', e);
		process.exit(1);
	}
}
