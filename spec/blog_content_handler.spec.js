var _ = require("underscore");
var fs = require("fs");
var path = require("path");

var blog_content_handler = require('../lib/blog_content_handler.js');
var module_utils = require("punch").Utils.Module;
var default_content_handler = require("punch").ContentHandler;
var yaml = require("js-yaml");

describe("setup", function() {

	var sample_config = {
		blog: {
			posts_dir: "posts_dir",
		},

		plugins: {
			parsers: {
				".markdown": "sample_markdown_parser",
				".yml": "sample_yml_parser"
			}
		}
	};

	beforeEach(function() {
		blog_content_handler.parsers = {};
		blog_content_handler.postsDir = "posts";

		spyOn(module_utils, "requireAndSetup").andCallFake(function(id, config){
			return {"id": id};
		});
	});

	it("setup each parser", function(){
		blog_content_handler.setup(sample_config);
		expect(blog_content_handler.parsers).toEqual({ ".markdown": { "id": "sample_markdown_parser" }, ".yml": { "id": "sample_yml_parser" } });
	});

	it("delegate setup to default content handler", function() {
		spyOn(default_content_handler, "setup");

		blog_content_handler.setup(sample_config);
		expect(default_content_handler.setup).toHaveBeenCalledWith(sample_config);
	});

	it("keep the defaults if no blog specific configs are provided", function() {
		blog_content_handler.setup({ "plugins": {} });
		expect(blog_content_handler.postsDir).toEqual("posts");
	});

	it("configure posts directory", function() {
		blog_content_handler.setup(sample_config);
		expect(blog_content_handler.postsDir).toEqual("posts_dir");
	});

	it("delegate to setup URL patterns", function() {
		spyOn(blog_content_handler, "setupUrlPatterns");

		blog_content_handler.setup(sample_config);
		expect(blog_content_handler.setupUrlPatterns).toHaveBeenCalledWith(sample_config.blog);
	});

});

describe("setup URL patterns", function() {
	var sample_config = {
		post_url: "/{year}/{month}/{date}-{title}",
		archive_urls: {
			"all": "/history"
		}
	}

	it("set the post url pattern based on the given post url", function() {
		blog_content_handler.setupUrlPatterns(sample_config);
		expect(blog_content_handler.postUrl).toEqual({ "pattern": "\\/(\\d\\d\\d\\d)\\/(\\d\\d)\\/(\\d\\d)-([^\\/\\s]+)", "mappings": { 'year': 1, 'month': 2, 'date': 3, 'title': 4 }});
	});

	it("set the post file name pattern based on the given post url", function() {
		blog_content_handler.setupUrlPatterns(sample_config);
		expect(blog_content_handler.postFileNameRegex).toEqual("^\\S+\/(\\d\\d\\d\\d)-(\\d\\d)-(\\d\\d)-([^\\/\\s]+)\\.\\S+$");
	});

	it("set the archive url patterns as an array", function() {
		blog_content_handler.setupUrlPatterns(sample_config);
		expect(blog_content_handler.archiveUrls).toEqual([ { "pattern": "\\/history", "mappings": {} },
		 																													{ "pattern": "\\/(\\d\\d\\d\\d)", "mappings": { 'year': 1 } },
																														 	{ "pattern": "\\/(\\d\\d\\d\\d)\\/(\\d\\d)", "mappings": { 'year': 1, 'month': 2 } },
																														  { "pattern": "\\/(\\d\\d\\d\\d)\\/(\\d\\d)\\/(\\d\\d)", "mappings": { 'year': 1, 'month': 2, 'date': 3 } },
																															{	"pattern": "\\/tag\\/([^\\/\\s]+)", "mappings": { 'tag': 1 } } ]);
	});
});

