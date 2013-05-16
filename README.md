# Punch Blog Content Handler

A special content handler to manage a blog with [Punch](http://laktek.github.com/punch).

## How to Use 

* Install the package:

	`npm install punch-blog-content-handler`

* Open your Punch project's configurations (`config.json`) and add the following:

	```json
	"plugins": {
		"content_handler": "punch-blog-content-handler"
	}
	```

* You can use `blog` section to provide blog specific configurations.

	```json
	"blog": {
		"posts_dir": "posts",
		"post_format": "markdown",
		"post_url": "/{year}/{month}/{date}/{title}",
		"archive_urls": {
			"all": "/archive",
			"year": "/{year}",
			"year_month": "/{year}/{month}",
			"year_month_date": "/{year}/{month}/{date}",
			"tag": "/tag/{tag}"
		}
	}
	```

* `posts_dir` - directory within the project, where your posts are saved. ( _default: posts_ )

* `post_format` - Punch will use the available parser for the given format to convert your posts to HTML. ( _default: markdown_ )

* `post_url` - You can use the following tags to compose the desired post permalink - `{year}`, `{month}`, `{date}` & `{title}`. ( _default: /{year}/{month}/{date}/{title}_ )

* `archive_url` - URLs to be used for different archive sections. Following archive sections are available.

  * `all` - to show all published posts. ( _default: /archive_ )
  * `year` - to show posts published in the given year. ( _default: /{year}_ )
  * `year_month` - to show posts published in the given month in the year. ( _default: /{year}/{month}_ )
  * `year_month_date` - to show posts published in the given date. ( _default: /{year}/{month}/{date}_ )
  * `tag` - to show posts tagged with the given tag. ( _default: /tag/{tag}_ )

Note that content handler will create only the necessary URLs for the above archive pages. You will need to create a helper to fetch the matching posts.

## License

Copyright (c) 2012 Lakshan Perera
Licensed under the MIT license.
