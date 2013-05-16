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
var yaml = require("js-yaml");
var path_utils = require("punch").Utils.Path;

module.exports = {

	parsers: {},

	postsDir: "posts",

	postFormat: "markdown",

	allPosts: {},

	tagCounts: {},

	postDates: {},

	lastModified: null,

	postUrl: null,

	postFileNameRegex: null,

	archiveUrls: {},

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
      var parser = module_utils.requireAndSetup(value, config);
      var extensions = _.union( [key], (parser.supportedExtensions || []) );

      _.each(extensions, function(extension) {
        self.parsers[extension] = parser;
      });
		});

		// setup default content handler
		default_content_handler.setup(config);

		// return setup if there's no blog specific settings
		if (config.blog) {
			self.postsDir = config.blog.posts_dir || self.postsDir;

			self.postFormat = config.blog.post_format || self.postFormat;

			self.setupUrlPatterns(config.blog);
		} else {
			self.setupUrlPatterns({});
		}

	},

	setupUrlPatterns: function(blog_config) {
		var self = this;

		var regexMap = { year: "\\d\\d\\d\\d", month: "\\d\\d", date: "\\d\\d", title: "[^\\/\\s]+", tag: "[^\\/\\s]+" };

		var convert_to_regex_string = function(str, values) {
			var special_chars_regex = /[\/\^\$\*\+\.\?\(\)]/g;
			var portion_no = 0;
			var mappings = {};

			var regex_string = str.replace(special_chars_regex, "\\$&").replace(/({[^{}]+})/g, function(match) {
				var portion_name = match.replace(/[{,}]/g, '');
				mappings[portion_name] = ++portion_no;
				return "(" + values[portion_name] + ")"
			});

			return { "pattern": regex_string, "mappings": mappings };
		}
		self.postUrl = convert_to_regex_string( (blog_config.post_url || self.defaultPostUrl), regexMap);

		var file_name_portions = [];
		_.each(self.postUrl.mappings, function(value, key) {
			 file_name_portions.push( "(" + regexMap[key] + ")" );
		});

		self.postFileNameRegex = "^\\S+\/" + file_name_portions.join("-") + "\\.\\S+$";

		archiveUrls = _.extend({}, self.defaultArchiveUrls, blog_config.archive_urls);
		self.archiveUrls = _.map( archiveUrls, function(url) {
			return convert_to_regex_string(url, regexMap);
		});
	},

	// make every path a directory index
	// to create pretty URLs
	isSection: function(basepath) {
		var self = this;

		var post_url_regex = new RegExp("^" + self.postUrl.pattern + "$", "g");
		var archive_url_regexs = _.map(self.archiveUrls, function(url) {
			return new RegExp("^" + url.pattern + "$", "g");
		});

		var all_url_patterns = [].concat(post_url_regex, archive_url_regexs);

		if (path_utils.matchPath(basepath, "^/index$")) {
			return false;
		} else if (path_utils.matchPath(basepath, all_url_patterns)) {
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

		var post_url_regex = new RegExp("^" + self.postUrl.pattern + "\\/index$", "g");
		var archive_url_regexs = _.map(self.archiveUrls, function(url) {
			return new RegExp("^" + url.pattern + "\\/index$", "g");
		});

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
		if (path_utils.matchPath(basepath, archive_url_regexs)) {
			return self.getPosts(basepath, function(err, posts, modified_date) {
				if (err) {
					return callback(err, null, null, null);
				}

				collected_contents = _.extend(collected_contents, posts);
				collected_contents["is_post"] = false;
				collected_contents["title"] = "Archive";

				return add_shared_content();
			});
		} else if (path_utils.matchPath(basepath, post_url_regex)) {
			return self.getPost(basepath, function(err, post_contents, modified_date) {
				if (err) {
					return callback(err, null, null, null);
				}

				collected_contents = _.extend(collected_contents, post_contents);
				collected_contents["is_post"] = true;
				last_modified = modified_date;

				return add_shared_content();
			});
		} else {
			return default_content_handler.negotiateContent(basepath, content_type, options, callback);
		}
	},

	getContentPaths: function(basepath, callback) {
		var self = this;

		default_content_handler.getContentPaths(basepath, function(err, default_paths) {
			if (basepath === path.sep) {
				// get post paths
				self.getAllPosts(function(err, all_posts_obj, last_modified) {
					if (!err) {
						all_posts = _.values(all_posts_obj);

						// get post paths
						var post_paths = _.map(all_posts, function(post) {
							return post.permalink;
						});

						// get archive paths
						var archive_paths = [];

						var set_permalink = function(archive_url, slugs) {
							var match_count = 0;
							var slug_names = _.keys(archive_url.mappings);

							return archive_url.pattern.replace(/\\/g, "").replace(/(\([^\(\)\s]+\))/g, function(match) {
								return slugs[slug_names[match_count++]];
							});
						};

						// add main archive path
						archive_paths.push(set_permalink(self.archiveUrls[0], {}));

						// add year, month date archive paths
						_.each(self.postDates, function(months, year) {
							_.each(months, function(dates, month) {
								_.each(dates, function(date) {
									var slugs = { "year": year, "month": month, "date": date };

									var year_month_date_path = set_permalink(self.archiveUrls[3], slugs);
									var year_month_path = set_permalink(self.archiveUrls[2], slugs);
									var year_path = set_permalink(self.archiveUrls[1], slugs);

									if (archive_paths.indexOf(year_month_date_path) < 0) {
										archive_paths.push(year_month_date_path);
									}

									if (archive_paths.indexOf(year_month_path) < 0) {
										archive_paths.push(year_month_path);
									}

									if (archive_paths.indexOf(year_path) < 0) {
										archive_paths.push(year_path);
									}
								});
							});
						});

						// get tag paths
						var tag_paths = _.map(_.keys(self.tagCounts), function(tag) {
							return set_permalink(self.archiveUrls[4], { "tag": tag.toLowerCase() });
						});

						var all_paths = [].concat(default_paths, post_paths, archive_paths, tag_paths);
					}

					return callback(null, all_paths);
				});
			} else {
				return callback(null, default_paths);
			}

		});

	},

 /* Blog specific functions */

	getPost: function(basepath, callback) {
		var self = this;
		var slugs = path_utils.matchPath(basepath, "^" + self.postUrl.pattern + "\\/index$");
		var mappings = self.postUrl.mappings;

		var post_file_name = function() {
			var portions = [];

			_.each(mappings, function(name, key) {
				portions.push( slugs[mappings[key]] );
			});

			return portions.join("-");
		};
		if (slugs) {
			var post_path = (post_file_name()  + "." + self.postFormat);
			var absolute_file_path = path.join(self.postsDir, post_path);

			self.parseContent(absolute_file_path, true, function(err, output) {
				if(err) {
					return callback(err);
				} else {
					return callback(null, output, output["last_modified"]);
				}
			});
		} else {
			return callback("[Error: Content for " + basepath + " not found]", null);
		}
	},

	getPosts: function(basepath, callback) {
		var self = this;
		var cloned_archive_urls = self.archiveUrls.concat()
    var section = "";

		var get_slugs = function() {
			if (!cloned_archive_urls.length) {
				return {};
			}

			var archive_url = cloned_archive_urls.shift();
			var regex_match = path_utils.matchPath(basepath, "^" + archive_url.pattern + "\\/index$");

			if (regex_match) {
				var slugs = {};
				_.each(archive_url.mappings, function(value, key) {
					slugs[key] = regex_match[value];
				});

				return slugs;
			} else {
				return get_slugs();
			}
		}

		self.getAllPosts(function(err, all_posts_obj, last_modified) {
			if (err) {
				return callback(err, null, null);
			}

			all_posts = _.chain(all_posts_obj)
									 .values()
									 .filter( function(post) { return post.published })
									 .value().reverse();

			var matched_posts;
			var slugs = get_slugs();

			if (_.isEmpty(slugs)) {
				matched_posts = all_posts;
			} else if (slugs.tag) {
        section = slugs.tag;
				matched_posts = _.filter(all_posts, function(post) {
					return _.any(post.tags, function(tag) {
						return tag.toLowerCase() === slugs.tag.toLowerCase();
					});

				});

			} else if (slugs.year) {
        section = slugs.year;
				matched_posts = _.filter(all_posts, function(post) {
					return post.published_date.getFullYear() === parseInt(slugs.year, 10);
				});

				if (matched_posts.length && slugs.month) {
          section = section + " " + slugs.month;
					matched_posts = _.filter(matched_posts, function(post) {
						return post.published_date.getMonth() === (parseInt(slugs.month, 10) - 1);
					});
				}

				if (matched_posts.length && slugs.date) {
          section = section + " " + slugs.date;
					matched_posts = _.filter(matched_posts, function(post) {
						return post.published_date.getDate() === parseInt(slugs.date, 10);
					});
				}
			}

			return callback(null, { "posts": matched_posts, "section": section }, last_modified);
		});
	},

	parseContent: function(file_path, parse_post, callback) {
		var self = this;

		var get_parser_for = function(extension) {
			return self.parsers[extension];
		};

		var set_published_date = function(slugs, ctime) {
			var mappings = self.postUrl.mappings;

			var year = parseInt(slugs[mappings["year"]], 10);
			var month = parseInt(slugs[mappings["month"]], 10) - 1;
			var date = parseInt(slugs[mappings["date"]], 10);

			if (( year && month && date ) > -1) {
				return new Date(year, month, date);
			} else {
				return ctime;
			}
		};

		var set_permalink = function(slugs) {
			var match_count = 1;

			return self.postUrl.pattern.replace(/\\/g, "").replace(/(\([^\(\)\s]+\))/g, function(match) {
				return slugs[match_count++];
			});
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
						var slugs = path_utils.matchPath(file_path, self.postFileNameRegex);
						result["published_date"] = set_published_date(slugs, stat.ctime);
						result["permalink"] = set_permalink(slugs);
						result["last_modified"] = stat.mtime;

						// store result in allPosts collection
						self.allPosts[file_path] = result;

					} catch (e) {
						return callback(null, { content: data });
					}
				} else {
					return callback(null, { content: data });
				}

				var content = split[2].trim();
				var parser = get_parser_for("." + self.postFormat);

				if (parse_post && parser) {
					parser.parse(content, function(err, parsed_output) {
						result.content = parsed_output;
						return callback(null, result);
					});
				} else {
					result.content = content;
					return callback(null, result);
				}

			});
		});

	},

	fetchAllPosts: function(callback) {
		var self = this;
		fs.readdir(self.postsDir, function(err, post_paths) {
			if (err) {
				return callback(err, null);
			}

			var refresh_posts_collection = function() {
				if (!post_paths.length) {
					return callback(null, self.allPosts, self.lastModified);
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

						// store post dates
						var set_double_digits = function(val) {
							return ((val < 10) ?	( "0" + val ) : val).toString();
						};
						var published_date = output["published_date"];

						if (published_date) {
							var year = published_date.getFullYear().toString();
							var month = set_double_digits(published_date.getMonth() + 1);
							var date = set_double_digits(published_date.getDate());

							self.postDates[year] = (self.postDates[year] || {});
							self.postDates[year][month] = (self.postDates[year][month] || []).concat(date);
						}
					}

					return refresh_posts_collection();
				});
			};

			return refresh_posts_collection();
		});
	},

	getAllPosts: function(callback) {
		var self = this;
		if (_.isEmpty(self.allPosts)) {
			return self.fetchAllPosts(callback);
		} else {
			return callback(null, self.allPosts, self.lastModified);
		}
	}

}
