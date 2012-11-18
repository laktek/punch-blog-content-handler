var blog_content_handler = require('../lib/blog_content_handler.js');
var module_utils = require("punch").Utils.Module;
var default_content_handler = require("punch").ContentHandler;

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

	it("setup URL patterns", function() {
		spyOn(blog_content_handler, "setupURLPatterns");

		blog_content_handler.setup(sample_config);
		expect(blog_content_handler.setupURLPatterns).toHaveBeenCalledWith(sample_config);
	});

});

describe("setup permalink patterns", function() {
	var sample_config = {
		blog: {
			post_url: "/{year}/{month}/{date}-{title}",
			archive_urls: {
				"all": "/history"
			}
		}
	}

	it("set the post url pattern based on the given post url", function() {
		blog_content_handler.setupURLPatterns(sample_config);
		expect(blog_content_handler.postUrlPattern).toEqual(/^\/(\d\d\d\d)\/(\d\d)\/(\d\d)-([^\/\s]+)$/g);
	});

	it("set the archive url patterns as an array", function() {
		blog_content_handler.setupURLPatterns(sample_config);
		expect(blog_content_handler.archiveUrlPatterns).toEqual([ /^\/history$/g, /^\/(\d\d\d\d)$/g, /\/(\d\d\d\d)\/(\d\d)/g, /\/(\d\d\d\d)\/(\d\d)\/(\d\d)/g, /\/tag\/([^\/s]+)/g ]);
	});
});

describe("is section", function() {

	beforeEach(function() {
		blog_content_handler.postUrlPattern = /^\/(\d\d\d\d)\/(\d\d)\/(\d\d)([^\/\s]+)$/g;
		blog_content_handler.archiveUrlPatterns = [ /^\/archive$/g, /^\/(\d\d\d\d)$/g, /^\/(\d\d\d\d)\/(\d\d)$/g, /^\/(\d\d\d\d)\/(\d\d)\/(\d\d)$/g, /^\/tag\/([^\/s]+)$/g ];
	});

	it("treat post urls as sections", function() {
		expect(blog_content_handler.isSection("/2012/11/19/test-post")).toEqual(true);
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



