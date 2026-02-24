import type { AppErrorMessages } from './convex/error';

export const ErrorMessages = {
	unauthorized: () => 'Oauktoriserad.',
	forbidden: () => 'Du har inte tillgång till denna sida.',
	internal_error: () => 'Ett fel har inträffat, försök igen senare.',

	illegal_poll_action: ({ action }) =>
		action === 'edit_while_open'
			? 'Du kan inte ändra i en poll medan den är öppen.'
			: 'Du kan inte ändra i pollen just nu.',
	illegal_while_absent: () => 'Du kan inte göra detta när du är markerad som frånvarande.',
	invalid_poll_option: ({ option }) => `'${option}' är inte ett möjligt alternativ i pollen.`,
	poll_not_found: ({ pollId }) => `Pollen med id '${pollId}' hittades inte.`,
	meeting_not_found: ({ meetingCode, meetingId }) =>
		`Mötet med ${meetingCode ? 'möteskoden' : 'id'} '${meetingCode ?? meetingId}' hittades inte.`
} satisfies AppErrorMessages;