describe("is section", function() {

	beforeEach(function() {
		var sample_config = {
			post_url: "/{year}/{month}/{date}-{title}"
		}

		blog_content_handler.setupUrlPatterns(sample_config);
	});

	it("treat post urls as sections", function() {
		expect(blog_content_handler.isSection("/2012/11/19-test-post")).toEqual(true);
	});

	it("treat /archive as a section", function() {
		expect(blog_content_handler.isSection("/archive")).toEqual(true);
	});

	it("treat tag urls as a section", function() {
		expect(blog_content_handler.isSection("/tag/life")).toEqual(true);
	});

	it("treat year-months archives as a section", function() {
		expect(blog_content_handler.isSection("/2012/10")).toEqual(true);
	});

	it("don't treat /index as a section (since it's already a section)", function() {
		expect(blog_content_handler.isSection("/index")).toEqual(false);
	});

	it("delegate other urls to default content handler", function() {
		spyOn(default_content_handler, "isSection");

		blog_content_handler.isSection("/section/sub");
		expect(default_content_handler.isSection).toHaveBeenCalledWith("/section/sub");
	});

});

describe("get sections", function() {

	it("delegate to the default content handler", function() {
		spyOn(default_content_handler, "getSections");

		var spyCallback = jasmine.createSpy();
		blog_content_handler.getSections(spyCallback);

		expect(default_content_handler.getSections).toHaveBeenCalledWith(spyCallback);
	});

});

describe("negotiate content", function() {

	beforeEach(function() {
		var sample_config = {
			post_url: "/{year}/{month}/{date}-{title}"
		}

		blog_content_handler.setupUrlPatterns(sample_config);
	});

	it("delegate to get post if a post url given", function() {
		spyOn(blog_content_handler, "getPost");

		var spyCallback = jasmine.createSpy();
		blog_content_handler.negotiateContent("/2012/11/20-test-post/index", ".html", {}, spyCallback);

		expect(blog_content_handler.getPost).toHaveBeenCalledWith("/2012/11/20-test-post/index", jasmine.any(Function));
	});

	it("add shared content to the post", function() {
		spyOn(blog_content_handler, "getPost").andCallFake(function(basepath, callback) {
			return callback(null, {}, new Date(2012, 10, 20));
		});

		spyOn(default_content_handler, "getSharedContent");

		var spyCallback = jasmine.createSpy();
		blog_content_handler.negotiateContent("/2012/11/20-test-post/index", ".html", {}, spyCallback);

		expect(default_content_handler.getSharedContent).toHaveBeenCalledWith(jasmine.any(Function));
	});

	it("set the post specific attributes", function() {
		spyOn(blog_content_handler, "getPost").andCallFake(function(basepath, callback) {
			return callback(null, {}, new Date(2012, 10, 20));
		});

		spyOn(default_content_handler, "getSharedContent").andCallFake(function(callback) {
			return callback(null, {}, new Date(2012, 10, 20));
		});

		var spyCallback = jasmine.createSpy();
		blog_content_handler.negotiateContent("/2012/11/20-test-post/index", ".html", {}, spyCallback);

		expect(spyCallback).toHaveBeenCalledWith(null, { "is_post" : true }, {}, jasmine.any(Date));
	});

	it("delegate to get posts if archive url is given", function() {
		spyOn(blog_content_handler, "getPosts");

		var spyCallback = jasmine.createSpy();
		blog_content_handler.negotiateContent("/2012/11/index", ".html", {}, spyCallback);

		expect(blog_content_handler.getPosts).toHaveBeenCalledWith("/2012/11/index", jasmine.any(Function));
	});

	it("add shared content to an archive list", function() {
		spyOn(blog_content_handler, "getPosts").andCallFake(function(basepath, callback) {
			return callback(null, {}, new Date(2012, 10, 20));
		});

		spyOn(default_content_handler, "getSharedContent");

		var spyCallback = jasmine.createSpy();
		blog_content_handler.negotiateContent("/2012/11/index", ".html", {}, spyCallback);

		expect(default_content_handler.getSharedContent).toHaveBeenCalledWith(jasmine.any(Function));
	});

	it("set the archive specific attributes", function() {
		spyOn(blog_content_handler, "getPosts").andCallFake(function(basepath, callback) {
			return callback(null, {}, new Date(2012, 10, 20));
		});

		spyOn(default_content_handler, "getSharedContent").andCallFake(function(callback) {
			return callback(null, {}, new Date(2012, 10, 20));
		});

		var spyCallback = jasmine.createSpy();
		blog_content_handler.negotiateContent("/2012/11/index", ".html", {}, spyCallback);

		expect(spyCallback).toHaveBeenCalledWith(null, { "is_post" : false, "title": "Archive" }, {}, jasmine.any(Date));
	});

	it("delegate content requests for other pages to default handler", function() {
		spyOn(default_content_handler, "negotiateContent");

		var spyCallback = jasmine.createSpy();
		blog_content_handler.negotiateContent("/about/index", ".html", {}, spyCallback);

		expect(default_content_handler.negotiateContent).toHaveBeenCalledWith("/about/index", ".html", {}, spyCallback);
	});

});

