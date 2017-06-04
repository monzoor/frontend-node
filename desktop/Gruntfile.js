var request = require('request');
var fs = require('fs');
var path = require('path');
var _ = require('lodash');

module.exports = function (grunt) {
  // show elapsed time at the end
  require('time-grunt')(grunt);
  // load all grunt tasks
  require('load-grunt-tasks')(grunt);

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    // Dev server config
    nodemon: {
      options: {
        ext: 'js,json,hbs',
        legacyWatch: true,
        ignore: [
          'node_modules/**',
          'language/**',
          'public/**',
          'assets/**'
        ]
      },
      dev: {
        script: 'bin/www'
      },
      dist: {
        script: 'bin/www',
        options: {
          env: {
            NODE_ENV: 'production'
          }
        }
      }
    },

    // SASS globbing
    sass_globbing: {
      sb: {
        files: {
          'assets/scss/style.scss': [
            'node_modules/jeet/scss/jeet/_jeet.scss',
            'assets/scss/common/**/*.scss',
            'assets/scss/pages/**/*.scss'
          ]
        },
        options: {
          useSingleQuotes: false
        }
      }
    },

    // Compile SASS
    sass: {
      dist: {
        files: {
          'public/css/style.css': 'assets/scss/style.scss'
        },
        options: {
          compass: true
        }
      }
    },

    // Concatenate JS
    // Config dynamically altered by 'concat_prepare'
    concat: {
      main: {
        src: [
          'bower_components/jquery/dist/jquery.js',
          'bower_components/validate/validate.js',
          'assets/js/*.js'
        ],
        dest: './public/js/main.js'
      }
    },

    // Copy files from assets
    copy: {
      dev: {
        files: [{
          expand: true,
          cwd: 'assets/img/',
          src: ['*.{jpg,jpeg,png,gif}'],
          dest: 'public/img/'
        }, {
          expand: true,
          cwd: 'assets/font/',
          src: ['*.{eot,svg,ttf,woff,woff2}'],
          dest: 'public/font/'
        }]
      },
      dist: {
        files: [{
          expand: true,
          cwd: 'public/font/',
          src: ['*.{eot,svg,ttf,woff,woff2}'],
          dest: 'dist/font/'
        }, {
          // copies the robots.txt file from assets to dist directory
          expand: true,
          cwd: 'assets/robot/',
          src: ['*.txt'],
          dest: 'dist/'
        }]
      }
    },

    // Generate sprite sheet and CSS classes
    sprite:{
      main: {
        src: 'assets/sprite/*.png',
        retinaSrcFilter: 'assets/sprite/*@2x.png',
        dest: 'public/img/sprite.png',
        retinaDest: 'public/img/sprite@2x.png',
        imgPath: '../img/sprite.png',
        retinaImgPath: '../img/sprite@2x.png',
        padding: 10,
        cssVarMap: function (sprite) {
          sprite.name = 'sprite-' + sprite.name;
        },
        destCss: 'assets/scss/common/_02_sprite_variables.scss'
      }
    },

    // Uglify JS
    // Config dynamically altered by 'uglify_prepare'
    uglify: {
      options: {
        mangle: false
      },
      dist: {
        files: {}
      }
    },

    // Compress images
    imagemin: {
      dist: {
        files: [{
          expand: true,
          cwd: 'public/img',
          src: '*.{png,jpg,jpeg,gif}',
          dest: 'dist/img'
        }]
      }
    },

    // Rename files for browser caching
    filerev: {
      options: {
        algorithm: 'md5',
        length: 8
      },
      dist: {
        src: ['dist/**/*','!dist/**/robots.txt']
      }
    },

    // Spring cleaning
    clean: {
      public: [
        'public/*'
      ],
      dist: [
        'dist/*'
      ],
      tmp: [
        '.sass-cache',
        '.tmp'
      ]
    },

    // Minify styles
    cssmin: {
      options: {
        shorthandCompacting: false,
        roundingPrecision: -1
      },
      dist: {
        files: {
          'dist/css/style.css': [
            'public/css/style.css'
          ]
        }
      }
    },

    // Replace references to filerev'd images from js & css
    usemin: {
      css: ['dist/css/*.css'],
      js: ['dist/js/*.js'],
      options: {
        assetsDirs: [
          'dist/img'
        ]
      }
    },

    // Watch changes in assets, trigger dev tasks
    watch: {
      images: {
        files: 'assets/img/**/*.{jpg,jpeg,gif,png}',
        tasks: 'copy:dev'
      },
      fonts: {
        files: 'assets/font/**/*.{eot,svg,ttf,woff,woff2}',
        tasks: 'copy:dev'
      },
      styles: {
        files: 'assets/scss/**/*.scss',
        tasks: 'styles'
      },
      scripts: {
        files: 'assets/js/**/*.js',
        tasks: ['concat_prepare', 'concat']
      },
      sprite: {
        files: 'assets/sprite/*.png',
        tasks: ['sprite', 'styles']
      }
    },

    // Concurrently watch dev files & serve
    concurrent: {
      options: {
        logConcurrentOutput: true
      },
      serve: ['watch', 'nodemon:dev']
    }
  });

  // Compile sass styles
  grunt.registerTask('styles', [
    'sass_globbing',
    'sass'
  ]);

  // Compile development files
  grunt.registerTask('build_dev', [
    'clean:public',
    'sprite',
    'styles',
    'concat_prepare',
    'concat',
    'copy:dev',
    'clean:tmp'
  ]);

  // Compile distribution files
  grunt.registerTask('build', [
    'build_dev',
    'clean:dist',
    'uglify_prepare',
    'uglify',
    'cssmin',
    'imagemin',
    'copy:dist',
    'filerev',
    'filerev_mapping',
    'usemin',
    'clean:tmp'
  ]);

  // Build and serve the app (dev or dist)
  grunt.registerTask('serve', 'Compile, run and watch for changes', function (target) {
    // Serve distribution files
    if (target === 'dist') {
      return grunt.task.run(['build', 'nodemon:dist']);
    }

    // Serve development files and watch
    grunt.task.run([
      'build_dev',
      'concurrent:serve'
    ]);
  });

  /**
   * Builds the config for grunt-contrib-concat
   * Compiles all root-level js into one main js file, and
   * page-specific styles into separate files, using the
   * same name as their parent directory.
   */
  grunt.registerTask('concat_prepare', function() {
    var destDir = './public/js',
      srcDir = './assets/js',
      config = grunt.config.get('concat');

    fs.readdirSync(srcDir+'/pages')
      .filter(function(file) {
        return (file.indexOf('.') !== 0);
      })
      .forEach(function(dirname) {
        var target = destDir+'/'+dirname+'.js',
          sources = [];

        fs.readdirSync(srcDir+'/pages/'+dirname)
          .filter(function(file) {
            return (file.indexOf('.') !== 0);
          })
          .forEach(function(filename) {
            if (filename.slice(-3) !== '.js') return;
            sources.push(srcDir+'/pages/'+dirname+'/'+filename);
          });

          config[dirname] = {
            src: sources,
            dest: target
          };
      });

    grunt.config('concat', config);
  });

  /**
   * Builds the config for grunt-contrib-uglify
   * Reads contents of public js directory and ensures that
   * each file is uglified separately.
   */
  grunt.registerTask('uglify_prepare', function() {
    var dir = './public/js',
      config = grunt.config.get('uglify'),
      files = {};

    fs.readdirSync(dir)
      .filter(function(file) {
        return (file.indexOf('.') !== 0 || file.slice(-3) !== '.js');
      })
      .forEach(function(file) {
        var filepath = path.join(dir, file);
        config.dist.files[filepath.replace('public', 'dist')] = filepath;
      });
    
    grunt.config('uglify', config);
  });

  /**
   * Creates an app config file based on filerev summary to
   * be used by app & template helpers.
   */
  grunt.registerTask('filerev_mapping', function(task) {
    // Create json, remove all occurances of /public
    var json = JSON.stringify(grunt.filerev.summary, null, 2);
    json = json.replace(/dist\//g, '/');

    fs.writeFileSync('./config/filerev.json', json);
  });

  // Default grunt task is serve dev
  grunt.registerTask('default', [
    'serve'
  ]);
};
