const { promisify } = require('util');
const path = require('path');
const exec = promisify(require('child_process').exec);
const access = promisify(require('fs').access);

const untildify = require('untildify');

const GIT_ROOT_CMD = 'git rev-parse --show-toplevel';
const HG_ROOT_CMD = 'hg root';

const MASTER_REGEX = /(\/?([a-z.A-Z0-9\-_]+\/)+[+@a-zA-Z0-9\-_+.]+\.[a-zA-Z0-9]{1,10})[:-]{0,1}(\d+)?/;
const MASTER_REGEX_MORE_EXTENSIONS = /(\/?([a-z.A-Z0-9\-_]+\/)+[+@a-zA-Z0-9\-_+.]+\.[a-zA-Z0-9-~]{1,30})[:-]{0,1}(\d+)?/;
const HOMEDIR_REGEX = /(~\/([a-z.A-Z0-9\-_]+\/)+[@a-zA-Z0-9\-_+.]+\.[a-zA-Z0-9]{1,10})[:-]{0,1}(\d+)?/;
const OTHER_BGS_RESULT_REGEX = /(\/?([a-z.A-Z0-9\-_]+\/)+[a-zA-Z0-9_.]{3,})[:-]{0,1}(\d+)/;
const ENTIRE_TRIMMED_LINE_IF_NOT_WHITESPACE = /(\S.*\S|\S)/;
const JUST_FILE = /([@%+a-z.A-Z0-9\-_]+\.[a-zA-Z]{1,10})(\s|$|:)+/;
const JUST_FILE_WITH_SPACES = /([a-zA-Z][%@+a-z. A-Z0-9\-_]+\.[a-zA-Z]{1,10})(\s|$|:)+/;
const FILE_NO_PERIODS = /(((\/?([a-z.A-Z0-9\-_]+\/))?\.[a-zA-Z0-9\-_]{3,}[a-zA-Z0-9\-_\/]*)|([a-z.A-Z0-9\-_\/]{1,}\/[a-zA-Z0-9\-_]{1,})|([A-Z][a-zA-Z]{2,}file))(\s|$|:)+/;
const MASTER_REGEX_WITH_SPACES_AND_WEIRD_FILES = /((?:\.?\/)?(([a-z.A-Z0-9\-_]|\s[a-zA-Z0-9\-_])+\/)+((\/?([a-z.A-Z0-9\-_]+\/))?\.[a-zA-Z0-9\-_]{3,}[a-zA-Z0-9\-_\/]*)|([a-z.A-Z0-9\-_\/]{1,}\/[a-zA-Z0-9\-_]{1,})|([A-Z][a-zA-Z]{2,}file))/;
const MASTER_REGEX_WITH_SPACES = /((?:\.?\/)?(([a-z.A-Z0-9\-_]|\s[a-zA-Z0-9\-_])+\/)+([\(\),@a-zA-Z0-9\-_+.]|\s[,\(\)@a-zA-Z0-9\-_+.])+\.[a-zA-Z0-9-]{1,30})[:-]{0,1}(\d+)?/;

const REGEX_WATERFALL = [
	{
		regex: HOMEDIR_REGEX
	},
	{
		regex: MASTER_REGEX,
		preferred: OTHER_BGS_RESULT_REGEX
	},
	{
		regex: OTHER_BGS_RESULT_REGEX
	},
	{
		regex: MASTER_REGEX_MORE_EXTENSIONS,
		validateFileExists: 1
	},
	{
		regex: MASTER_REGEX_WITH_SPACES,
		validateFileExists: 1
	},
	{
		regex: MASTER_REGEX_WITH_SPACES_AND_WEIRD_FILES,
		validateFileExists: 1
	},
	{
		regex: JUST_FILE
	},
	{
		regex: JUST_FILE_WITH_SPACES,
		validateFileExists: 1
	},
	{
		regex: FILE_NO_PERIODS
	},
	{
		regex: ENTIRE_TRIMMED_LINE_IF_NOT_WHITESPACE,
		fallback: 1
	}
];

const getMatch = matches => (matches && matches.length > 1 ? matches[1] : null);

const getRootPath = () =>
	exec(GIT_ROOT_CMD)
		.catch(() => exec(HG_ROOT_CMD))
		.catch(() => ({ stdout: './' }))
		.then(({ stdout }) => stdout);

const prependDir = file => {
	const splitUp = file.split(path.sep);
	const [firstPart] = splitUp;
	const firstChars = file.substr(0, 2);

	return getRootPath().then(rootPath => {
		const prependPath = path.join(rootPath.trim(), '/');
		if (
			file.length < 2 ||
			file[0] === '/' ||
			firstChars === './' ||
			file.substr(0, 3) === '../' ||
			file.substr(0, 4) === '.../'
		)
			return file;
		if (firstChars === '~/') return untildify(file);
		if (firstPart === 'home') return path.join('/', file);
		if (firstPart === 'www') return untildify(path.join('~/', file));
		if (file.indexOf('/') === -1) return path.join('./', file);
		if (firstChars === 'a/' || firstChars === 'b/')
			return path.join(prependPath, file.substr(2));
		return path.join(prependPath, file);
	});
};

const matcher = ({ line, validateFileExists, fallback = true }) =>
	REGEX_WATERFALL.reduce((acc, config) => {
		if (
			(config.fallback && !fallback) ||
			(config.validateFileExists && !validateFileExists) ||
			!config.regex.test(line)
		)
			return acc;

		const add = match => acc.concat(getMatch(match));
		const matches = config.regex.exec(line);

		if (!config.preferred || !config.preferred.test(line)) return add(matches);

		const preferredMatches = config.preferred.exec(line);

		if (preferredMatches.index < matches.index)
			return acc.concat(getMatch(preferredMatches));

		return add(matches);
	}, []).filter(a => a);

function extractPath(
	line,
	{
		validateFileExists = true,
		resolveWithFallback = true
	} = {}
) {
	if (typeof line !== 'string') {
		return Promise.reject(new TypeError('ERR_INVALID_ARG_TYPE'));
	}

	if (!validateFileExists) {
		return Promise.resolve(
			matcher({
				line,
				fallback: resolveWithFallback
			})[0]
		);
	}

	return new Promise((resolve, reject) => {
		const results = matcher({
			line,
			validateFileExists,
			fallback: resolveWithFallback
		});
		const testNextFile = i => {
			const file = results[i];
			if (!file) return resolve();

			prependDir(file)
				.then(access)
				.then(() => {
					resolve(file);
				})
				.catch(() => (file.substr(0, 4) === '.../' ? resolve(file) : true))
				.then(hasNoResult => hasNoResult && testNextFile(i + 1))
				.catch(reject);
		};
		testNextFile(0);
	});
}

extractPath.__internals__ = {
	getMatch,
	getRootPath,
	prependDir,
	matcher
};

module.exports = extractPath;