describe("get content paths", function() {
	beforeEach(function() {
		var sample_config = {
			post_url: "/{year}/{month}/{date}/{title}",
			archive_urls: {
				"all": "/archive",
				"tag": "/tagged/{tag}"
			}
		}

		blog_content_handler.setupUrlPatterns(sample_config);
	});

	it("fetch other content paths from default content handler", function() {
		spyOn(default_content_handler, "getContentPaths");
		var spyCallback = jasmine.createSpy();
		blog_content_handler.getContentPaths("/", spyCallback);

		expect(default_content_handler.getContentPaths).toHaveBeenCalledWith("/", jasmine.any(Function));
	});

	it("fetch all posts before determining paths", function() {
		spyOn(default_content_handler, "getContentPaths").andCallFake(function(path, callback) {
			return callback(null, []);
		});
		spyOn(blog_content_handler, "getAllPosts");

		var spyCallback = jasmine.createSpy();
		blog_content_handler.getContentPaths(path.sep, spyCallback);

		expect(blog_content_handler.getAllPosts).toHaveBeenCalledWith(jasmine.any(Function));
	});

	it("include all post permalinks", function() {
		blog_content_handler.tagCounts = {};
		blog_content_handler.postDates = {};

		spyOn(default_content_handler, "getContentPaths").andCallFake(function(path, callback) {
			return callback(null, []);
		});
		spyOn(blog_content_handler, "getAllPosts").andCallFake(function(callback) {
			return callback(null, { "post1": { "permalink": "/2012/11/20/test-post1" }, "post2": { "permalink": "/2012/11/20/test-post2" }, "post3": { "permalink": "/2012/11/20/test-post3" } });
		});

		var spyCallback = jasmine.createSpy();
		blog_content_handler.getContentPaths(path.sep, spyCallback);

		expect(spyCallback).toHaveBeenCalledWith(null, [ "/2012/11/20/test-post1", "/2012/11/20/test-post2", "/2012/11/20/test-post3", "/archive" ]);
	});

	it("set the paths for all tags", function() {
		blog_content_handler.tagCounts = { "tag1": 10, "Tag2": 20, "tagB": 30 };
		blog_content_handler.postDates = {};

		spyOn(default_content_handler, "getContentPaths").andCallFake(function(path, callback) {
			return callback(null, []);
		});
		spyOn(blog_content_handler, "getAllPosts").andCallFake(function(callback) {
			return callback(null, { });
		});

		var spyCallback = jasmine.createSpy();
		blog_content_handler.getContentPaths(path.sep, spyCallback);

		expect(spyCallback).toHaveBeenCalledWith(null, [ "/archive", "/tagged/tag1", "/tagged/tag2", "/tagged/tagb" ]);
	});

	it("set the paths for all post dates", function() {
		blog_content_handler.tagCounts = {};
		blog_content_handler.postDates = { "2011": { "11": ["19", "20"] }, "2012": { "11": ["19"], "09": ["19"] } };

		spyOn(default_content_handler, "getContentPaths").andCallFake(function(path, callback) {
			return callback(null, []);
		});
		spyOn(blog_content_handler, "getAllPosts").andCallFake(function(callback) {
			return callback(null, { });
		});

		var spyCallback = jasmine.createSpy();
		blog_content_handler.getContentPaths(path.sep, spyCallback);

		expect(spyCallback).toHaveBeenCalledWith(null, [ "/archive",
		 																								 "/2011/11/19", "/2011/11", "/2011",
																										 "/2011/11/20",
																										 "/2012/11/19", "/2012/11", "/2012",
																										 "/2012/09/19", "/2012/09"
																						]);
	});
});

