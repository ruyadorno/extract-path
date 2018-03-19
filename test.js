const cp = require('child_process');

const pickAPath = require('.');
const { getMatch, getRootPath, prependDir, matcher } = pickAPath.__internals__;

jest.mock('child_process', () => {
	const GIT_ROOT_CMD = 'git rev-parse --show-toplevel';
	const HG_ROOT_CMD = 'hg root';
	const stdout = '/Users/username/Documents/foo';
	let gitFail = false;
	let hgFail = false;

	return {
		setGitFail(value) {
			gitFail = value;
		},
		setHgFail(value) {
			hgFail = value;
		},
		exec: (cmd, cb) => {
			require('util')
				.promisify(setImmediate)()
				.then(() => {
					if (cmd === GIT_ROOT_CMD && !gitFail) {
						cb(null, { stdout });
					} else if (cmd === HG_ROOT_CMD && !hgFail) {
						cb(null, { stdout });
					} else {
						cb(new Error('ENOENT'));
					}
				})
				.catch(() => cb(new Error('ENOENT')));
		}
	};
});

jest.mock('untildify', () => i => i.replace(/^~/, '/Users/username'));

describe('getMatch', () => {
	it('should return null if non-valid value used', () => {
		expect(getMatch()).toBe(null);
		expect(getMatch(0)).toBe(null);
		expect(getMatch(NaN)).toBe(null);
		expect(getMatch('')).toBe(null);
		expect(getMatch(false)).toBe(null);
		expect(getMatch(null)).toBe(null);
		expect(getMatch(undefined)).toBe(null);
		expect(getMatch([])).toBe(null);
		expect(getMatch({})).toBe(null);
	});
	it('should return unpacked match if valid value used', () => {
		expect(getMatch(['', 'foo'])).toBe('foo');
		expect(getMatch(/([a-z])/.exec('foo'))).toBe('f');
		expect(getMatch(/([a-z].[a-z])/.exec('--foo-bar'))).toBe('foo');
	});
});

describe('getRootPath', () => {
	afterAll(() => {
		cp.setGitFail(false);
		cp.setHgFail(false);
	});
	it('should return expected root folder on getRootPath from git', () => {
		cp.setGitFail(false);
		cp.setHgFail(false);
		expect.assertions(1);
		return expect(getRootPath()).resolves.toBe('/Users/username/Documents/foo');
	});
	it('should return expected root folder on getRootPath from hg', () => {
		cp.setGitFail(true);
		cp.setHgFail(false);
		expect.assertions(1);
		return expect(getRootPath()).resolves.toBe('/Users/username/Documents/foo');
	});
	it('should return expected root folder on getRootPath from default', () => {
		cp.setGitFail(true);
		cp.setHgFail(true);
		expect.assertions(1);
		return expect(getRootPath()).resolves.toBe('./');
	});
});

describe('prependDir', () => {
	it('should return same input value for less than 2 chars values', () => {
		return expect(prependDir('.')).resolves.toBe('.');
	});
	it('should return same input value for absolute paths', () => {
		return expect(prependDir('/foo/bar')).resolves.toBe('/foo/bar');
	});
	it('should return same input value for dot started paths', () => {
		return expect(prependDir('./foo/bar')).resolves.toBe('./foo/bar');
	});
	it('should return same input value for double dot started paths', () => {
		return expect(prependDir('../foo/bar')).resolves.toBe('../foo/bar');
	});
	it('should return same input value for triple dot started paths', () => {
		return expect(prependDir('.../foo')).resolves.toBe('.../foo');
	});
	it('should return expanded home folder paths', () => {
		return expect(prependDir('~/Document/workspace')).resolves.toBe(
			'/Users/username/Document/workspace'
		);
	});
	it('should return corrected value for home folders', () => {
		return expect(prependDir('home/username/foo')).resolves.toBe(
			'/home/username/foo'
		);
	});
	it('should return corrected value for www folders', () => {
		return expect(prependDir('www/foo')).resolves.toBe(
			'/Users/username/www/foo'
		);
	});
	it('should return dot prepend value for relative single values', () => {
		return expect(prependDir('foo')).resolves.toBe('foo');
	});
	it('should return corrected values for git-diff-like values a/', () => {
		return expect(prependDir('a/foo/bar')).resolves.toBe(
			'/Users/username/Documents/foo/foo/bar'
		);
	});
	it('should return corrected values for git-diff-like values b/', () => {
		return expect(prependDir('b/foo/bar')).resolves.toBe(
			'/Users/username/Documents/foo/foo/bar'
		);
	});
	it('should simply return top level value if file inspection fails', () => {
		return expect(prependDir('foo/bar/item')).resolves.toBe(
			'/Users/username/Documents/foo/foo/bar/item'
		);
	});
});

