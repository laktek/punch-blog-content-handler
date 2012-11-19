/*
 * Punch Blog Content Handler
 * https://github.com/laktek/punch-blog-content-handler
 *
 * Copyright (c) 2012 Lakshan Perera
 * Licensed under the MIT license.
 */

var _ = require("underscore");
var fs = require("fs");
var path = require("path");
var default_content_handler = require("punch").ContentHandler;
var module_utils = require("punch").Utils.Module;
var extract_values = require("extract-values");
var yaml = require("js-yaml");

var match_patterns = function(basepath, patterns) {
	if (Array.isArray(patterns)) {
		return _.any(patterns, function(pattern) {
			return basepath.match(pattern) != null;
		});
	} else {
		// assume a single pattern given and match directly
		return basepath.match(patterns);
	}
};

module.exports = {

	parsers: {},

	postsDir: "posts",

	postFormatting: "markdown",

	allPosts: {},

	tagCounts: {},

	allYears: {},

	lastModified: null,

	defaultPostUrl: "/{year}/{month}/{date}/{title}",

	defaultArchiveUrls: {
		"all": "/archive",
		"year": "/{year}",
		"year_month": "/{year}/{month}",
		"year_month_date": "/{year}/{month}/{date}",
		"tag": "/tag/{tag}"
	},

	setup: function(config) {
		var self = this;

		_.each(config.plugins.parsers, function(value, key){
			self.parsers[key] = module_utils.requireAndSetup(value, config);
		});

		// setup default content handler
		default_content_handler.setup(config);

		// return setup if there's no blog specific settings
		if (!config.blog) {
			return;
		}

		self.postsDir = config.blog.posts_dir || self.postsDir;

		self.setupURLPatterns(config);
	},

	setupURLPatterns: function(config) {
		var self = this;

		var regexMap = { year: "\\d\\d\\d\\d", month: "\\d\\d", date: "\\d\\d", title: "[^\\/\\s]+", tag: "[^\\/\\s]+" };

		var convert_to_regex_string = function(str, values) {
			var special_chars_regex = /[\/\^\$\*\+\.\?\(\)]/g;
			return str.replace(special_chars_regex, "\\$&").replace(/({[^{}]+})/g, function(match) { return "(" + values[match.replace(/[{,}]/g, '')] + ")" });
		}

		self.postUrlPattern = convert_to_regex_string( (config.blog.post_url || self.defaultPostUrl), regexMap);

		archiveUrls = _.extend({}, self.defaultArchiveUrls, config.blog.archive_urls);
		self.archiveUrlPatterns = _.map( archiveUrls, function(url) {
			return convert_to_regex_string(url, regexMap);
		});
	},

	// make every path a directory index
	// to create pretty URLs
	isSection: function(basepath) {
		var self = this;

		var postUrlRegex = new RegExp("^" + self.postUrlPattern + "$", "g");
		var archiveUrlRegexs = _.map(self.archiveUrlPatterns, function(pattern) {
			return new RegExp("^" + pattern + "$", "g");
		});

		var all_url_patterns = [].concat(postUrlRegex, archiveUrlRegexs);

		if (match_patterns(basepath, all_url_patterns)) {
			return true;
		} else {
			return default_content_handler.isSection(basepath);
		}
	},

	getSections: function(callback) {
		var self = this;
		return default_content_handler.getSections(callback);
	},

	negotiateContent: function(basepath, content_type, options, callback) {
		var self = this;
		var collected_contents = {};
		var content_options = {};
		var last_modified = null;

		var post_url_pattern = /^\/(\d+)\/(\d+)\/(\d+)\/([^\/\s]+)\/index$/;
		var archive_url_patterns = [ /^\/(\d+)\/(\d+)\/(\d+)\/index$/, /^\/(\d+)\/(\d+)\/index$/, /^\/(\d\d\d\d)\/index$/, /^\/tag\/([^\/\s]+)\/index$/, /^\/archive\/index$/ ];

		// fetch and mix shared content
		var add_shared_content = function() {
			default_content_handler.getSharedContent(function(err, shared_content, shared_modified_date) {
				if (!err) {
					collected_contents = _.extend(collected_contents, shared_content);
					if (shared_modified_date > last_modified) {
						last_modified = shared_modified_date;
					}
				}

				return callback(null, collected_contents, content_options, last_modified);
			});
		};

		if (match_patterns(basepath, post_url_pattern)) {
			return self.getContent(basepath, function(err, post_contents, modified_date) {
				if (err) {
					return callback(err, null, null, null);
				}

				collected_contents = _.extend(collected_contents, post_contents);
				collected_contents["is_post"] = true;
				last_modified = modified_date;

				return add_shared_content();
			});
		} else if (match_patterns(basepath, archive_url_patterns)) {
			return self.getContents(basepath, function(err, posts, modified_date) {
				if (err) {
					return callback(err, null, null, null);
				}

				collected_contents = _.extend(collected_contents, posts);
				collected_contents["is_post"] = false;
				collected_contents["title"] = "Archive";

				return add_shared_content();
			});
		} else {
			return default_content_handler.negotiateContent(basepath, content_type, options, callback);
		}
	},

	getContentPaths: function(basepath, callback) {
		var self = this;

		default_content_handler.getContentPaths(basepath, function(err, default_paths) {
			if (basepath === "/") {
				// get post paths
				self.getAllPosts(function(err, all_posts_obj, last_modified) {
					if (!err) {
						all_posts = _.values(all_posts_obj);

						// get post paths
						var post_paths = _.map(all_posts, function(post) {
							return post.permalink;
						});

						// get archive paths
						var year_paths = _.map(_.keys(self.allYears), function(year) {
							return "/" + year;
						});

						// TODO: get year/month, year/month/date archive pats

						// get tag paths
						var tag_paths = _.map(_.keys(self.tagCounts), function(tag) {
							return "/tag/" + tag;
						});

						var all_paths = [].concat(default_paths, post_paths, year_paths, tag_paths);
					}

					return callback(null, all_paths);
				});
			} else {
				return callback(null, default_paths);
			}

		});

	},

	parseContent: function(file_path, parse_post, callback) {
		var self = this;

		var get_parser_for = function(extension) {
			return self.parsers[extension];
		};

		fs.stat(file_path, function(err, stat) {
			if (err) {
				return callback(err, null);
			}

			fs.readFile(file_path, function(err, data) {
				if (err) {
					return callback(err, null);
				}

				data = data.toString().trim();

				var split;
				var result = {};

				if ((split = data.split("---")).length > 0) {
					try {
						result = yaml.load(split[1]);

						// mix-in the date
						var slugs = file_path.match(/posts\/(\d+)-(\d+)-(\d+)-(\S+)\.\S+$/);
						result["published_date"] = new Date(parseInt(slugs[1], 10), (parseInt(slugs[2], 10) - 1), parseInt(slugs[3], 10));
						result["permalink"] = "/" + slugs[1] + "/" + slugs[2] + "/" + slugs[3] + "/" + slugs[4];
						result["last_modified"] = stat.mtime;

						// store result in allPosts collection
						self.allPosts[file_path] = result;

					} catch (e) {
						return callback(null, { content: data });
					}
				} else {
					return callback(null, { content: data });
				}

				if (parse_post) {
					parser = get_parser_for("." + self.postFormatting);

					parser.parse(split[2].trim(), function(err, parsed_output) {

						result.content = parsed_output;

						return callback(null, result);
					});
				} else {
					return callback(null, result);
				}

			});
		});

	},

	getContent: function(basepath, callback) {
		var self = this;
		var url_pattern = "/{year}/{month}/{day}/{title}/index";

		var slugs = extract_values(basepath, url_pattern);

		if (slugs) {
			var post_path = (slugs.year + "-" + slugs.month + "-" + slugs.day + "-" + slugs.title  + "." + self.postFormatting);
			var absolute_file_path = path.join(self.postsDir, post_path);

			self.parseContent(absolute_file_path, true, function(err, output) {
				return callback(null, output, output["last_modified"]);
			});
		} else {
			return callback("[Error: Content for " + basepath + " not found]", null);
		}
	},

	fetchAllPosts: function(callback) {
		var self = this;

		fs.readdir(self.postsDir, function(err, post_paths) {
			if (err) {
				return callback(err, null);
			}

			var refresh_posts_collection = function() {
				if (!post_paths.length) {
					return callback(null, self.allPosts);
				}

				var post_path = post_paths.shift();

				// skip hidden files in the posts directory
				if (post_path[0] === ".") {
					return refresh_posts_collection();
				}

				var full_post_path = path.join(self.postsDir, post_path);
				self.parseContent(full_post_path, false, function(err, output) {

					if (!err) {
						if (output["last_modified"] > self.lastModified) {
							self.lastModified = output["last_modified"];
						}

						// store tags
						_.each(output["tags"], function(tag) {
							self.tagCounts[tag] = (self.tagCounts[tag] || 0) + 1;
						});

						// store years
						self.allYears[output["published_date"].getFullYear()] = true;
					}

					return refresh_posts_collection();
				});
			};

			return refresh_posts_collection();
		});
	},

	getAllPosts: function(callback) {
		var self = this;

		if (self.allPosts.length) {
			return callback(null, self.allPosts, self.lastModified);
		} else {
			return self.fetchAllPosts(callback);
		}
	},

	getContents: function(basepath, callback) {
		var self = this;

		var slugs = extract_values(basepath, "/tag/{tag}/index") ||
								extract_values(basepath, "/{year}/{month}/{date}/index") ||
								extract_values(basepath, "/{year}/{month}/index") ||
								extract_values(basepath, "/{year}/index");

		self.getAllPosts(function(err, all_posts_obj, last_modified) {
			all_posts = _.chain(all_posts_obj)
									 .values()
									 .filter( function(post) { return post.published })
									 .value().reverse();

			if (err) {
				return callback(err, null, null);
			}

			var matched_posts;

			if (basepath === "/archive/index") {
				matched_posts = all_posts;
			} else if (slugs.tag) {
				matched_posts = _.filter(all_posts, function(post) {
					return _.any(post.tags, function(tag) {
						return tag.toLowerCase() === slugs.tag.toLowerCase();
					});

				});
			} else if (slugs.year) {
				matched_posts = _.filter(all_posts, function(post) {
					if (!post.published) {
						return false;
					}

					return post.published_date.getFullYear() === parseInt(slugs.year, 10);
				});

				if (matched_posts.length && slugs.month) {
					matched_posts = _.filter(matched_posts, function(post) {
						return post.published_date.getMonth() === (parseInt(slugs.month, 10) - 1);
					});
				}

				if (matched_posts.length && slugs.date) {
					matched_posts = _.filter(matched_posts, function(post) {
						return post.published_date.getDate() === parseInt(slugs.date, 10);
					});
				}
			}

			return callback(null, { "posts": matched_posts }, last_modified);
		});
	}

}
