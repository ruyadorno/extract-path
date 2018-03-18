const cp = require('child_process');

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
		exec: (cmd, cb) => {
			require('util')
				.promisify(setImmediate)()
				.then(() => {
					if (cmd === GIT_ROOT_CMD && !gitFail) {
						cb(null, { stdout: expectedRootFolder });
					} else if (cmd === HG_ROOT_CMD && !hgFail) {
						cb(null, { stdout: expectedRootFolder });
					} else {
						cb(new Error('ENOENT'));
					}
				})
				.catch(() => cb(new Error('ENOENT')));
		}
	};
});

jest.mock('untildify', () => i => i.replace(/^~/, '/Users/username'));

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
		expect(unpackMatches(['', 'foo'])).toBe('foo');
		expect(unpackMatches(/([a-z])/.exec('foo'))).toBe('f');
		expect(unpackMatches(/([a-z].[a-z])/.exec('--foo-bar'))).toBe('foo');
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
				output: ['html/js/hotness.js', 'hotness.js']
			},
			{
				input: { line: '/absolute/path/to/something.txt' },
				output: ['/absolute/path/to/something.txt', 'something.txt', '.txt']
			},
			{
				input: { line: '/html/js/hotness.js42' },
				output: ['/html/js/hotness.js42', '/html/js/hotness.js4', '.js42']
			},
			{
				input: { line: '/html/js/hotness.js' },
				output: ['/html/js/hotness.js', 'hotness.js']
			},
			{
				input: { line: './asd.txt:83' },
				output: ['./asd.txt', './asd.txt', 'asd.txt', '.txt']
			},
			{
				input: { line: '.env.local' },
				output: ['.env.local', '.local']
			},
			{
				input: { line: '.gitignore' },
				output: ['.gitignore']
			},
			{
				input: { line: 'tmp/.gitignore' },
				output: ['tmp/.gitignore']
			},
			{
				input: { line: '.ssh/.gitignore' },
				output: ['.ssh/.gitignore']
			},
			{
				input: { line: '.ssh/known_hosts' },
				output: ['.ssh/known_hosts']
			},
			{
				input: { line: '.a' },
				output: []
			},
			{
				input: { line: 'flib/asd/ent/berkeley/two.py-22' },
				output: [
					'flib/asd/ent/berkeley/two.py',
					'flib/asd/ent/berkeley/two.py',
					'.py-22'
				]
			},
			{
				input: { line: 'flib/foo/bar' },
				output: ['flib/foo/bar']
			},
			{
				input: { line: 'flib/foo/bar ' },
				output: ['flib/foo/bar']
			},
			{
				input: { line: 'foo/b ' },
				output: ['foo/b']
			},
			{
				input: { line: 'foo/bar/baz/' },
				output: []
			},
			{
				input: { line: 'flib/ads/ads.thrift' },
				output: ['flib/ads/ads.thrift', 'ads.thrift', '.thrift']
			},
			{
				input: { line: 'banana hanana Wilde/ads/story.m' },
				output: ['Wilde/ads/story.m', 'story.m']
			},
			{
				input: { line: 'flib/asd/asd.py two/three/four.py' },
				output: ['flib/asd/asd.py', 'asd.py']
			},
			{
				input: { line: 'asd/asd/asd/ 23' },
				output: []
			},
			{
				input: { line: 'foo/bar/TARGETS:23' },
				output: ['foo/bar/TARGETS', 'foo/bar/TARGETS']
			},
			{
				input: { line: 'foo/bar/TARGETS-24' },
				output: ['foo/bar/TARGETS', 'foo/bar/TARGETS-24']
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
					'.cpp'
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
					'fbcode/search/places/scorer/TARGETS'
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
					'fbcode/search/places/scorer/TARGETS'
				]
			},
			{
				input: { line: '~/foo/bar/something.py' },
				output: [
					'~/foo/bar/something.py',
					'/foo/bar/something.py',
					'something.py'
				]
			},
			{
				input: { line: '~/foo/bar/inHomeDir.py:22' },
				output: [
					'~/foo/bar/inHomeDir.py',
					'/foo/bar/inHomeDir.py',
					'/foo/bar/inHomeDir.py',
					'inHomeDir.py'
				]
			},
			{
				input: { line: 'blarge assets/retina/victory@2x.png' },
				output: ['assets/retina/victory@2x.png', 'victory@2x.png', '.png']
			},
			{
				input: { line: '~/assets/retina/victory@2x.png' },
				output: [
					'~/assets/retina/victory@2x.png',
					'/assets/retina/victory@2x.png',
					'victory@2x.png',
					'.png'
				]
			},
			{
				input: { line: 'So.many.periods.txt' },
				output: ['So.many.periods.txt', '.txt']
			},
			{
				input: { line: 'SO.MANY.PERIODS.TXT' },
				output: ['SO.MANY.PERIODS.TXT', '.TXT']
			},
			{
				input: { line: 'blarg blah So.MANY.PERIODS.TXT:22' },
				output: ['So.MANY.PERIODS.TXT', '.TXT']
			},
			{
				input: { line: 'SO.MANY&&PERIODSTXT' },
				output: []
			},
			{
				input: { line: 'test src/categories/NSDate+Category.h' },
				output: ['src/categories/NSDate+Category.h', 'NSDate+Category.h']
			},
			{
				input: { line: '~/src/categories/NSDate+Category.h' },
				output: [
					'~/src/categories/NSDate+Category.h',
					'/src/categories/NSDate+Category.h',
					'NSDate+Category.h'
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
					'./inputs/evilFile'
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
					'./inputs/evilFile'
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
					'./inputs/annoying'
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
					'./inputs/annoying'
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
					'./inputs/annoying'
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
					'./inputs/annoying'
				]
			},
			{
				input: { line: 'M     ./objectivec/NSArray+Utils.h' },
				output: ['./objectivec/NSArray+Utils.h', 'NSArray+Utils.h']
			},
			{
				input: { line: 'NSArray+Utils.h' },
				output: ['NSArray+Utils.h']
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
					'NSArray+Utils.h'
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
					'.sublime-workspace'
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
					'.sublime-workspace'
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
					'./inputs/annoying-hyphen-dir/Package'
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
					'inputs/annoying-hyphen-dir/Package'
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
					'./inputs/annoying-hyphen-dir/Package'
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
					'./inputs/svo'
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
					'./inputs/svo'
				]
			},
			{
				input: {
					line: './inputs/svo install the zip, not me.xml',
					validateFileExists: true
				},
				output: ['./inputs/svo install the zip, not me.xml']
			},
			{
				input: {
					line: './inputs/svo install the zip not me.xml',
					validateFileExists: true
				},
				output: ['./inputs/svo install the zip not me.xml']
			},
			{
				input: {
					line: './inputs/annoyingTildeExtension.txt~:42',
					validateFileExists: true
				},
				output: ['./inputs/annoyingTildeExtension.txt~']
			},
			{
				input: { line: 'inputs/.DS_KINDA_STORE', validateFileExists: true },
				output: ['inputs/.DS_KINDA_STORE']
			},
			{
				input: { line: './inputs/.DS_KINDA_STORE', validateFileExists: true },
				output: ['./inputs/.DS_KINDA_STORE']
			},
			{
				input: { line: 'evilFile No Prepend.txt', validateFileExists: true },
				output: ['evilFile No Prepend.txt']
			},
			{
				input: { line: 'file-from-yocto_%.bbappend', validateFileExists: true },
				output: ['file-from-yocto_%.bbappend']
			},
			{
				input: {
					line: 'otehr thing ./foo/file-from-yocto_3.1%.bbappend',
					validateFileExists: true
				},
				output: ['file-from-yocto_3.1%.bbappend']
			},
			{
				input: {
					line: './file-from-yocto_3.1%.bbappend',
					validateFileExists: true
				},
				output: ['./file-from-yocto_3.1%.bbappend']
			},
			{
				input: { line: 'Gemfile' },
				output: ['Gemfile']
			},
			{
				input: { line: 'Gemfilenope' },
				output: []
			}
		].forEach(({ input, output }) => expect(matcher(input)).toEqual(output));
	});
});
