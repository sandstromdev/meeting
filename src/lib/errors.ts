import type { AppErrorMessages } from '$convex/helpers/error';

export const ErrorMessages = {
	unauthorized: () => 'Oauktoriserad.',
	forbidden: () => 'Du har inte tillgång till denna sida.',
	internal_error: () => 'Ett fel har inträffat, försök igen senare.',

	agenda_item_not_found: ({ agendaItemId }) =>
		`Agendapunkten med id '${agendaItemId}' hittades inte.`,

	illegal_poll_action: ({ action }) => {
		switch (action) {
			case 'edit_while_open':
				return 'Du kan inte ändra i en poll medan den är öppen.';
			case 'vote_while_closed':
				return 'Omröstningen är stängd.';
			case 'already_voted':
				return 'Du har redan röstat i denna omröstning.';
			case 'agenda_has_poll':
				return 'Denna agendapunkt har redan en omröstning.';
			default:
				return 'Du kan inte ändra i pollen just nu.';
		}
	},
	illegal_while_absent: () => 'Du kan inte göra detta när du är markerad som frånvarande.',
	cannot_delete_current_speaker: () => 'Du kan inte ta bort den talare som håller på att tala.',
	cannot_leave_while_speaking: () =>
		'Du kan inte markera dig som frånvarande medan du är aktuell talare.',
	invalid_poll_option: ({ option }) => `'${option}' är inte ett möjligt alternativ i pollen.`,
	poll_not_found: ({ pollId }) => `Pollen med id '${pollId}' hittades inte.`,
	meeting_not_found: ({ meetingCode, meetingId }) =>
		`Mötet med ${meetingCode ? 'möteskoden' : 'id'} '${meetingCode ?? meetingId}' hittades inte.`,
	meeting_participant_not_found: ({ meetingId: _ }) => `Du är inte deltagare i mötet.`,
	email_exists: () => 'En användare med den e-postadressen finns redan.',
	invalid_credentials: () => 'Felaktig e-post eller lösenord.',
	zod_error: (_iss) => 'Ett eller flera argument var felaktiga.',
} satisfies AppErrorMessages;
