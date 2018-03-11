const promisify = require('util').promisify;
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
const JUST_FILE = /([@+a-z.A-Z0-9\-_]+\.[a-zA-Z]{1,10})(\s|$|:)+/;
const JUST_FILE_WITH_SPACES = /([a-zA-Z][@+a-z. A-Z0-9\-_]+\.[a-zA-Z]{1,10})(\s|$|:)+/;
const FILE_NO_PERIODS = /(((\/?([a-z.A-Z0-9\-_]+\/))?\.[a-zA-Z0-9\-_]{3,}[a-zA-Z0-9\-_\/]*) | ([a-z.A-Z0-9\-_\/]{1,}\/[a-zA-Z0-9\-_]{1,}) | ([A-Z][a-zA-Z]{2,}file)) (\s|$|:)+/;
const MASTER_REGEX_WITH_SPACES_AND_WEIRD_FILES = /((?:\.?\/)?(([a-z.A-Z0-9\-_]|\s[a-zA-Z0-9\-_])+\/)+((\/?([a-z.A-Z0-9\-_]+\/))?\.[a-zA-Z0-9\-_]{3,}[a-zA-Z0-9\-_\/]*) | ([a-z.A-Z0-9\-_\/]{1,}\/[a-zA-Z0-9\-_]{1,}) | ([A-Z][a-zA-Z]{2,}file))/;
const MASTER_REGEX_WITH_SPACES = /((?:\.?\/)?(([a-z.A-Z0-9\-_]|\s[a-zA-Z0-9\-_])+\/)+([\(\),@a-zA-Z0-9\-_+.]|\s[,\(\)@a-zA-Z0-9\-_+.])+\.[a-zA-Z0-9-]{1,30}) [:-]{0,1}(\d+)?/;

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
		allInput: 1
	}
];

const unpackMatches = matches =>
	matches && matches.length ? matches[0] : null;

const getRootPath = () =>
	exec(GIT_ROOT_CMD)
		.catch(() => exec(HG_ROOT_CMD))
		.catch(() => './');

const prependDir = (file, withFileInspection = true) => {
	const splitUp = file.split(path.sep);
	const [firstPart] = splitUp;
	const firstChars = file.substr(0, 2);
	let prependPath;
	let topLevelPath;
	let relativePath;
	let hasTopLevel;
	let hasRelative;

	return getRootPath()
		.then(rootPath => {
			prependPath = path.join(rootPath.trim(), '/');
			topLevelPath = path.join(prependPath, splitUp);
			relativePath = path.join('.', splitUp);
		})
		.then(access(topLevelPath))
		.then(() => {
			hasTopLevel = true;
		})
		.catch(() => {
			hasTopLevel = false;
		})
		.then(access(relativePath))
		.then(() => {
			hasRelative = true;
		})
		.catch(() => {
			hasRelative = false;
		})
		.then(() => {
			if (
				!file ||
				file.length < 2 ||
				file[0] === '/' ||
				file.substr(0, 2) === './' ||
				file.substr(0, 3) === '../' ||
				file.substr(0, 4) === '.../'
			)
				return file;
			if (file.substr(0, 2) === '~/') return untildify(file);
			if (firstPart === 'home') return path.join('/', file);
			if (firstPart === 'www') return untildify(path.join('~/', file));
			if (file.indexOf('/') === -1) return path.join('./', file);
			if (firstChars === 'a/' || firstChars === 'b/')
				return path.join(prependPath, file.substr(2));
			if (!withFileInspection) return path.join(prependPath, file);
			if (!hasTopLevel && hasRelative) return relativePath;
			return topLevelPath;
		});
};

const matcher = ({ line, validateFileExists, allInput }) =>
	REGEX_WATERFALL.reduce(
		(acc, { allInput, regex, validateFileExists, preferred }) => {
			if (
				(allInput && !allInput) ||
				(allInput && !allInput) ||
				(validateFileExists && !validateFileExists) ||
				!regex.test(line)
			)
				return;

			const matches = regex.exec(line);

			if (!preferred) return acc.concat(unpackMatches(matches));
			if (!preferred.test(line)) return acc.concat(unpackMatches(matches));

			const preferredMatches = preferred.exec(line);

			if (preferredMatches.index < matches.index)
				return acc.concat(unpackMatches(preferredMatches));

			return acc.concat(unpackMatches(matches));
		},
		[]
	).filter(a => a);

function pickAPath({ line, validateFileExists = false, allInput = false }) {
	if (!validateFileExists) {
		return Promise.resolve(matcher({ line, allInput })[0] || null);
	}

	return new Promise((resolve, reject) => {
		const results = matcher({ line, validateFileExists, allInput });
		const testNextItem = i => {
			const item = results[i];

			if (!item) reject(new Error('No path found'));

			prependDir(item.filename)
				.then(access)
				.then(() => {
					resolve(item);
				})
				.catch(
					() => (item.filename.substr(0, 4) === '.../' ? resolve(item) : true)
				)
				.then(hasNoResult => hasNoResult && testNextItem(i + 1));
		};
		testNextItem(0);
	});
}

module.exports = {
	__internals__: {
		unpackMatches,
		getRootPath,
		prependDir,
		matcher
	},
	pickAPath
};