describe('matcher', () => {
	it('should return expected output for every given input', () => {
		[
			{
				input: { line: 'html/js/hotness.js' },
				output: ['html/js/hotness.js', 'hotness.js', 'html/js/hotness.js']
			},
			{
				input: { line: '/absolute/path/to/something.txt' },
				output: [
					'/absolute/path/to/something.txt',
					'something.txt',
					'.txt',
					'/absolute/path/to/something.txt'
				]
			},
			{
				input: { line: '/html/js/hotness.js42' },
				output: [
					'/html/js/hotness.js42',
					'/html/js/hotness.js4',
					'.js42',
					'/html/js/hotness.js42'
				]
			},
			{
				input: { line: '/html/js/hotness.js' },
				output: ['/html/js/hotness.js', 'hotness.js', '/html/js/hotness.js']
			},
			{
				input: { line: './asd.txt:83' },
				output: ['./asd.txt', './asd.txt', 'asd.txt', '.txt', './asd.txt:83']
			},
			{
				input: { line: '.env.local' },
				output: ['.env.local', '.local', '.env.local']
			},
			{
				input: { line: '.gitignore' },
				output: ['.gitignore', '.gitignore']
			},
			{
				input: { line: 'tmp/.gitignore' },
				output: ['tmp/.gitignore', 'tmp/.gitignore']
			},
			{
				input: { line: '.ssh/.gitignore' },
				output: ['.ssh/.gitignore', '.ssh/.gitignore']
			},
			{
				input: { line: '.ssh/known_hosts' },
				output: ['.ssh/known_hosts', '.ssh/known_hosts']
			},
			{
				input: { line: '.a' },
				output: ['.a']
			},
			{
				input: { line: 'flib/asd/ent/berkeley/two.py-22' },
				output: [
					'flib/asd/ent/berkeley/two.py',
					'flib/asd/ent/berkeley/two.py',
					'.py-22',
					'flib/asd/ent/berkeley/two.py-22'
				]
			},
			{
				input: { line: 'flib/foo/bar' },
				output: ['flib/foo/bar', 'flib/foo/bar']
			},
			{
				input: { line: 'flib/foo/bar ' },
				output: ['flib/foo/bar', 'flib/foo/bar']
			},
			{
				input: { line: 'foo/b ' },
				output: ['foo/b', 'foo/b']
			},
			{
				input: { line: 'foo/bar/baz/' },
				output: ['foo/bar/baz/']
			},
			{
				input: { line: 'flib/ads/ads.thrift' },
				output: [
					'flib/ads/ads.thrift',
					'ads.thrift',
					'.thrift',
					'flib/ads/ads.thrift'
				]
			},
			{
				input: { line: 'banana hanana Wilde/ads/story.m' },
				output: [
					'Wilde/ads/story.m',
					'story.m',
					'banana hanana Wilde/ads/story.m'
				]
			},
			{
				input: { line: 'flib/asd/asd.py two/three/four.py' },
				output: [
					'flib/asd/asd.py',
					'asd.py',
					'flib/asd/asd.py two/three/four.py'
				]
			},
			{
				input: { line: 'asd/asd/asd/ 23' },
				output: ['asd/asd/asd/ 23']
			},
			{
				input: { line: 'foo/bar/TARGETS:23' },
				output: ['foo/bar/TARGETS', 'foo/bar/TARGETS', 'foo/bar/TARGETS:23']
			},
			{
				input: { line: 'foo/bar/TARGETS-24' },
				output: ['foo/bar/TARGETS', 'foo/bar/TARGETS-24', 'foo/bar/TARGETS-24']
			},
			{
				input: {
					line:
						'fbcode/search/places/scorer/PageScorer.cpp:27:46:#include "search/places/scorer/linear_scores/MinutiaeVerbScorer.h'
				},
				output: [
					'fbcode/search/places/scorer/PageScorer.cpp',
					'fbcode/search/places/scorer/PageScorer.cpp',
					'PageScorer.cpp',
					'.cpp',
					'fbcode/search/places/scorer/PageScorer.cpp:27:46:#include "search/places/scorer/linear_scores/MinutiaeVerbScorer.h'
				]
			},
			{
				input: {
					line:
						'fbcode/search/places/scorer/TARGETS:590:28:    srcs = ["linear_scores/MinutiaeVerbScorer.cpp"]'
				},
				output: [
					'fbcode/search/places/scorer/TARGETS',
					'fbcode/search/places/scorer/TARGETS',
					'fbcode/search/places/scorer/TARGETS',
					'fbcode/search/places/scorer/TARGETS:590:28:    srcs = ["linear_scores/MinutiaeVerbScorer.cpp"]'
				]
			},
			{
				input: {
					line:
						'fbcode/search/places/scorer/TARGETS:1083:27:      "linear_scores/test/MinutiaeVerbScorerTest.cpp"'
				},
				output: [
					'fbcode/search/places/scorer/TARGETS',
					'fbcode/search/places/scorer/TARGETS',
					'fbcode/search/places/scorer/TARGETS',
					'fbcode/search/places/scorer/TARGETS:1083:27:      "linear_scores/test/MinutiaeVerbScorerTest.cpp"'
				]
			},
			{
				input: { line: '~/foo/bar/something.py' },
				output: [
					'~/foo/bar/something.py',
					'/foo/bar/something.py',
					'something.py',
					'~/foo/bar/something.py'
				]
			},
			{
				input: { line: '~/foo/bar/inHomeDir.py:22' },
				output: [
					'~/foo/bar/inHomeDir.py',
					'/foo/bar/inHomeDir.py',
					'/foo/bar/inHomeDir.py',
					'inHomeDir.py',
					'~/foo/bar/inHomeDir.py:22'
				]
			},
			{
				input: { line: 'blarge assets/retina/victory@2x.png' },
				output: [
					'assets/retina/victory@2x.png',
					'victory@2x.png',
					'.png',
					'blarge assets/retina/victory@2x.png'
				]
			},
			{
				input: { line: '~/assets/retina/victory@2x.png' },
				output: [
					'~/assets/retina/victory@2x.png',
					'/assets/retina/victory@2x.png',
					'victory@2x.png',
					'.png',
					'~/assets/retina/victory@2x.png'
				]
			},
			{
				input: { line: 'So.many.periods.txt' },
				output: ['So.many.periods.txt', '.txt', 'So.many.periods.txt']
			},
			{
				input: { line: 'SO.MANY.PERIODS.TXT' },
				output: ['SO.MANY.PERIODS.TXT', '.TXT', 'SO.MANY.PERIODS.TXT']
			},
			{
				input: { line: 'blarg blah So.MANY.PERIODS.TXT:22' },
				output: [
					'So.MANY.PERIODS.TXT',
					'.TXT',
					'blarg blah So.MANY.PERIODS.TXT:22'
				]
			},
			{
				input: { line: 'SO.MANY&&PERIODSTXT' },
				output: ['SO.MANY&&PERIODSTXT']
			},
			{
				input: { line: 'test src/categories/NSDate+Category.h' },
				output: [
					'src/categories/NSDate+Category.h',
					'NSDate+Category.h',
					'test src/categories/NSDate+Category.h'
				]
			},
			{
				input: { line: '~/src/categories/NSDate+Category.h' },
				output: [
					'~/src/categories/NSDate+Category.h',
					'/src/categories/NSDate+Category.h',
					'NSDate+Category.h',
					'~/src/categories/NSDate+Category.h'
				]
			},
			{
				input: {
					line: 'M    ./inputs/evilFile With Space.txt',
					validateFileExists: true
				},
				output: [
					'./inputs/evilFile With Space.txt',
					'./inputs/evilFile',
					'Space.txt',
					'evilFile With Space.txt',
					'./inputs/evilFile',
					'M    ./inputs/evilFile With Space.txt'
				]
			},
			{
				input: {
					line: './inputs/evilFile With Space.txt:22',
					validateFileExists: true
				},
				output: [
					'./inputs/evilFile With Space.txt',
					'./inputs/evilFile',
					'Space.txt',
					'evilFile With Space.txt',
					'./inputs/evilFile',
					'./inputs/evilFile With Space.txt:22'
				]
			},
			{
				input: {
					line: './inputs/annoying Spaces Folder/evilFile With Space2.txt',
					validateFileExists: true
				},
				output: [
					'./inputs/annoying Spaces Folder/evilFile With Space2.txt',
					'./inputs/annoying',
					'Space2.txt',
					'evilFile With Space2.txt',
					'./inputs/annoying',
					'./inputs/annoying Spaces Folder/evilFile With Space2.txt'
				]
			},
			{
				input: {
					line: './inputs/annoying Spaces Folder/evilFile With Space2.txt:42',
					validateFileExists: true
				},
				output: [
					'./inputs/annoying Spaces Folder/evilFile With Space2.txt',
					'./inputs/annoying',
					'Space2.txt',
					'evilFile With Space2.txt',
					'./inputs/annoying',
					'./inputs/annoying Spaces Folder/evilFile With Space2.txt:42'
				]
			},
			{
				input: {
					line: ' ./inputs/annoying Spaces Folder/evilFile With Space2.txt:42',
					validateFileExists: true
				},
				output: [
					'./inputs/annoying Spaces Folder/evilFile With Space2.txt',
					'./inputs/annoying',
					'Space2.txt',
					'evilFile With Space2.txt',
					'./inputs/annoying',
					'./inputs/annoying Spaces Folder/evilFile With Space2.txt:42'
				]
			},
			{
				input: {
					line:
						'M     ./inputs/annoying Spaces Folder/evilFile With Space2.txt:42',
					validateFileExists: true
				},
				output: [
					'./inputs/annoying Spaces Folder/evilFile With Space2.txt',
					'./inputs/annoying',
					'Space2.txt',
					'evilFile With Space2.txt',
					'./inputs/annoying',
					'M     ./inputs/annoying Spaces Folder/evilFile With Space2.txt:42'
				]
			},
			{
				input: { line: 'M     ./objectivec/NSArray+Utils.h' },
				output: [
					'./objectivec/NSArray+Utils.h',
					'NSArray+Utils.h',
					'M     ./objectivec/NSArray+Utils.h'
				]
			},
			{
				input: { line: 'NSArray+Utils.h' },
				output: ['NSArray+Utils.h', 'NSArray+Utils.h']
			},
			{
				input: {
					line: './inputs/NSArray+Utils.h:42',
					validateFileExists: true
				},
				output: [
					'./inputs/NSArray+Utils.h',
					'./inputs/NSArray+Utils.h',
					'./inputs/NSArray+Utils.h',
					'./inputs/NSArray',
					'NSArray+Utils.h',
					'NSArray+Utils.h',
					'./inputs/NSArray+Utils.h:42'
				]
			},
			{
				input: {
					line: './inputs/blogredesign.sublime-workspace:42',
					validateFileExists: true
				},
				output: [
					'./inputs/blogredesign.sublime',
					'./inputs/blogredesign.sublime-workspace',
					'./inputs/blogredesign.sublime-workspace',
					'./inputs/blogredesign',
					'.sublime-workspace',
					'./inputs/blogredesign.sublime-workspace:42'
				]
			},
			{
				input: {
					line: 'inputs/blogredesign.sublime-workspace:42',
					validateFileExists: true
				},
				output: [
					'inputs/blogredesign.sublime',
					'inputs/blogredesign.sublime-workspace',
					'inputs/blogredesign.sublime-workspace',
					'inputs/blogredesign',
					'.sublime-workspace',
					'inputs/blogredesign.sublime-workspace:42'
				]
			},
			{
				input: {
					line: './inputs/annoying-hyphen-dir/Package Control.system-bundle',
					validateFileExists: true
				},
				output: [
					'./inputs/annoying-hyphen-dir/Package Control.system-bundle',
					'./inputs/annoying-hyphen-dir/Package',
					'./inputs/annoying-hyphen-dir/Package',
					'./inputs/annoying-hyphen-dir/Package Control.system-bundle'
				]
			},
			{
				input: {
					line: 'inputs/annoying-hyphen-dir/Package Control.system-bundle',
					validateFileExists: true
				},
				output: [
					'inputs/annoying-hyphen-dir/Package Control.system-bundle',
					'inputs/annoying-hyphen-dir/Package',
					'inputs/annoying-hyphen-dir/Package',
					'inputs/annoying-hyphen-dir/Package Control.system-bundle'
				]
			},
			{
				input: {
					line: './inputs/annoying-hyphen-dir/Package Control.system-bundle:42',
					validateFileExists: true
				},
				output: [
					'./inputs/annoying-hyphen-dir/Package Control.system-bundle',
					'./inputs/annoying-hyphen-dir/Package',
					'./inputs/annoying-hyphen-dir/Package',
					'./inputs/annoying-hyphen-dir/Package Control.system-bundle:42'
				]
			},
			{
				input: {
					line: './inputs/svo (install the zip, not me).xml',
					validateFileExists: true
				},
				output: [
					'./inputs/svo (install the zip, not me).xml',
					'./inputs/svo',
					'./inputs/svo',
					'./inputs/svo (install the zip, not me).xml'
				]
			},
			{
				input: {
					line: './inputs/svo (install the zip not me).xml',
					validateFileExists: true
				},
				output: [
					'./inputs/svo (install the zip not me).xml',
					'./inputs/svo',
					'./inputs/svo',
					'./inputs/svo (install the zip not me).xml'
				]
			},
			{
				input: {
					line: './inputs/svo install the zip, not me.xml',
					validateFileExists: true
				},
				output: [
					'./inputs/svo install the zip, not me.xml',
					'./inputs/svo',
					'me.xml',
					'not me.xml',
					'./inputs/svo',
					'./inputs/svo install the zip, not me.xml'
				]
			},
			{
				input: {
					line: './inputs/svo install the zip not me.xml',
					validateFileExists: true
				},
				output: [
					'./inputs/svo install the zip not me.xml',
					'./inputs/svo',
					'me.xml',
					'svo install the zip not me.xml',
					'./inputs/svo',
					'./inputs/svo install the zip not me.xml'
				]
			},
			{
				input: {
					line: './inputs/annoyingTildeExtension.txt~:42',
					validateFileExists: true
				},
				output: [
					'./inputs/annoyingTildeExtension.txt',
					'./inputs/annoyingTildeExtension.txt~',
					'./inputs/annoyingTildeExtension.txt',
					'./inputs/annoyingTildeExtension',
					'./inputs/annoyingTildeExtension.txt~:42'
				]
			},
			{
				input: { line: 'inputs/.DS_KINDA_STORE', validateFileExists: true },
				output: [
					'inputs/.DS_KINDA_STORE',
					'inputs/.DS_KINDA_STORE',
					'inputs/.DS_KINDA_STORE'
				]
			},
			{
				input: { line: './inputs/.DS_KINDA_STORE', validateFileExists: true },
				output: [
					'./inputs/.DS_KINDA_STORE',
					'/inputs/.DS_KINDA_STORE',
					'./inputs/.DS_KINDA_STORE'
				]
			},
			{
				input: { line: 'evilFile No Prepend.txt', validateFileExists: true },
				output: [
					'Prepend.txt',
					'evilFile No Prepend.txt',
					'.txt',
					'evilFile No Prepend.txt'
				]
			},
			{
				input: { line: 'file-from-yocto_%.bbappend', validateFileExists: true },
				output: [
					'file-from-yocto_%.bbappend',
					'file-from-yocto_%.bbappend',
					'.bbappend',
					'file-from-yocto_%.bbappend'
				]
			},
			{
				input: {
					line: 'other thing ./foo/file-from-yocto_3.1%.bbappend',
					validateFileExists: true
				},
				output: [
					'./foo/file-from-yocto_3.1',
					'./foo/file-from-yocto_3.1',
					'./foo/file-from-yocto_3.1',
					'./foo/file-from-yocto_3',
					'file-from-yocto_3.1%.bbappend',
					'file-from-yocto_3.1%.bbappend',
					'.bbappend',
					'other thing ./foo/file-from-yocto_3.1%.bbappend'
				]
			},
			{
				input: {
					line: './file-from-yocto_3.1%.bbappend',
					validateFileExists: true
				},
				output: [
					'./file-from-yocto_3.1',
					'./file-from-yocto_3.1',
					'./file-from-yocto_3.1',
					'./file-from-yocto_3',
					'file-from-yocto_3.1%.bbappend',
					'file-from-yocto_3.1%.bbappend',
					'.bbappend',
					'./file-from-yocto_3.1%.bbappend'
				]
			},
			{
				input: { line: 'Gemfile' },
				output: ['Gemfile', 'Gemfile']
			},
			{
				input: { line: 'Gemfilenope' },
				output: ['Gemfilenope']
			},
			{
				input: { line: 'M ../__tests__/foo.test.js' },
				output: [
					'../__tests__/foo.test.js',
					'foo.test.js',
					'M ../__tests__/foo.test.js'
				]
			},
			{
				input: { line: 'M ../__tests__/__snapshots__/foo.test.js.snap' },
				output: [
					'../__tests__/__snapshots__/foo.test.js.snap',
					'foo.test.js.snap',
					'.snap',
					'M ../__tests__/__snapshots__/foo.test.js.snap'
				]
			}
		].forEach(({ input, output }) => expect(matcher(input)).toEqual(output));
	});
	it('should return expected output for all input cases', () => {
		[
			{
				input: { line: '    ', allInput: true },
				output: []
			},
			{
				input: { line: ' ', allInput: true },
				output: []
			},
			{
				input: { line: 'a', allInput: true },
				output: ['a']
			},
			{
				input: { line: '   a', allInput: true },
				output: ['a']
			},
			{
				input: { line: 'a    ', allInput: true },
				output: ['a']
			},
			{
				input: { line: '    foo bar', allInput: true },
				output: ['foo bar']
			},
			{
				input: { line: 'foo bar    ', allInput: true },
				output: ['foo bar']
			},
			{
				input: { line: '    foo bar    ', allInput: true },
				output: ['foo bar']
			},
			{
				input: { line: 'foo bar baz', allInput: true },
				output: ['foo bar baz']
			},
			{
				input: {
					line: '	modified:   Classes/Media/YPMediaLibraryViewController.m',
					allInput: true
				},
				output: [
					'modified:   Classes/Media/YPMediaLibraryViewController.m',
					'Classes/Media/YPMediaLibraryViewController.m',
					'YPMediaLibraryViewController.m'
				]
			},
			{
				input: {
					line:
						'no changes added to commit (use "git add" and/or "git commit -a")',
					allInput: true
				},
				output: [
					'no changes added to commit (use "git add" and/or "git commit -a")',
					'and/or'
				]
			}
		].forEach(({ input, output }) => expect(matcher(input)).toEqual(output));
	});
	it('should return expected output for fallback option', () => {
		[
			{
				input: { line: '    ', allInput: true, fallback: false },
				output: []
			},
			{
				input: { line: 'Gemfilenope', fallback: false },
				output: []
			}
		].forEach(({ input, output }) => expect(matcher(input)).toEqual(output));
	});
});

