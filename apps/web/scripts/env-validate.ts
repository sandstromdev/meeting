import { parseArgs } from 'util';

const { values } = parseArgs({
	args: Bun.argv,
	options: {
		'no-output': {
			type: 'boolean',
			default: false,
		},
	},
	strict: true,
	allowPositionals: true,
});

const noOutput = values['no-output'];

const proc = Bun.spawn(['bunx', 'varlock', 'load', '--path', '.'], {
	stdout: noOutput ? 'ignore' : 'inherit',
	stderr: 'inherit',
});

process.exit(await proc.exited);
