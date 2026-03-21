import { type AppErrorMessages } from '$convex/helpers/error';

export const ErrorMessages = {
	// HTTP-shaped (401 / 403 / 500), no domain payload
	bad_request: ({ args }) => `Ett eller flera argument var felaktiga: ${JSON.stringify(args)}.`,
	unauthorized: () => 'Oauktoriserad.',
	forbidden: () => 'Du har inte tillgång till denna sida.',
	internal_error: () => 'Ett fel har inträffat, försök igen senare.',

	// Email & account
	email_exists: () => 'En användare med den e-postadressen finns redan.',
	invalid_credentials: () => 'Felaktig e-post eller lösenord.',
	participant_banned: () => 'Du har blivit avstängd från mötet.',

	// Meeting
	meeting_not_found: ({ meetingCode, meetingId }) =>
		`Mötet med ${meetingCode ? 'möteskoden' : 'id'} '${meetingCode ?? meetingId}' hittades inte.`,
	meeting_participant_not_found: ({ meetingId: _ }) => `Du är inte deltagare i mötet.`,
	invalid_meeting_code: () => 'Ogiltig möteskod.',
	meeting_code_already_exists: ({ meetingCode }) =>
		`Möteskoden '${meetingCode}' är redan i bruk. Välj en annan kod.`,

	// Agenda & speaking
	agenda_item_not_found: ({ agendaItemId }) =>
		`Agendapunkten med id '${agendaItemId}' hittades inte.`,
	cannot_delete_current_speaker: () => 'Du kan inte ta bort den talare som håller på att tala.',
	cannot_leave_while_speaking: () =>
		'Du kan inte markera dig som frånvarande medan du är aktuell talare.',
	illegal_while_absent: () => 'Du kan inte göra detta när du är markerad som frånvarande.',

	// Polls
	poll_not_found: ({ pollId }) => `Pollen med id '${pollId}' hittades inte.`,
	invalid_poll_option: ({ option }) => `'${option}' är inte ett möjligt alternativ i pollen.`,
	invalid_poll_vote_limit: ({ maxVotesPerVoter, optionsCount }) =>
		`Maxröster per deltagare (${maxVotesPerVoter}) måste vara mellan 1 och antal alternativ (${optionsCount}).`,
	invalid_poll_type_config: (args) => {
		if ('value' in args && 'optionsCount' in args) {
			return `Antal vinnare (${args.value}) måste vara mellan 1 och antal alternativ (${args.optionsCount}).`;
		}
		return 'Enkel-vinnare omröstning kräver att en majoritetsregel väljs.';
	},
	invalid_poll_draft: (_args) => 'Poll-utkastet innehåller ogiltiga värden.',
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
			case 'too_many_votes':
				return 'Du kan inte rösta på fler alternativ än tillåtet i denna omröstning.';
			case 'duplicate_vote_option':
				return 'Du kan inte rösta flera gånger på samma alternativ.';
			default:
				return 'Du kan inte ändra i pollen just nu.';
		}
	},

	// Validation
	zod_error: (_iss) => 'Ett eller flera argument var felaktiga.',
} satisfies AppErrorMessages;
