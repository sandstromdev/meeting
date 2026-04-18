import ora from 'ora';
import { parseArgs } from 'util';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';

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

const repoRoot = join(dirname(Bun.fileURLToPath(import.meta.url)), '..');
const remoteSchemaPath = join(repoRoot, '.env.remote.schema');
const commonSchemaSource = join(repoRoot, '..', '..', 'packages', 'common', '.env.schema');

function subprocessEnv(overrides: Record<string, string> = {}): Record<string, string> {
	const env: Record<string, string> = { ...overrides };
	for (const key of ['PATH', 'HOME', 'TMPDIR', 'USER'] as const) {
		const v = process.env[key];
		if (v !== undefined && env[key] === undefined) {
			env[key] = v;
		}
	}
	return env;
}

const noop = () => {};

const spinner = noOutput
	? {
			succeed: noop,
			fail: noop,
			text: '',
		}
	: ora('Creating temporary directory…').start();

let tempRoot: string;
try {
	tempRoot = await mkdtemp(join(tmpdir(), 'meeting-tools-convex-env-'));
} catch {
	spinner.fail('Failed to create temporary directory');
	process.exit(1);
}

async function runCommand<T extends 'inherit' | 'pipe' | Bun.BunFile>(options: {
	command: string[];
	stdout: T;
	cwd?: string;
	env?: Record<string, string>;
}) {
	const { command, stdout, cwd = process.cwd(), env = subprocessEnv() } = options;
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

try {
	const workConvexDir = join(tempRoot, 'apps', 'convex');
	const envFilePath = join(workConvexDir, '.env');

	try {
		spinner.succeed(`Created temporary directory at ${tempRoot}`);

		spinner.text = 'Staging schema mirror…';
		await mkdir(join(tempRoot, 'packages', 'common'), { recursive: true });
		await mkdir(workConvexDir, { recursive: true });
		await copyFile(commonSchemaSource, join(tempRoot, 'packages', 'common', '.env.schema'));
		await copyFile(remoteSchemaPath, join(workConvexDir, '.env.schema'));
		spinner.succeed('Staged schema mirror');

		spinner.text = 'Fetching Convex environment variables…';
		let listCommand = ['bunx', 'convex', 'env', 'list'];
		if (values.prod) {
			listCommand.push('--prod');
		}
		await runCommand({
			command: listCommand,
			stdout: Bun.file(envFilePath),
			cwd: repoRoot,
		});
		spinner.succeed('Fetched Convex environment variables');

		spinner.text = 'Validating with Varlock…';

		const proc = await runCommand({
			command: ['bunx', 'varlock', 'load'],
			stdout: 'pipe',
			cwd: workConvexDir,
			env: subprocessEnv({ IS_CONVEX: 'true' }),
		});
		const loadOutput = await proc.stdout.text();
		spinner.succeed('Validated Convex environment variables');

		if (!values['no-output']) {
			console.log(loadOutput);
		}
	} catch (e) {
		spinner.fail('Failed to validate Convex environment variables');
		throw e;
	} finally {
		try {
			await rm(tempRoot, { recursive: true });
		} catch (e) {
			console.error('Failed to delete temp directory', e);
			process.exit(1);
		}
	}
} catch {
	process.exit(1);
}