describe("get a post", function() {

	beforeEach(function() {
		var sample_config = {
			blog: {
				post_url: "/{year}/{month}/{date}-{title}",
				post_format: "md",
				posts_dir: "articles"
			},
			plugins: {}
		}

		blog_content_handler.setup(sample_config);
	});

	it("call parse content with the correct file path", function() {
		spyOn(blog_content_handler, "parseContent");

		var spyCallback = jasmine.createSpy();
		blog_content_handler.getPost("/2012/11/20-test-post/index", spyCallback);

		expect(blog_content_handler.parseContent).toHaveBeenCalledWith("articles" + path.sep + "2012-11-20-test-post.md", true, jasmine.any(Function));
	});

	it("call the callback with the output from parse content", function() {
		spyOn(blog_content_handler, "parseContent").andCallFake(function(path, parse_post, callback) {
			return callback(null, { "last_modified": new Date(2012, 10, 20), "title": "test post" });
		});

		var spyCallback = jasmine.createSpy();
		blog_content_handler.getPost("/2012/11/20-test-post/index", spyCallback);

		expect(spyCallback).toHaveBeenCalledWith(null, { "last_modified": new Date(2012, 10, 20), "title": "test post" }, new Date(2012, 10, 20))
	});

	it("call the callback with an error if the given path is invalid", function() {
		var spyCallback = jasmine.createSpy();
		blog_content_handler.getPost("/2012/11/20/test-post/index", spyCallback);

		expect(spyCallback).toHaveBeenCalledWith("[Error: Content for /2012/11/20/test-post/index not found]", null);
	});
});

describe("get a post (with a different URL structure)", function() {

	beforeEach(function() {
		var sample_config = {
			blog: {
				post_url: "/{title}",
				post_format: "md",
				posts_dir: "articles"
			},
			plugins: {}
		}

		blog_content_handler.setup(sample_config);
	});

	it("call parse content with the correct file path", function() {
		spyOn(blog_content_handler, "parseContent");

		var spyCallback = jasmine.createSpy();
		blog_content_handler.getPost("/test-post/index", spyCallback);

		expect(blog_content_handler.parseContent).toHaveBeenCalledWith("articles" + path.sep + "test-post.md", true, jasmine.any(Function));
	});

	it("call the callback with the output from parse content", function() {
		spyOn(blog_content_handler, "parseContent").andCallFake(function(path, parse_post, callback) {
			return callback(null, { "last_modified": new Date(2012, 10, 20), "title": "test post" });
		});

		var spyCallback = jasmine.createSpy();
		blog_content_handler.getPost("/test-post/index", spyCallback);

		expect(spyCallback).toHaveBeenCalledWith(null, { "last_modified": new Date(2012, 10, 20), "title": "test post" }, new Date(2012, 10, 20))
	});

	it("call the callback with an error if the given path is invalid", function() {
		var spyCallback = jasmine.createSpy();
		blog_content_handler.getPost("/2012/test-post/index", spyCallback);

		expect(spyCallback).toHaveBeenCalledWith("[Error: Content for /2012/test-post/index not found]", null);
	});
});

