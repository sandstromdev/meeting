import { MeetingCode } from '$lib/validation';
import { z } from 'zod';

export const ConnectFormSchema = z.object({
	meetingCode: MeetingCode,
	name: z.string().nonempty()
});