describe('pickAPath', () => {
	it('should reject if first param is missing', () => {
		return expect(pickAPath()).rejects.toThrow(TypeError);
	});
	it('should reject if first param is null', () => {
		return expect(pickAPath(null)).rejects.toThrow(TypeError);
	});
	it('should reject if first param is NaN', () => {
		return expect(pickAPath(NaN)).rejects.toThrow(TypeError);
	});
	it('should reject if first param is a number', () => {
		return expect(pickAPath(1)).rejects.toThrow(TypeError);
	});
	it('should reject if first param is a regex', () => {
		return expect(pickAPath(/foo/)).rejects.toThrow(TypeError);
	});
	it('should reject if first param is an object', () => {
		return expect(pickAPath({})).rejects.toThrow(TypeError);
	});
	it('should reject if first param is an array', () => {
		return expect(pickAPath([])).rejects.toThrow(TypeError);
	});
	it('should return simple matcher result if validateFileExists is false', () => {
		return expect(
			pickAPath(' M whatever ./foo/bar', { validateFileExists: false })
		).resolves.toBe('./foo/bar');
	});
	it('should return fallback value if matcher has no matches', () => {
		return expect(
			pickAPath('SO.MANY&&PERIODSTXT', { validateFileExists: false })
		).resolves.toBe('SO.MANY&&PERIODSTXT');
	});
	it('should return undefined if matcher has no matches and resolveWithFallback=false', () => {
		return expect(
			pickAPath('SO.MANY&&PERIODSTXT', {
				validateFileExists: false,
				resolveWithFallback: false
			})
		).resolves.toBe(undefined);
	});
	it('should return simple matcher with file validation result', () => {
		return expect(
			pickAPath(' M whatever ./__fixtures__/simplefile.js')
		).resolves.toBe('./__fixtures__/simplefile.js');
	});
	it('should resolve with undefined if file can not be found', () => {
		return expect(pickAPath(' M whatever ./foo/bar')).resolves.toBe(undefined);
	});
	it('should resolve to trimmed input value if resolveWithInput param is used', () => {
		return expect(
			pickAPath(' M whatever ./__fixtures__/simplefile.js', {
				resolveWithInput: true
			})
		).resolves.toBe('M whatever ./__fixtures__/simplefile.js');
	});
	it('should resolve fallback file names', () => {
		return expect(pickAPath('LICENSE')).resolves.toBe('LICENSE');
	});
	it('should resolve trimmed input value if using resolveWithInput and validateFileExists=false', () => {
		return expect(
			pickAPath('   lorem ipsum dolor sit amet ... ', {
				resolveWithInput: true,
				validateFileExists: false
			})
		).resolves.toBe('lorem ipsum dolor sit amet ...');
	});
	it('should skip validation and resolve expected value for git triple-dot paths', () => {
		return expect(pickAPath('M diff .../foo/bar')).resolves.toBe('.../foo/bar');
	});
});
