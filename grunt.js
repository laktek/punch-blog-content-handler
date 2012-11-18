module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: '<json:package.json>',
    lint: {
      files: ['grunt.js', 'lib/**/*.js', 'spec/**/*.spec.js']
    },
    watch: {
      files: '<config:lint.files>',
      tasks: 'default'
    },
    jshint: {
      options: {
        node: true,
				es5: true,
				curly: true,
				debug: false,
				devel: false,
				eqeqeq: true,
				evil: true,
				forin: true,
				immed: true,
				indent: 4,
				latedef: true,
				lastsemic: true,
				maxparams: 5,
				maxdepth: 3,
				maxcomplexity: 5,
				newcap: true,
				noarg: true,
				noempty: false,
				nonew: true,
				onevar: false,
				plusplus: false,
				quotmark: "double",
				regexp: true,
				undef: true,
				unused: true,
				smarttabs: true,
				sub: true,
				strict: false,
				trailing: false,
				white: false
      },
      globals: {
        exports: true
      }
    }
  });

  // Default task.
  grunt.registerTask('default', 'lint');

};