describe("get posts", function() {

	var dummy_posts_obj = {
		"post_1": { "tags": [ "test" ], "published_date": new Date(2011, 8, 1), "published": true },
		"post_2": { "tags": [ "test", "test2" ], "published_date": new Date(2012, 1, 1), "published": true },
		"post_3": { "tags": [ "test", "test2" ], "published_date": new Date(2012, 1, 3), "published": true },
		"post_4": { "tags": [ "test", "test3" ], "published_date": new Date(2012, 1, 3), "published": true },
		"post_5": { "tags": [ "test", "test3" ], "published_date": new Date(2012, 1, 3), "published": false }
	}

	beforeEach(function() {
		spyOn(blog_content_handler, "getAllPosts").andCallFake(function(callback) {
			return callback(null, dummy_posts_obj, new Date(2012, 10, 20));
		});
	});

	it("return all posts for /archive", function() {
		var spyCallback = jasmine.createSpy();
		blog_content_handler.getPosts("/archive/index", spyCallback);
		expect(spyCallback).toHaveBeenCalledWith(null, { "posts": [ dummy_posts_obj["post_4"], dummy_posts_obj["post_3"], dummy_posts_obj["post_2"], dummy_posts_obj["post_1"] ], "section": "" }, new Date(2012, 10, 20));
	});

	it("return posts tagged test2", function() {
		var spyCallback = jasmine.createSpy();
		blog_content_handler.getPosts("/tag/test2/index", spyCallback);
		expect(spyCallback).toHaveBeenCalledWith(null, { "posts": [ dummy_posts_obj["post_3"], dummy_posts_obj["post_2"] ], "section": "test2" }, new Date(2012, 10, 20));
	});

	it("return posts published in 2011", function() {
		var spyCallback = jasmine.createSpy();
		blog_content_handler.getPosts("/2011/index", spyCallback);
		expect(spyCallback).toHaveBeenCalledWith(null, { "posts": [ dummy_posts_obj["post_1"] ], "section": "2011" }, new Date(2012, 10, 20));
	});

	it("return posts published in February 2012", function() {
		var spyCallback = jasmine.createSpy();
		blog_content_handler.getPosts("/2012/02/index", spyCallback);
		expect(spyCallback).toHaveBeenCalledWith(null, { "posts": [ dummy_posts_obj["post_4"], dummy_posts_obj["post_3"], dummy_posts_obj["post_2"] ], "section": "2012 02" }, new Date(2012, 10, 20));
	});

	it("return posts published on 3rd February 2012", function() {
		var spyCallback = jasmine.createSpy();
		blog_content_handler.getPosts("/2012/02/03/index", spyCallback);
		expect(spyCallback).toHaveBeenCalledWith(null, { "posts": [ dummy_posts_obj["post_4"], dummy_posts_obj["post_3"] ], "section": "2012 02 03" }, new Date(2012, 10, 20));
	});

});

