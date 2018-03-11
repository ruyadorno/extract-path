const exec = require('child_process').exec;

const {
	unpackMatches,
	getRootPath,
	prependDir,
	matcher
} = require('.').__internals__;

jest.mock('child_process', () => {
	const GIT_ROOT_CMD = 'git rev-parse --show-toplevel';
	const HG_ROOT_CMD = 'hg root';
	const expectedRootFolder = '/Users/username/Documents/foo';
	let gitFail = false;
	let hgFail = false;

	return {
		setGitFail(value) {
			gitFail = value;
		},
		setHgFail(value) {
			hgFail = value;
		},
		exec: cmd => {
			if (cmd === GIT_ROOT_CMD && !gitFail) {
				return Promise.resolve(expectedRootFolder);
			} else if (cmd === HG_ROOT_CMD && !hgFail) {
				return Promise.resolve(expectedRootFolder);
			} else {
				return Promise.reject(new Error('ENOENT'));
			}
		}
	};
});

describe('unpackMatches', () => {
	it('should return null if non-valid value used', () => {
		expect(unpackMatches()).toBe(null);
		expect(unpackMatches(0)).toBe(null);
		expect(unpackMatches(NaN)).toBe(null);
		expect(unpackMatches('')).toBe(null);
		expect(unpackMatches(false)).toBe(null);
		expect(unpackMatches(null)).toBe(null);
		expect(unpackMatches(undefined)).toBe(null);
		expect(unpackMatches([])).toBe(null);
		expect(unpackMatches({})).toBe(null);
	});
	it('should return unpacked match if valid value used', () => {
		expect(unpackMatches(['foo'])).toBe('foo');
		expect(unpackMatches(/[a-z]/.exec('foo'))).toBe('f');
		expect(unpackMatches(/([a-z]).([a-z])/.exec('--foo-bar'))).toBe('foo');
	});
});

describe('getRootPath', () => {
	it('should return expected root folder on getRootPath from git', () => {
		exec.setGitFail = false;
		exec.setHgFail = false;
		expect(getRootPath()).resolves.toBe('/Users/username/Documents/foo');
	});
	it('should return expected root folder on getRootPath from hg', () => {
		exec.setGitFail = true;
		exec.setHgFail = false;
		expect(getRootPath()).resolves.toBe('/Users/username/Documents/foo');
	});
	it('should return expected root folder on getRootPath from default', () => {
		exec.setGitFail = true;
		exec.setHgFail = false;
		expect(getRootPath()).resolves.toBe('.');
	});
});
