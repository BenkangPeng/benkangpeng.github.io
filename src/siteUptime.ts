import { SITE_ONLINE_AT } from './consts';

const startedAt = new Date(SITE_ONLINE_AT).getTime();

function pad(value: number) {
	return String(value).padStart(2, '0');
}

export function formatSiteUptime(now = new Date()) {
	const totalSeconds = Math.max(0, Math.floor((now.getTime() - startedAt) / 1000));
	const days = Math.floor(totalSeconds / 86_400);
	const hours = Math.floor((totalSeconds % 86_400) / 3_600);
	const minutes = Math.floor((totalSeconds % 3_600) / 60);
	const seconds = totalSeconds % 60;

	return {
		days: `Online for ${days}  days `,
		clock: `${pad(hours)} hours ${pad(minutes)} minutes and ${pad(seconds)} seconds 🎉`,
	};
}