describe("parse content", function() {
	beforeEach(function() {
		var sample_config = {
			blog: {
				post_url: "/{year}/{month}/{date}/{title}",
			}
		}

		blog_content_handler.setupUrlPatterns(sample_config);
	});

	it("take the stat of given the post file", function() {
		spyOn(fs, "stat");

		var spyCallback = jasmine.createSpy();
		blog_content_handler.parseContent("articles/2012-11-20-test-post.md", true, spyCallback);

		expect(fs.stat).toHaveBeenCalledWith("articles/2012-11-20-test-post.md", jasmine.any(Function));
	});

	it("read the given post file", function() {
		spyOn(fs, "stat").andCallFake(function(path, callback) {
				return callback(null, {});
		});

		spyOn(fs, "readFile");

		var spyCallback = jasmine.createSpy();
		blog_content_handler.parseContent("articles/2012-11-20-test-post.md", true, spyCallback);

		expect(fs.readFile).toHaveBeenCalledWith("articles/2012-11-20-test-post.md", jasmine.any(Function));
	});

	it("call the callback with the error if reading fails", function() {
		spyOn(fs, "stat").andCallFake(function(path, callback) {
			return callback(null, {});
		});

		spyOn(fs, "readFile").andCallFake(function(path, callback) {
			return callback("error reading file", null);
		});

		var spyCallback = jasmine.createSpy();
		blog_content_handler.parseContent("articles/2012-11-20-test-post.md", true, spyCallback);

		expect(spyCallback).toHaveBeenCalledWith("error reading file", null);
	});

	it("return the parsed YAML front matter", function() {
		spyOn(fs, "stat").andCallFake(function(path, callback) {
			return callback(null, { mtime: new Date(2012, 10, 20) });
		});

		spyOn(fs, "readFile").andCallFake(function(path, callback) {
			return callback(null, "---key:value---content");
		});

		spyOn(yaml, "load").andCallFake(function(data) {
			var parsed_data = data.split(":");
			var result = {}
		 	result[parsed_data[0]] = parsed_data[1];
			return result;
		});

		var spyCallback = jasmine.createSpy();
		blog_content_handler.parseContent("articles/2012-11-18-test-post.md", false, spyCallback);

		expect(spyCallback).toHaveBeenCalledWith(null, { content: "content", key: "value", published_date: new Date(2012, 10, 18),
																										 permalink: "/2012/11/18/test-post", last_modified: new Date(2012, 10, 20) });
	});

	it("return the unparsed output if YAML parsing gives an exception", function() {
		spyOn(fs, "stat").andCallFake(function(path, callback) {
			return callback(null, { mtime: new Date(2012, 10, 20) });
		});

		spyOn(fs, "readFile").andCallFake(function(path, callback) {
			return callback(null, "---key:value---content");
		});

		spyOn(yaml, "load").andCallFake(function(data) {
			throw("exception");
		});

		var spyCallback = jasmine.createSpy();
		blog_content_handler.parseContent("articles/2012-11-18-test-post.md", false, spyCallback);

		expect(spyCallback).toHaveBeenCalledWith(null, { content: "---key:value---content" });
	});

	it("parse the post body", function() {
		spyOn(fs, "stat").andCallFake(function(path, callback) {
			return callback(null, { mtime: new Date(2012, 10, 20) });
		});

		spyOn(fs, "readFile").andCallFake(function(path, callback) {
			return callback(null, "---key:value---content");
		});

		spyOn(yaml, "load").andCallFake(function(data) {
			var parsed_data = data.split(":");
			var result = {}
		 	result[parsed_data[0]] = parsed_data[1];
			return result;
		});

		var spyParse = jasmine.createSpy().andCallFake(function(input, callback) {
			return callback(null, "parsed content")
		});
		var dummyParser = { parse: spyParse }
		blog_content_handler.parsers = { ".md": dummyParser }

		var spyCallback = jasmine.createSpy();
		blog_content_handler.parseContent("articles/2012-11-18-test-post.md", true, spyCallback);

		expect(spyCallback).toHaveBeenCalledWith(null, { content: "parsed content", key: "value", published_date: new Date(2012, 10, 18),
																										 permalink: "/2012/11/18/test-post", last_modified: new Date(2012, 10, 20) });
	});

	it("return the unparsed body if no parser found", function() {
		spyOn(fs, "stat").andCallFake(function(path, callback) {
			return callback(null, { mtime: new Date(2012, 10, 20) });
		});

		spyOn(fs, "readFile").andCallFake(function(path, callback) {
			return callback(null, "---key:value---content");
		});

		spyOn(yaml, "load").andCallFake(function(data) {
			var parsed_data = data.split(":");
			var result = {}
		 	result[parsed_data[0]] = parsed_data[1];
			return result;
		});

		blog_content_handler.parsers = { }

		var spyCallback = jasmine.createSpy();
		blog_content_handler.parseContent("articles/2012-11-18-test-post.md", true, spyCallback);

		expect(spyCallback).toHaveBeenCalledWith(null, { content: "content", key: "value", published_date: new Date(2012, 10, 18),
																										 permalink: "/2012/11/18/test-post", last_modified: new Date(2012, 10, 20) });
	});

	it("set the permalink in user defined format (and published date based on the last modified)", function() {
		var sample_config = {
			post_url: "/{year}/{date}-{title}",
		}

		blog_content_handler.setupUrlPatterns(sample_config);

		spyOn(fs, "stat").andCallFake(function(path, callback) {
			return callback(null, { mtime: new Date(2012, 10, 20), ctime: new Date(2012, 10, 18) });
		});

		spyOn(fs, "readFile").andCallFake(function(path, callback) {
			return callback(null, "---key:value---content");
		});

		spyOn(yaml, "load").andCallFake(function(data) {
			var parsed_data = data.split(":");
			var result = {}
		 	result[parsed_data[0]] = parsed_data[1];
			return result;
		});

		var spyCallback = jasmine.createSpy();
		blog_content_handler.parseContent("articles/2012-18-test-post.md", false, spyCallback);

		expect(spyCallback).toHaveBeenCalledWith(null, { content: "content", key: "value", published_date: new Date(2012, 10, 18),
																										 permalink: "/2012/18-test-post", last_modified: new Date(2012, 10, 20) });
	});

});

