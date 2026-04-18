import type { AppErrorMessages } from './appError';

export const ErrorMessages: AppErrorMessages = {
	// HTTP-shaped (401 / 403 / 500), no domain payload
	bad_request: ({ args }) => `Ett eller flera argument var felaktiga: ${JSON.stringify(args)}.`,
	unauthorized: (_args) => 'Oauktoriserad.',
	forbidden: (_args) => 'Du har inte tillgång till denna sida.',
	internal_error: (_args) => 'Ett fel har inträffat, försök igen senare.',

	// Email & account
	email_exists: (_args) => 'En användare med den e-postadressen finns redan.',
	invalid_credentials: (_args) => 'Felaktig e-post eller lösenord.',
	participant_banned: (_args) => 'Du har blivit avstängd från mötet.',
	meeting_access_denied: (_args) => 'Du har inte behorighet att ansluta till det har motet.',

	// Meeting
	meeting_not_found: ({ meetingCode, meetingId }) =>
		`Mötet med ${meetingCode ? 'möteskoden' : 'id'} '${meetingCode ?? meetingId}' hittades inte.`,
	meeting_archived: (_args) => 'Mötet är arkiverat och kan inte öppnas.',
	meeting_participant_not_found: (_args) => `Du är inte deltagare i mötet.`,
	invalid_meeting_code: (_args) => 'Ogiltig möteskod.',
	meeting_code_already_exists: ({ meetingCode }) =>
		`Möteskoden '${meetingCode}' är redan i bruk. Välj en annan kod.`,

	// Agenda & speaking
	agenda_item_not_found: ({ agendaItemId }) =>
		`Agendapunkten med id '${agendaItemId}' hittades inte.`,
	cannot_delete_current_speaker: (_args) =>
		'Du kan inte ta bort den talare som håller på att tala.',
	cannot_leave_while_speaking: (_args) =>
		'Du kan inte markera dig som frånvarande medan du är aktuell talare.',
	illegal_while_absent: (_args) => 'Du kan inte göra detta när du är markerad som frånvarande.',

	// Meeting polls
	meeting_poll_not_found: ({ pollId }) => `Mötespollen med id '${pollId}' hittades inte.`,
	// User-owned polls
	user_poll_not_found: ({ pollId }) => `Omröstningen med id '${pollId}' hittades inte.`,
	user_poll_code_not_found: ({ pollCode }) => `Omröstningen med kod '${pollCode}' hittades inte.`,
	user_poll_code_already_exists: ({ pollCode }) =>
		`Koden '${pollCode}' används redan. Välj en annan kod.`,
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
	illegal_meeting_poll_action: ({ action }) => {
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
	illegal_user_poll_action: ({ action }) => {
		switch (action) {
			case 'edit_while_open':
				return 'Du kan inte ändra i en omröstning medan den är öppen.';
			case 'vote_while_closed':
				return 'Omröstningen är stängd.';
			case 'too_many_votes':
				return 'Du kan inte rösta på fler alternativ än tillåtet.';
			case 'duplicate_vote_option':
				return 'Du kan inte rösta flera gånger på samma alternativ.';
			case 'missing_session_key':
				return 'En sessionsnyckel krävs för att rösta i publik omröstning.';
			case 'auth_required':
				return 'Inloggning krävs för att rösta i denna omröstning.';
			default:
				return 'Du kan inte utföra denna handling just nu.';
		}
	},

	// Validation
	zod_error: (_iss) => 'Ett eller flera argument var felaktiga.',
} as const;
