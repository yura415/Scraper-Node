import { createCollection } from 'measured-core';
import { name as projectName } from '../project';
import { hrtimeToSec } from 'bootstrap/common/hrtime';

export const FAILED_JOBS = 'FAILED_JOBS';
export const SUCCEEDED_JOBS = 'SUCCEEDED_JOBS';
export const JOB_TIME = 'JOB_TIME';
export const SCHEDULED_JOBS = 'SCHEDULED_JOBS';
export const collection = createCollection(projectName);

export function jobStats(job) {
	const time = process.hrtime();

	job.once('failed', err => {
		jobEnded(time, job);
		jobFailed(job, err);
	});
	job.once('succeeded', () => {
		jobEnded(time, job);
		jobSucceeded(job);
	});

	jobStarted(job);
}

// eslint-disable-next-line no-unused-vars
export function jobEnded(beginningTime, job) {
	const timeSeconds = hrtimeToSec(process.hrtime(beginningTime));
	collection.histogram(JOB_TIME).update(timeSeconds);
}

// eslint-disable-next-line no-unused-vars
export function jobFailed(job, err) {
	collection.counter(FAILED_JOBS).inc();
}

// eslint-disable-next-line no-unused-vars
export function jobSucceeded(job) {
	collection.counter(SUCCEEDED_JOBS).inc();
}

// eslint-disable-next-line no-unused-vars
export function jobStarted(job) {
	collection.counter(SCHEDULED_JOBS).inc();
}