describe("get all posts", function() {

	it("return the fetched posts if posts are already fetched", function() {
		blog_content_handler.allPosts = { "post1": {}, "post2": {} };
		blog_content_handler.lastModified = new Date(2012, 10, 20);

		var spyCallback = jasmine.createSpy();
		blog_content_handler.getAllPosts(spyCallback);

		expect(spyCallback).toHaveBeenCalledWith(null, { "post1": {}, "post2": {} }, new Date(2012, 10, 20));
	});

	it("fetch and return all posts if no posts have been fetched", function() {
		blog_content_handler.allPosts = {};

		spyOn(blog_content_handler, "fetchAllPosts");

		var spyCallback = jasmine.createSpy();
		blog_content_handler.getAllPosts(spyCallback);

		expect(blog_content_handler.fetchAllPosts).toHaveBeenCalledWith(spyCallback);
	});
});

describe("fetch all posts", function() {
	beforeEach(function() {
		blog_content_handler.postsDir = "posts";
	});

	it("read the posts directory", function() {
		spyOn(fs, "readdir");

		var spyCallback = jasmine.createSpy();
		blog_content_handler.fetchAllPosts(spyCallback);

		expect(fs.readdir).toHaveBeenCalledWith("posts", jasmine.any(Function));
	});

	it("call the callback with the error if reading directory fails", function() {
		spyOn(fs, "readdir").andCallFake(function(posts_dir, callback) {
			return callback("error reading dir", null);
		});

		var spyCallback = jasmine.createSpy();
		blog_content_handler.fetchAllPosts(spyCallback);

		expect(spyCallback).toHaveBeenCalledWith("error reading dir", null);
	});

	it("parse each post file", function() {
		spyOn(fs, "readdir").andCallFake(function(posts_dir, callback) {
			return callback(null, [ "first_post", "second_post", "third_post" ]);
		});

		spyOn(blog_content_handler, "parseContent").andCallFake(function(path, parse_post, callback) {
			return callback("skip", null);
		});

		var spyCallback = jasmine.createSpy();
		blog_content_handler.fetchAllPosts(spyCallback);

		expect(blog_content_handler.parseContent.calls.length).toEqual(3);;
	});

	it("set the last modified to the latest post's modifiecation date", function() {
		blog_content_handler.lastModified = null;

		spyOn(fs, "readdir").andCallFake(function(posts_dir, callback) {
			return callback(null, [ "first_post", "second_post", "third_post" ]);
		});

		spyOn(blog_content_handler, "parseContent").andCallFake(function(file_path, parse_post, callback) {
			if (file_path === "posts" + path.sep + "first_post") {
				output = { "last_modified": new Date(2012, 10, 19), "published_date": new Date(2012, 10, 19) };
			} else if (file_path === "posts" + path.sep + "second_post") {
				output = { "last_modified": new Date(2012, 10, 20), "published_date": new Date(2012, 10, 19) };
			} else if (file_path === "posts" + path.sep + "third_post") {
				output = { "last_modified": new Date(2012, 10, 21), "published_date": new Date(2012, 10, 19)  };
			}
			return callback(null, output);
		});

		var spyCallback = jasmine.createSpy();
		blog_content_handler.fetchAllPosts(spyCallback);

		expect(blog_content_handler.lastModified).toEqual(new Date(2012, 10, 21));;
	});

	it("set the tag counts", function() {
		blog_content_handler.tagCounts = {};

		spyOn(fs, "readdir").andCallFake(function(posts_dir, callback) {
			return callback(null, [ "first_post", "second_post", "third_post" ]);
		});

		spyOn(blog_content_handler, "parseContent").andCallFake(function(file_path, parse_post, callback) {
			if (file_path === "posts" + path.sep + "first_post") {
				output = { "last_modified": new Date(2012, 10, 19), "published_date": new Date(2012, 10, 19), "tags": [ "tag1", "tag2", "tag3" ] };
			} else if (file_path === "posts" + path.sep + "second_post") {
				output = { "last_modified": new Date(2012, 10, 20), "published_date": new Date(2012, 10, 19), "tags": [ "tag3" ] };
			} else if (file_path === "posts" + path.sep + "third_post") {
				output = { "last_modified": new Date(2012, 10, 21), "published_date": new Date(2012, 10, 19), "tags": [ "tag2", "tag3" ]  };
			}
			return callback(null, output);
		});

		var spyCallback = jasmine.createSpy();
		blog_content_handler.fetchAllPosts(spyCallback);

		expect(blog_content_handler.tagCounts).toEqual({ "tag1": 1, "tag2": 2, "tag3": 3 });
	});

	it("set the post dates", function() {
		blog_content_handler.postDates = {};

		spyOn(fs, "readdir").andCallFake(function(posts_dir, callback) {
			return callback(null, [ "first_post", "second_post", "third_post", "fourth_post" ]);
		});

		spyOn(blog_content_handler, "parseContent").andCallFake(function(file_path, parse_post, callback) {
			if (file_path === "posts" + path.sep + "first_post") {
				output = { "last_modified": new Date(2012, 10, 19), "published_date": new Date(2012, 10, 19), "tags": [ "tag1", "tag2", "tag3" ] };
			} else if (file_path === "posts" + path.sep + "second_post") {
				output = { "last_modified": new Date(2012, 10, 20), "published_date": new Date(2012, 08, 19), "tags": [ "tag3" ] };
			} else if (file_path === "posts" + path.sep + "third_post") {
				output = { "last_modified": new Date(2012, 10, 21), "published_date": new Date(2011, 10, 19), "tags": [ "tag2", "tag3" ]  };
			} else if (file_path === "posts" + path.sep + "fourth_post") {
				output = { "last_modified": new Date(2012, 10, 21), "published_date": undefined, "tags": [ "tag2", "tag3" ]  };
			}
			return callback(null, output);
		});

		var spyCallback = jasmine.createSpy();
		blog_content_handler.fetchAllPosts(spyCallback);

		expect(blog_content_handler.postDates).toEqual({ "2011": { "11": ["19"] }, "2012": { "11": ["19"], "09": ["19"] } });
	});

	it("call the callback with all posts and last modified date", function() {
		blog_content_handler.lastModified = null;

		spyOn(fs, "readdir").andCallFake(function(posts_dir, callback) {
			return callback(null, [ "first_post", "second_post", "third_post" ]);
		});

		spyOn(blog_content_handler, "parseContent").andCallFake(function(path, parse_post, callback) {
			if (path === "posts/first_post") {
				output = { "last_modified": new Date(2012, 10, 19), "published_date": new Date(2012, 10, 19) };
			} else if (path === "posts/second_post") {
				output = { "last_modified": new Date(2012, 10, 20), "published_date": new Date(2012, 10, 19) };
			} else if (path === "posts/third_post") {
				output = { "last_modified": new Date(2012, 10, 21), "published_date": new Date(2012, 10, 19)  };
			}
			return callback(null, output);
		});

		var spyCallback = jasmine.createSpy();
		blog_content_handler.fetchAllPosts(spyCallback);

		expect(spyCallback).toHaveBeenCalledWith(null, {}, new Date(2012, 10, 21));;
	});

});
